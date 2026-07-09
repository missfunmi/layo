import { describe, test, expect, vi, afterEach } from 'vitest'
import { mapToNormalized, fetchHistoricalData, fetchTodayData } from '@/lib/wearables/providers/oura'
import * as Sentry from '@sentry/nextjs'

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

const FULL_READINESS = {
  score: 74,
  temperature_deviation: 0.3,
}

const FULL_DAILY_SLEEP = {
  score: 67,
  contributors: { deep_sleep: 64, efficiency: 81, latency: 97, rem_sleep: 88, restfulness: 68, timing: 74, total_sleep: 63 },
}

// 6h main sleep: 21600s = 360min, time_in_bed 24000s = 400min -> efficiency 90%
const MAIN_SLEEP_PERIOD = {
  type: 'long_sleep',
  day: '2026-01-01',
  average_hrv: 40,
  lowest_heart_rate: 55,
  total_sleep_duration: 21600,
  deep_sleep_duration: 3600,
  rem_sleep_duration: 5400,
  time_in_bed: 24000,
}

// 1h30m nap: 5400s = 90min, time_in_bed 6000s = 100min -> efficiency 90%
const NAP_PERIOD = {
  type: 'sleep',
  day: '2026-01-01',
  average_hrv: 60,
  lowest_heart_rate: 50,
  total_sleep_duration: 5400,
  deep_sleep_duration: 0,
  rem_sleep_duration: 0,
  time_in_bed: 6000,
}

const EXCLUDED_REST_PERIOD = {
  type: 'rest',
  day: '2026-01-01',
  average_hrv: 999,
  lowest_heart_rate: 1,
  total_sleep_duration: 999999,
  deep_sleep_duration: 999999,
  rem_sleep_duration: 999999,
  time_in_bed: 999999,
}

const EXCLUDED_DELETED_PERIOD = {
  ...EXCLUDED_REST_PERIOD,
  type: 'deleted',
}

