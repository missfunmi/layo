import { encrypt, decrypt } from '@/lib/crypto'
import { prisma } from '@/lib/db'
import * as Sentry from '@sentry/nextjs'
import type { NormalizedDailyMetric } from '@/lib/wearables/types'

type OuraReadiness = Record<string, unknown> | null | undefined
type OuraDailySleep = Record<string, unknown> | null | undefined
type OuraSleepPeriod = Record<string, unknown>

const EXCLUDED_SLEEP_PERIOD_TYPES = new Set(['rest', 'deleted'])

function num(val: unknown): number | undefined {
  return typeof val === 'number' ? val : undefined
}

function aggregateSleepPeriods(periods: OuraSleepPeriod[]): Pick<
  NormalizedDailyMetric,
  'hrvAvg' | 'restingHeartRate' | 'sleepDurationMinutes' | 'deepSleepMinutes' | 'remSleepMinutes' | 'sleepEfficiency'
> {
  const contributing = periods.filter((p) => !EXCLUDED_SLEEP_PERIOD_TYPES.has(String(p.type)))

  let totalSleepSum: number | undefined
  let deepSleepSum: number | undefined
  let remSleepSum: number | undefined
  let timeInBedSum: number | undefined
  let hrvWeightedSum = 0
  let hrvWeight = 0
  let restingHeartRate: number | undefined

  for (const period of contributing) {
    const totalSleep = num(period.total_sleep_duration)
    const deepSleep = num(period.deep_sleep_duration)
    const remSleep = num(period.rem_sleep_duration)
    const timeInBed = num(period.time_in_bed)
    const averageHrv = num(period.average_hrv)
    const lowestHeartRate = num(period.lowest_heart_rate)

    if (totalSleep !== undefined) totalSleepSum = (totalSleepSum ?? 0) + totalSleep
    if (deepSleep !== undefined) deepSleepSum = (deepSleepSum ?? 0) + deepSleep
    if (remSleep !== undefined) remSleepSum = (remSleepSum ?? 0) + remSleep
    if (timeInBed !== undefined) timeInBedSum = (timeInBedSum ?? 0) + timeInBed
    if (averageHrv !== undefined && totalSleep !== undefined) {
      hrvWeightedSum += averageHrv * totalSleep
      hrvWeight += totalSleep
    }
    if (lowestHeartRate !== undefined) {
      restingHeartRate = restingHeartRate === undefined ? lowestHeartRate : Math.min(restingHeartRate, lowestHeartRate)
    }
  }

  return {
    hrvAvg: hrvWeight > 0 ? hrvWeightedSum / hrvWeight : undefined,
    restingHeartRate,
    sleepDurationMinutes: totalSleepSum !== undefined ? Math.round(totalSleepSum / 60) : undefined,
    deepSleepMinutes: deepSleepSum !== undefined ? Math.round(deepSleepSum / 60) : undefined,
    remSleepMinutes: remSleepSum !== undefined ? Math.round(remSleepSum / 60) : undefined,
    sleepEfficiency:
      totalSleepSum !== undefined && timeInBedSum !== undefined && timeInBedSum > 0
        ? (totalSleepSum / timeInBedSum) * 100
        : undefined,
  }
}

export function mapToNormalized(
  ouraReadiness: OuraReadiness,
  ouraDailySleep: OuraDailySleep,
  ouraSleepPeriods: OuraSleepPeriod[] | null | undefined,
): NormalizedDailyMetric {
  const readiness = ouraReadiness ?? {}
  const dailySleep = ouraDailySleep ?? {}
  const periods = ouraSleepPeriods ?? []

  return {
    readinessScore: num(readiness.score),
    bodyTempDeviation: num(readiness.temperature_deviation),
    sleepScore: num(dailySleep.score),
    ...aggregateSleepPeriods(periods),
  }
}

export type FetchTodayResult = {
  metrics: NormalizedDailyMetric
  raw: { readiness: unknown; dailySleep: unknown; sleepPeriods: unknown }
}

async function throwOnFirstFailedResponse(responses: Response[]): Promise<void> {
  const failedRes = responses.find((res) => !res.ok)
  if (!failedRes) return
  const status = failedRes.status
  let detail = ''
  try { detail = await failedRes.text() } catch { /* ignore */ }
  throw new Error(`Oura API error: ${status}${detail ? ` ${detail}` : ''}`)
}

