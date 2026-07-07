import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { fetchTodayData, refreshToken } from '@/lib/wearables/providers/oura'
import * as Sentry from '@sentry/nextjs'
import type { NormalizedDailyMetric, WearableBaseline, WearableThresholds } from '@/lib/wearables/types'
import type { WearableProvider } from '@prisma/client'

export async function fetchAndStoreTodayMetrics(
  userId: string,
  provider: WearableProvider,
  checkInDate: string,
): Promise<NormalizedDailyMetric | null> {
  const connection = await prisma.wearableConnection.findUnique({
    where: { userId_provider: { userId, provider } },
  })
  if (!connection || connection.status !== 'active') return null

  const accessToken = decrypt(connection.accessToken)

  const attempt = async (token: string) => {
    return fetchTodayData(token, checkInDate)
  }

  let result: Awaited<ReturnType<typeof fetchTodayData>> = null
  try {
    result = await attempt(accessToken)
  } catch (err: unknown) {
    const isUnauthorized =
      err instanceof Error && err.message.includes('401')
    if (!isUnauthorized) {
      Sentry.captureException(err)
      return null
    }
    try {
      const newToken = await refreshToken(userId)
      result = await attempt(newToken)
    } catch (refreshErr) {
      Sentry.captureException(refreshErr)
      await prisma.wearableConnection.update({
        where: { userId_provider: { userId, provider } },
        data: { status: 'inactive' },
      })
      return null
    }
  }

  if (!result) return null

  const metricDate = new Date(checkInDate)
  await prisma.wearableDailyMetric.upsert({
    where: { userId_provider_metricDate: { userId, provider, metricDate } },
    create: {
      userId,
      connectionId: connection.id,
      provider,
      metricDate,
      rawData: result.raw,
      ...result.metrics,
    },
    update: { rawData: result.raw, ...result.metrics },
  })

  return result.metrics
}

const METRIC_KEYS: (keyof NormalizedDailyMetric)[] = [
  'readinessScore',
  'hrvAvg',
  'restingHeartRate',
  'sleepScore',
  'sleepDurationMinutes',
  'deepSleepMinutes',
  'remSleepMinutes',
  'sleepEfficiency',
  'bodyTempDeviation',
]

const MIN_BASELINE_ROWS = 14
const BASELINE_WINDOW_DAYS = 90

