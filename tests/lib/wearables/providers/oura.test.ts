import { describe, test, expect, vi, afterEach } from 'vitest'
import { mapToNormalized, fetchHistoricalData } from '@/lib/wearables/providers/oura'

const FULL_READINESS = {
  score: 74,
  temperature_deviation: 0.3,
}

const FULL_SLEEP = {
  score: 67,
  average_hrv: 42,
  lowest_resting_heart_rate: 58,
  total_sleep_duration: 22440, // 374 minutes
  deep_sleep_duration: 3120,   // 52 minutes
  rem_sleep_duration: 4440,    // 74 minutes
  efficiency: 84,
}

describe('lib/wearables/providers/oura', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('mapToNormalized', () => {
    test('all fields map correctly from a complete Oura API response', () => {
      const result = mapToNormalized(FULL_READINESS, FULL_SLEEP)
      expect(result).toEqual({
        readinessScore: 74,
        hrvAvg: 42,
        restingHeartRate: 58,
        sleepScore: 67,
        sleepDurationMinutes: 374,
        deepSleepMinutes: 52,
        remSleepMinutes: 74,
        sleepEfficiency: 84,
        bodyTempDeviation: 0.3,
      })
    })

    test('duration fields are converted from seconds to minutes', () => {
      const result = mapToNormalized(null, {
        total_sleep_duration: 27000,
        deep_sleep_duration: 5400,
        rem_sleep_duration: 6000,
      })
      expect(result.sleepDurationMinutes).toBe(450)
      expect(result.deepSleepMinutes).toBe(90)
      expect(result.remSleepMinutes).toBe(100)
    })

    test('body temperature deviation maps from readiness.temperature_deviation', () => {
      const result = mapToNormalized({ score: 70, temperature_deviation: -0.5 }, null)
      expect(result.bodyTempDeviation).toBe(-0.5)
    })

    test('missing fields in the Oura response produce undefined values, not errors', () => {
      const result = mapToNormalized({}, {})
      expect(result.readinessScore).toBeUndefined()
      expect(result.bodyTempDeviation).toBeUndefined()
      expect(result.hrvAvg).toBeUndefined()
      expect(result.restingHeartRate).toBeUndefined()
      expect(result.sleepScore).toBeUndefined()
      expect(result.sleepDurationMinutes).toBeUndefined()
      expect(result.deepSleepMinutes).toBeUndefined()
      expect(result.remSleepMinutes).toBeUndefined()
      expect(result.sleepEfficiency).toBeUndefined()
    })

    test('a partial response (readiness only, sleep absent) does not throw', () => {
      expect(() => mapToNormalized(FULL_READINESS, null)).not.toThrow()
    })

    test('a partial response (sleep only, readiness absent) does not throw', () => {
      expect(() => mapToNormalized(null, FULL_SLEEP)).not.toThrow()
    })
  })

  describe('fetchHistoricalData', () => {
    test('returns metrics with their corresponding dates', async () => {
      const readinessData = {
        data: [
          { day: '2026-01-01', score: 80, temperature_deviation: 0.1 },
          { day: '2026-01-02', score: 75, temperature_deviation: -0.2 },
        ],
      }
      const sleepData = {
        data: [
          {
            day: '2026-01-01',
            score: 70,
            average_hrv: 45,
            lowest_resting_heart_rate: 55,
            total_sleep_duration: 25200,
            deep_sleep_duration: 3600,
            rem_sleep_duration: 5400,
            efficiency: 88,
          },
        ],
      }

      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => readinessData })
          .mockResolvedValueOnce({ ok: true, json: async () => sleepData }),
      )

      const result = await fetchHistoricalData('token', '2026-01-01', '2026-01-02')
      const dates = result.map((r) => r.date).sort()

      expect(dates).toContain('2026-01-01')
      expect(dates).toContain('2026-01-02')

      const jan01 = result.find((r) => r.date === '2026-01-01')
      expect(jan01?.readinessScore).toBe(80)
      expect(jan01?.sleepScore).toBe(70)
      expect(jan01?.sleepDurationMinutes).toBe(420)

      const jan02 = result.find((r) => r.date === '2026-01-02')
      expect(jan02?.readinessScore).toBe(75)
      expect(jan02?.sleepScore).toBeUndefined()
    })
  })
})