export async function fetchTodayData(accessToken: string, date: string): Promise<FetchTodayResult | null> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const params = new URLSearchParams({ start_date: date, end_date: date })
  const base = 'https://api.ouraring.com/v2/usercollection'

  const [readinessRes, dailySleepRes, sleepRes] = await Promise.all([
    fetch(`${base}/daily_readiness?${params}`, { headers }),
    fetch(`${base}/daily_sleep?${params}`, { headers }),
    fetch(`${base}/sleep?${params}`, { headers }),
  ])

  await throwOnFirstFailedResponse([readinessRes, dailySleepRes, sleepRes])

  const [readinessData, dailySleepData, sleepData] = await Promise.all([
    readinessRes.json() as Promise<{ data: unknown[] }>,
    dailySleepRes.json() as Promise<{ data: unknown[] }>,
    sleepRes.json() as Promise<{ data: OuraSleepPeriod[] }>,
  ])

  const readiness = readinessData.data?.[0] ?? null
  const dailySleep = dailySleepData.data?.[0] ?? null
  const sleepPeriods = (sleepData.data ?? []).filter((p) => p.day === date)

  if (!readiness && !dailySleep && sleepPeriods.length === 0) return null

  const metrics = mapToNormalized(readiness as OuraReadiness, dailySleep as OuraDailySleep, sleepPeriods)
  const allUndefined = Object.values(metrics).every((v) => v === undefined)
  if (allUndefined) {
    Sentry.captureMessage('Oura metric dropout: all mapped metrics are undefined despite non-null API response', {
      level: 'error',
      extra: { readiness, dailySleep, sleepPeriods },
    })
  }

  return { metrics, raw: { readiness, dailySleep, sleepPeriods } }
}

export async function fetchHistoricalData(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<Array<{ date: string } & NormalizedDailyMetric>> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const base = 'https://api.ouraring.com/v2/usercollection'

  const [readinessRes, dailySleepRes, sleepRes] = await Promise.all([
    fetch(`${base}/daily_readiness?${params}`, { headers }),
    fetch(`${base}/daily_sleep?${params}`, { headers }),
    fetch(`${base}/sleep?${params}`, { headers }),
  ])

  await throwOnFirstFailedResponse([readinessRes, dailySleepRes, sleepRes])

  const [readinessData, dailySleepData, sleepData] = await Promise.all([
    readinessRes.json() as Promise<{ data: Array<{ day: string } & Record<string, unknown>> }>,
    dailySleepRes.json() as Promise<{ data: Array<{ day: string } & Record<string, unknown>> }>,
    sleepRes.json() as Promise<{ data: Array<{ day: string } & OuraSleepPeriod> }>,
  ])

  const readinessByDate = new Map(readinessData.data.map((r) => [r.day, r]))
  const dailySleepByDate = new Map(dailySleepData.data.map((s) => [s.day, s]))
  const sleepPeriodsByDate = new Map<string, OuraSleepPeriod[]>()
  for (const period of sleepData.data) {
    const existing = sleepPeriodsByDate.get(period.day) ?? []
    existing.push(period)
    sleepPeriodsByDate.set(period.day, existing)
  }

  const allDates = new Set([...readinessByDate.keys(), ...dailySleepByDate.keys(), ...sleepPeriodsByDate.keys()])
  return Array.from(allDates).map((date) => ({
    date,
    ...mapToNormalized(
      (readinessByDate.get(date) ?? null) as OuraReadiness,
      (dailySleepByDate.get(date) ?? null) as OuraDailySleep,
      sleepPeriodsByDate.get(date) ?? null,
    ),
  }))
}

export async function refreshToken(userId: string): Promise<string> {
  const connection = await prisma.wearableConnection.findUnique({
    where: { userId_provider: { userId, provider: 'oura' } },
  })
  if (!connection) throw new Error(`No Oura connection found for user ${userId}`)

  const refreshTokenValue = decrypt(connection.refreshToken)

  const res = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: process.env.OURA_CLIENT_ID ?? '',
      client_secret: process.env.OURA_CLIENT_SECRET ?? '',
    }),
  })

  if (!res.ok) {
    await prisma.wearableConnection.update({
      where: { userId_provider: { userId, provider: 'oura' } },
      data: { status: 'inactive' },
    })
    const err = new Error(`Oura token refresh failed: ${res.status}`)
    Sentry.captureException(err)
    throw err
  }

  const tokens = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }

  await prisma.wearableConnection.update({
    where: { userId_provider: { userId, provider: 'oura' } },
    data: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  })

  return tokens.access_token
}