export async function computeBaseline(
  userId: string,
  provider: WearableProvider,
): Promise<WearableBaseline> {
  const since = new Date(Date.now() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const rows = await prisma.wearableDailyMetric.findMany({
    where: { userId, provider, metricDate: { gte: since } },
  })

  const baseline: WearableBaseline = {}
  for (const key of METRIC_KEYS) {
    const values = rows
      .map((r) => r[key as keyof typeof r] as number | null)
      .filter((v): v is number => v !== null)
    baseline[key] = values.length >= MIN_BASELINE_ROWS
      ? values.reduce((a, b) => a + b, 0) / values.length
      : undefined
  }
  return baseline
}

// --- formatLLMContext helpers ---

function fmtHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function fmtSign(val: number, decimals = 1): string {
  return (val >= 0 ? '+' : '') + val.toFixed(decimals)
}

type MetricDef = {
  key: keyof NormalizedDailyMetric
  label: string
  fullFormat: (v: number) => string
  fallbackLabel: string
  fallbackFormat: (v: number) => string
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: 'readinessScore',
    label: 'Readiness score',
    fullFormat: (v) => String(Math.round(v)),
    fallbackLabel: 'Readiness',
    fallbackFormat: (v) => String(Math.round(v)),
  },
  {
    key: 'hrvAvg',
    label: 'HRV',
    fullFormat: (v) => `${Math.round(v)}ms`,
    fallbackLabel: 'HRV',
    fallbackFormat: (v) => `${Math.round(v)}ms`,
  },
  {
    key: 'restingHeartRate',
    label: 'Resting heart rate',
    fullFormat: (v) => `${Math.round(v)}bpm`,
    fallbackLabel: 'RHR',
    fallbackFormat: (v) => `${Math.round(v)}bpm`,
  },
  {
    key: 'sleepScore',
    label: 'Sleep score',
    fullFormat: (v) => String(Math.round(v)),
    fallbackLabel: 'Sleep score',
    fallbackFormat: (v) => String(Math.round(v)),
  },
  {
    key: 'sleepDurationMinutes',
    label: 'Sleep duration',
    fullFormat: (v) => fmtHM(Math.round(v)),
    fallbackLabel: 'Sleep duration',
    fallbackFormat: (v) => fmtHM(Math.round(v)),
  },
  {
    key: 'deepSleepMinutes',
    label: 'Deep sleep',
    fullFormat: (v) => `${Math.round(v)}min`,
    fallbackLabel: 'Deep sleep',
    fallbackFormat: (v) => fmtHM(Math.round(v)),
  },
  {
    key: 'remSleepMinutes',
    label: 'REM sleep',
    fullFormat: (v) => `${Math.round(v)}min`,
    fallbackLabel: 'REM',
    fallbackFormat: (v) => fmtHM(Math.round(v)),
  },
  {
    key: 'sleepEfficiency',
    label: 'Sleep efficiency',
    fullFormat: (v) => `${Math.round(v)}%`,
    fallbackLabel: 'Sleep efficiency',
    fallbackFormat: (v) => `${Math.round(v)}%`,
  },
  {
    key: 'bodyTempDeviation',
    label: 'Body temperature deviation',
    fullFormat: (v) => `${fmtSign(v, 1)}°C`,
    fallbackLabel: 'Body temp',
    fallbackFormat: (v) => `${fmtSign(v, 1)}°C`,
  },
]

export function formatLLMContext(
  todayMetrics: NormalizedDailyMetric | null,
  baseline: WearableBaseline,
  thresholds: WearableThresholds,
): string {
  const lines: string[] = ['Wearable data (Oura Ring):']

  if (!todayMetrics) {
    lines.push("Today's data: not yet synced")

    const baselineParts: string[] = []
    for (const def of METRIC_DEFS) {
      const avg = baseline[def.key]
      if (avg === undefined || avg === null) continue
      baselineParts.push(`${def.fallbackLabel} ${def.fallbackFormat(avg)}`)
    }
    if (baselineParts.length > 0) {
      lines.push(`90-day baselines: ${baselineParts.join(' | ')}`)
    }
    lines.push('Note: Device data for today is not yet available. Weight subjective inputs accordingly.')
    return lines.join('\n')
  }

  for (const def of METRIC_DEFS) {
    const today = todayMetrics[def.key]
    const avg = baseline[def.key]
    if (today === undefined || today === null) continue
    if (avg === undefined || avg === null) continue

    const threshold = thresholds[def.key]
    const todayFmt = def.fullFormat(today)
    const avgFmt = def.fullFormat(avg)

    let deltaLabel = ''
    if (threshold?.report_threshold_pct !== null && threshold?.report_threshold_pct !== undefined && avg !== 0) {
      const exactDeltaPct = Math.abs(today - avg) / Math.abs(avg) * 100
      const displayDeltaPct = Math.round(exactDeltaPct)
      if (exactDeltaPct > threshold.report_threshold_pct) {
        const direction = today > avg ? 'above' : 'below'
        if (direction === 'above' && threshold.higher_is === 'worse') {
          deltaLabel = `, ${displayDeltaPct}% above baseline; higher value indicates reduced recovery`
        } else {
          deltaLabel = `, ${displayDeltaPct}% ${direction} baseline`
        }
      }
    }

    lines.push(`${def.label}: ${todayFmt} (90-day avg: ${avgFmt}${deltaLabel})`)
  }

  if (lines.length === 1) {
    lines.push('Note: Baseline data is not yet available (fewer than 14 days of data). Raw metrics are available but delta comparisons cannot be computed yet.')
  }

  return lines.join('\n')
}