describe('lib/wearables/providers/oura', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('mapToNormalized', () => {
    test('all fields map correctly from a complete Oura API response with a single sleep period', () => {
      const result = mapToNormalized(FULL_READINESS, FULL_DAILY_SLEEP, [MAIN_SLEEP_PERIOD])
      expect(result).toEqual({
        readinessScore: 74,
        bodyTempDeviation: 0.3,
        sleepScore: 67,
        hrvAvg: 40,
        restingHeartRate: 55,
        sleepDurationMinutes: 360,
        deepSleepMinutes: 60,
        remSleepMinutes: 90,
        sleepEfficiency: 90,
      })
    })

    test('body temperature deviation maps from readiness.temperature_deviation', () => {
      const result = mapToNormalized({ score: 70, temperature_deviation: -0.5 }, null, null)
      expect(result.bodyTempDeviation).toBe(-0.5)
    })

    test('sleep_score maps from dailySleep.score, independent of sleep periods', () => {
      const result = mapToNormalized(null, { score: 67 }, null)
      expect(result.sleepScore).toBe(67)
    })

    test('missing fields in the Oura response produce undefined values, not errors', () => {
      const result = mapToNormalized({}, {}, [])
      expect(result.readinessScore).toBeUndefined()
      expect(result.bodyTempDeviation).toBeUndefined()
      expect(result.sleepScore).toBeUndefined()
      expect(result.hrvAvg).toBeUndefined()
      expect(result.restingHeartRate).toBeUndefined()
      expect(result.sleepDurationMinutes).toBeUndefined()
      expect(result.deepSleepMinutes).toBeUndefined()
      expect(result.remSleepMinutes).toBeUndefined()
      expect(result.sleepEfficiency).toBeUndefined()
    })

    test('a partial response (readiness only, no sleep periods) does not throw', () => {
      expect(() => mapToNormalized(FULL_READINESS, null, null)).not.toThrow()
    })

    test('a partial response (sleep periods only, readiness absent) does not throw', () => {
      expect(() => mapToNormalized(null, null, [MAIN_SLEEP_PERIOD])).not.toThrow()
    })

    test('durations are summed across multiple sleep periods in the same day (main sleep + nap)', () => {
      const result = mapToNormalized(null, null, [MAIN_SLEEP_PERIOD, NAP_PERIOD])
      expect(result.sleepDurationMinutes).toBe(450) // 360 + 90 = 7h30m
      expect(result.deepSleepMinutes).toBe(60) // 60 + 0
      expect(result.remSleepMinutes).toBe(90) // 90 + 0
    })

    test('hrv_avg is a duration-weighted average across multiple sleep periods, not a plain average', () => {
      const result = mapToNormalized(null, null, [MAIN_SLEEP_PERIOD, NAP_PERIOD])
      // (40 * 21600 + 60 * 5400) / (21600 + 5400) = 44, not the plain average of 50
      expect(result.hrvAvg).toBe(44)
    })

    test('resting_heart_rate takes the minimum lowest_heart_rate across periods, even from a nap', () => {
      const result = mapToNormalized(null, null, [MAIN_SLEEP_PERIOD, NAP_PERIOD])
      // main sleep lowest_heart_rate is 55, nap's is 50 (lower) - the day's value should be 50
      expect(result.restingHeartRate).toBe(50)
    })

    test('sleep_efficiency is recomputed from summed total_sleep_duration and time_in_bed, not averaged per-period percentages', () => {
      const result = mapToNormalized(null, null, [MAIN_SLEEP_PERIOD, NAP_PERIOD])
      // sum(total_sleep_duration) 27000 / sum(time_in_bed) 30000 * 100 = 90
      expect(result.sleepEfficiency).toBe(90)
    })

    test('a single nap with no long_sleep period still aggregates correctly', () => {
      const result = mapToNormalized(null, null, [NAP_PERIOD])
      expect(result.sleepDurationMinutes).toBe(90)
      expect(result.hrvAvg).toBe(60)
      expect(result.restingHeartRate).toBe(50)
      expect(result.sleepEfficiency).toBe(90)
    })

    test('sleep periods with type rest or deleted are excluded from aggregation', () => {
      const result = mapToNormalized(null, null, [MAIN_SLEEP_PERIOD, EXCLUDED_REST_PERIOD, EXCLUDED_DELETED_PERIOD])
      expect(result.sleepDurationMinutes).toBe(360)
      expect(result.hrvAvg).toBe(40)
      expect(result.restingHeartRate).toBe(55)
    })
  })

  describe('fetchTodayData', () => {
    afterEach(() => {
      vi.mocked(Sentry.captureMessage).mockReset()
    })

    test('requests daily_readiness, daily_sleep, and sleep endpoints for the given date', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [FULL_READINESS] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [FULL_DAILY_SLEEP] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [MAIN_SLEEP_PERIOD] }) })
      vi.stubGlobal('fetch', fetchMock)

      await fetchTodayData('fake-token', '2026-07-07')

      const urls = fetchMock.mock.calls.map((call) => String(call[0]))
      expect(urls.some((u) => u.includes('/daily_readiness'))).toBe(true)
      expect(urls.some((u) => u.includes('/daily_sleep'))).toBe(true)
      expect(urls.some((u) => u.includes('/usercollection/sleep?'))).toBe(true)
    })

    test('aggregates multiple sleep periods returned for today into the stored metrics', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [FULL_READINESS] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [FULL_DAILY_SLEEP] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [MAIN_SLEEP_PERIOD, NAP_PERIOD] }) }),
      )

      const result = await fetchTodayData('fake-token', '2026-01-01')
      expect(result?.metrics.sleepDurationMinutes).toBe(450)
      expect(result?.metrics.restingHeartRate).toBe(50)
    })

    test('emits a Sentry event when the API returns a non-null response but all mapped metrics are undefined', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ unrecognized_field: 80 }] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ also_unknown: 42 }] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }),
      )
      await fetchTodayData('fake-token', '2026-07-07')
      expect(Sentry.captureMessage).toHaveBeenCalledOnce()
    })

    test('does not emit a Sentry event when metrics are successfully mapped', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [FULL_READINESS] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [FULL_DAILY_SLEEP] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [MAIN_SLEEP_PERIOD] }) }),
      )
      await fetchTodayData('fake-token', '2026-01-01')
      expect(Sentry.captureMessage).not.toHaveBeenCalled()
    })

    test('does not emit a Sentry event when the API returns no data (null readiness, sleep, and periods)', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }),
      )
      await fetchTodayData('fake-token', '2026-07-07')
      expect(Sentry.captureMessage).not.toHaveBeenCalled()
    })
  })

  describe('fetchTodayData (error handling)', () => {
    test('error thrown when readiness returns 401 includes the Oura response body', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => '{"detail":"Authorization token is invalid."}',
          })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }),
      )
      await expect(fetchTodayData('bad-token', '2026-07-07')).rejects.toThrow(
        'Oura API error: 401 {"detail":"Authorization token is invalid."}',
      )
    })

    test('error thrown when daily_sleep returns 401 includes the Oura response body', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => '{"detail":"Insufficient scope."}',
          })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }),
      )
      await expect(fetchTodayData('bad-token', '2026-07-07')).rejects.toThrow(
        'Oura API error: 401 {"detail":"Insufficient scope."}',
      )
    })

    test('error thrown when sleep returns 401 includes the Oura response body', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => '{"detail":"Insufficient scope for sleep periods."}',
          }),
      )
      await expect(fetchTodayData('bad-token', '2026-07-07')).rejects.toThrow(
        'Oura API error: 401 {"detail":"Insufficient scope for sleep periods."}',
      )
    })
  })

  describe('fetchHistoricalData', () => {
    test('error thrown when readiness returns 401 includes the Oura response body', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => '{"detail":"Authorization token is invalid."}',
          })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }),
      )
      await expect(fetchHistoricalData('bad-token', '2026-04-08', '2026-07-07')).rejects.toThrow(
        'Oura API error: 401 {"detail":"Authorization token is invalid."}',
      )
    })

    test('does not throw when a 200 response has a missing data array', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
          .mockResolvedValueOnce({ ok: true, json: async () => ({}) }),
      )
      await expect(fetchHistoricalData('token', '2026-01-01', '2026-01-02')).resolves.toEqual([])
    })

    test('returns metrics with their corresponding dates, aggregating sleep periods per day', async () => {
      const readinessData = {
        data: [
          { day: '2026-01-01', score: 80, temperature_deviation: 0.1 },
          { day: '2026-01-02', score: 75, temperature_deviation: -0.2 },
        ],
      }
      const dailySleepData = {
        data: [{ day: '2026-01-01', score: 70 }],
      }
      const sleepData = {
        data: [
          { ...MAIN_SLEEP_PERIOD, day: '2026-01-01' },
          { ...NAP_PERIOD, day: '2026-01-01' },
        ],
      }

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => readinessData })
          .mockResolvedValueOnce({ ok: true, json: async () => dailySleepData })
          .mockResolvedValueOnce({ ok: true, json: async () => sleepData }),
      )

      const result = await fetchHistoricalData('token', '2026-01-01', '2026-01-02')
      const dates = result.map((r) => r.date).sort()

      expect(dates).toContain('2026-01-01')
      expect(dates).toContain('2026-01-02')

      const jan01 = result.find((r) => r.date === '2026-01-01')
      expect(jan01?.readinessScore).toBe(80)
      expect(jan01?.sleepScore).toBe(70)
      expect(jan01?.sleepDurationMinutes).toBe(450)
      expect(jan01?.restingHeartRate).toBe(50)

      const jan02 = result.find((r) => r.date === '2026-01-02')
      expect(jan02?.readinessScore).toBe(75)
      expect(jan02?.sleepScore).toBeUndefined()
      expect(jan02?.sleepDurationMinutes).toBeUndefined()
    })
  })
})
