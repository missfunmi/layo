import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTestClient, setupTestDb, teardownTestDb } from '@/tests/helpers/db'
import { computeBaseline, formatLLMContext, fetchAndStoreTodayMetrics } from '@/lib/wearables/index'
import { fetchTodayData, refreshToken } from '@/lib/wearables/providers/oura'
import type { NormalizedDailyMetric, WearableBaseline, WearableThresholds } from '@/lib/wearables/types'

vi.mock('@/lib/wearables/providers/oura', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wearables/providers/oura')>()
  return { ...actual, fetchTodayData: vi.fn(), refreshToken: vi.fn() }
})

vi.mock('@/lib/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crypto')>()
  return { ...actual, decrypt: vi.fn().mockReturnValue('fake-token') }
})

const THRESHOLDS: WearableThresholds = {
  readinessScore: { report_threshold_pct: 8, higher_is: 'better' },
  hrvAvg: { report_threshold_pct: 8, higher_is: 'better' },
  restingHeartRate: { report_threshold_pct: 5, higher_is: 'worse' },
  sleepScore: { report_threshold_pct: 8, higher_is: 'better' },
  sleepDurationMinutes: { report_threshold_pct: 15, higher_is: 'better' },
  deepSleepMinutes: { report_threshold_pct: 20, higher_is: 'better' },
  remSleepMinutes: { report_threshold_pct: 20, higher_is: 'better' },
  sleepEfficiency: { report_threshold_pct: 5, higher_is: 'better' },
  bodyTempDeviation: { report_threshold_pct: null, higher_is: null },
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

describe('lib/wearables/index', () => {
  describe('computeBaseline', () => {
    let userId: string
    let connectionId: string

    beforeEach(async () => {
      await setupTestDb()
      const user = await getTestClient().user.create({ data: { deviceId: 'wearable-baseline-test' } })
      userId = user.id
      const conn = await getTestClient().wearableConnection.create({
        data: {
          userId,
          provider: 'oura',
          accessToken: 'tok',
          refreshToken: 'ref',
          tokenExpiresAt: new Date(Date.now() + 86400000),
          status: 'active',
        },
      })
      connectionId = conn.id
    })

    afterEach(teardownTestDb)

    async function insertMetric(date: Date, readinessScore: number | null) {
      await getTestClient().wearableDailyMetric.create({
        data: {
          userId,
          connectionId,
          provider: 'oura',
          metricDate: date,
          rawData: {},
          readinessScore,
        },
      })
    }

    test('correct average is computed from 90 days of stored rows', async () => {
      for (let i = 1; i <= 20; i++) {
        await insertMetric(daysAgo(i), 80)
      }
      const baseline = await computeBaseline(userId, 'oura')
      expect(baseline.readinessScore).toBeCloseTo(80, 1)
    })

    test('a metric with fewer than 14 non-null rows returns undefined for that metric', async () => {
      for (let i = 1; i <= 13; i++) {
        await insertMetric(daysAgo(i), 80)
      }
      const baseline = await computeBaseline(userId, 'oura')
      expect(baseline.readinessScore).toBeUndefined()
    })

    test('a metric with exactly 14 non-null rows returns a value', async () => {
      for (let i = 1; i <= 14; i++) {
        await insertMetric(daysAgo(i), 80)
      }
      const baseline = await computeBaseline(userId, 'oura')
      expect(baseline.readinessScore).toBeCloseTo(80, 1)
    })

    test('null metric values are excluded from the average calculation', async () => {
      for (let i = 1; i <= 10; i++) {
        await insertMetric(daysAgo(i), 60)
      }
      for (let i = 11; i <= 20; i++) {
        await insertMetric(daysAgo(i), null)
      }
      const baseline = await computeBaseline(userId, 'oura')
      // Only 10 rows with values — below 14 threshold, so undefined
      expect(baseline.readinessScore).toBeUndefined()
    })

    test('rows older than 90 days are not included in the average', async () => {
      for (let i = 1; i <= 20; i++) {
        await insertMetric(daysAgo(i), 80)
      }
      // Insert old rows that should be excluded
      for (let i = 95; i <= 104; i++) {
        await insertMetric(daysAgo(i), 40)
      }
      const baseline = await computeBaseline(userId, 'oura')
      expect(baseline.readinessScore).toBeCloseTo(80, 1)
    })
  })

  describe('formatLLMContext', () => {
    test('today\'s data present produces the full context block with correctly formatted metric lines', () => {
      const today: NormalizedDailyMetric = {
        readinessScore: 61,
        hrvAvg: 42,
        restingHeartRate: 58,
        sleepScore: 67,
        sleepDurationMinutes: 374,
        deepSleepMinutes: 52,
        remSleepMinutes: 74,
        sleepEfficiency: 84,
        bodyTempDeviation: 0.3,
      }
      const baseline: WearableBaseline = {
        readinessScore: 74,
        hrvAvg: 58,
        restingHeartRate: 52,
        sleepScore: 74,
        sleepDurationMinutes: 442,
        deepSleepMinutes: 68,
        remSleepMinutes: 101,
        sleepEfficiency: 88,
        bodyTempDeviation: 0,
      }
      const output = formatLLMContext(today, baseline, THRESHOLDS)
      expect(output).toContain('Wearable data (Oura Ring):')
      expect(output).toContain('Readiness score: 61 (90-day avg: 74, 18% below baseline)')
      expect(output).toContain('HRV: 42ms (90-day avg: 58ms, 28% below baseline)')
      expect(output).toContain('Resting heart rate: 58bpm (90-day avg: 52bpm, 12% above baseline; higher value indicates reduced recovery)')
      expect(output).toContain('Sleep score: 67 (90-day avg: 74, 9% below baseline)')
      expect(output).toContain('Sleep duration: 6h 14m (90-day avg: 7h 22m, 15% below baseline)')
      expect(output).toContain('Deep sleep: 52min (90-day avg: 68min, 24% below baseline)')
      expect(output).toContain('REM sleep: 74min (90-day avg: 101min, 27% below baseline)')
      expect(output).toContain('Sleep efficiency: 84% (90-day avg: 88%)')
      expect(output).toContain('Body temperature deviation: +0.3°C (90-day avg: +0.0°C)')
    })

    test('a delta above the metric\'s report_threshold_pct produces the label', () => {
      // readiness: 61 vs baseline 74 → 18% below (> 8% threshold)
      const output = formatLLMContext({ readinessScore: 61 }, { readinessScore: 74 }, THRESHOLDS)
      expect(output).toContain('18% below baseline')
    })

    test('a delta below the metric\'s report_threshold_pct produces no label', () => {
      // readiness: 73 vs baseline 74 → 1.4% (< 8% threshold) → no label
      const output = formatLLMContext({ readinessScore: 73 }, { readinessScore: 74 }, THRESHOLDS)
      expect(output).not.toContain('below baseline')
      expect(output).not.toContain('above baseline')
      expect(output).toContain('Readiness score: 73 (90-day avg: 74)')
    })

    test('RHR above baseline uses generic "higher value indicates reduced recovery" wording', () => {
      // rhr: 58 vs baseline 52 → 12% above (> 5% threshold), higher_is: 'worse'
      const output = formatLLMContext({ restingHeartRate: 58 }, { restingHeartRate: 52 }, THRESHOLDS)
      expect(output).toContain('above baseline; higher value indicates reduced recovery')
    })

    test('a non-RHR metric with higher_is: worse does not produce "RHR" in the delta label', () => {
      // readinessScore treated as higher_is: 'worse' (hypothetical future config)
      // 80 vs baseline 60 → 33% above (> 5% threshold)
      const customThresholds: WearableThresholds = {
        readinessScore: { report_threshold_pct: 5, higher_is: 'worse' },
      }
      const output = formatLLMContext({ readinessScore: 80 }, { readinessScore: 60 }, customThresholds)
      expect(output).not.toContain('RHR')
    })

    test('HRV above baseline uses "above baseline" with no negative characterization', () => {
      // hrv: 70 vs baseline 58 → 21% above (> 8% threshold), higher_is: 'better'
      const output = formatLLMContext({ hrvAvg: 70 }, { hrvAvg: 58 }, THRESHOLDS)
      expect(output).toContain('above baseline')
      expect(output).not.toContain('recovery signal')
    })

    test('body temperature deviation always shows value and direction without a characterization label', () => {
      const output = formatLLMContext({ bodyTempDeviation: 0.3 }, { bodyTempDeviation: 0 }, THRESHOLDS)
      expect(output).toContain('Body temperature deviation: +0.3°C (90-day avg: +0.0°C)')
      expect(output).not.toContain('above baseline')
      expect(output).not.toContain('below baseline')
    })

    test('todayMetrics null produces the fallback context block with baseline-only and not yet synced note', () => {
      const baseline: WearableBaseline = {
        hrvAvg: 58,
        restingHeartRate: 52,
        sleepScore: 74,
        sleepDurationMinutes: 442,
        deepSleepMinutes: 68,
        remSleepMinutes: 101,
      }
      const output = formatLLMContext(null, baseline, THRESHOLDS)
      expect(output).toContain('Wearable data (Oura Ring):')
      expect(output).toContain("Today's data: not yet synced")
      expect(output).toContain('90-day baselines:')
      expect(output).toContain('HRV 58ms')
      expect(output).toContain('RHR 52bpm')
      expect(output).toContain('Sleep score 74')
      expect(output).toContain('Weight subjective inputs accordingly.')
    })

    test('a metric with null baseline is omitted from output entirely', () => {
      // readinessScore has no baseline → should not appear
      const output = formatLLMContext({ readinessScore: 61, hrvAvg: 42 }, { hrvAvg: 58 }, THRESHOLDS)
      expect(output).toContain('HRV:')
      expect(output).not.toContain('Readiness score:')
    })

    test('no em-dashes appear in any output string under any input combination', () => {
      const today: NormalizedDailyMetric = { readinessScore: 61, bodyTempDeviation: 0.3 }
      const baseline: WearableBaseline = { readinessScore: 74, bodyTempDeviation: 0 }
      expect(formatLLMContext(today, baseline, THRESHOLDS)).not.toContain('—')
      expect(formatLLMContext(null, baseline, THRESHOLDS)).not.toContain('—')
    })

    test('non-null todayMetrics with all-undefined baseline emits a fallback note instead of an empty section', () => {
      const today: NormalizedDailyMetric = { readinessScore: 72, hrvAvg: 55 }
      const output = formatLLMContext(today, {}, THRESHOLDS)
      expect(output).toContain('Wearable data (Oura Ring):')
      expect(output).not.toMatch(/^Wearable data \(Oura Ring\):\s*$/)
      expect(output).toContain('Note: Baseline data is not yet available')
      expect(output).toContain('fewer than 14 days')
    })

    test('non-null todayMetrics with all-undefined baseline does not contain metric lines', () => {
      const today: NormalizedDailyMetric = { readinessScore: 72 }
      const output = formatLLMContext(today, {}, THRESHOLDS)
      expect(output).not.toContain('Readiness score:')
    })
  })

  describe('fetchAndStoreTodayMetrics', () => {
    let userId: string

    beforeEach(async () => {
      await setupTestDb()
      const user = await getTestClient().user.create({ data: { deviceId: 'fetch-store-metrics-test' } })
      userId = user.id
      await getTestClient().wearableConnection.create({
        data: {
          userId,
          provider: 'oura',
          accessToken: 'encrypted-tok',
          refreshToken: 'encrypted-ref',
          tokenExpiresAt: new Date(Date.now() + 86400000),
          status: 'active',
        },
      })
    })

    afterEach(teardownTestDb)

    test('rawData in the upserted row contains the raw Oura API response objects', async () => {
      const MOCK_READINESS = { score: 80, temperature_deviation: 0.2 }
      const MOCK_SLEEP = { score: 70, average_hrv: 45, lowest_resting_heart_rate: 52 }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fetchTodayData).mockResolvedValue({
        metrics: { readinessScore: 80, bodyTempDeviation: 0.2, hrvAvg: 45, restingHeartRate: 52 },
        raw: { readiness: MOCK_READINESS, sleep: MOCK_SLEEP },
      } as any)

      await fetchAndStoreTodayMetrics(userId, 'oura', '2026-07-07')

      const row = await getTestClient().wearableDailyMetric.findFirst({ where: { userId } })
      expect(row?.rawData).toEqual({ readiness: MOCK_READINESS, sleep: MOCK_SLEEP })
    })

    test('connection remains active when initial fetch returns 401, refresh succeeds, but retry also returns 401', async () => {
      vi.mocked(fetchTodayData).mockRejectedValue(new Error('Oura API error: 401'))
      vi.mocked(refreshToken).mockResolvedValue('new-token')

      await fetchAndStoreTodayMetrics(userId, 'oura', '2026-07-07')

      const conn = await getTestClient().wearableConnection.findFirst({ where: { userId } })
      expect(conn?.status).toBe('active')
    })

    test('connection is marked inactive when the refresh token itself is invalid', async () => {
      vi.mocked(fetchTodayData).mockRejectedValue(new Error('Oura API error: 401'))
      vi.mocked(refreshToken).mockRejectedValue(new Error('Oura token refresh failed: 401'))

      await fetchAndStoreTodayMetrics(userId, 'oura', '2026-07-07')

      const conn = await getTestClient().wearableConnection.findFirst({ where: { userId } })
      expect(conn?.status).toBe('inactive')
    })
  })
})
