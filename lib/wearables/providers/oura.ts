import { encrypt, decrypt } from '@/lib/crypto'
import { prisma } from '@/lib/db'
import * as Sentry from '@sentry/nextjs'
import type { NormalizedDailyMetric } from '@/lib/wearables/types'

type OuraReadiness = Record<string, unknown> | null | undefined
type OuraSleep = Record<string, unknown> | null | undefined

export function mapToNormalized(ouraReadiness: OuraReadiness, ouraSleep: OuraSleep): NormalizedDailyMetric {
  const readiness = ouraReadiness ?? {}
  const sleep = ouraSleep ?? {}

  const toMinutes = (seconds: unknown): number | undefined => {
    if (typeof seconds !== 'number') return undefined
    return Math.round(seconds / 60)
  }

  const num = (val: unknown): number | undefined =>
    typeof val === 'number' ? val : undefined

  return {
    readinessScore: num(readiness.score),
    bodyTempDeviation: num(readiness.temperature_deviation),
    hrvAvg: num(sleep.average_hrv),
    restingHeartRate: num(sleep.lowest_resting_heart_rate),
    sleepScore: num(sleep.score),
    sleepDurationMinutes: toMinutes(sleep.total_sleep_duration),
    deepSleepMinutes: toMinutes(sleep.deep_sleep_duration),
    remSleepMinutes: toMinutes(sleep.rem_sleep_duration),
    sleepEfficiency: num(sleep.efficiency),
  }
}

export type FetchTodayResult = {
  metrics: NormalizedDailyMetric
  raw: { readiness: unknown; sleep: unknown }
}

export async function fetchTodayData(accessToken: string, date: string): Promise<FetchTodayResult | null> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const params = new URLSearchParams({ start_date: date, end_date: date })
  const base = 'https://api.ouraring.com/v2/usercollection'

  const [readinessRes, sleepRes] = await Promise.all([
    fetch(`${base}/daily_readiness?${params}`, { headers }),
    fetch(`${base}/daily_sleep?${params}`, { headers }),
  ])

  if (!readinessRes.ok || !sleepRes.ok) {
    const status = !readinessRes.ok ? readinessRes.status : sleepRes.status
    throw new Error(`Oura API error: ${status}`)
  }

  const [readinessData, sleepData] = await Promise.all([
    readinessRes.json() as Promise<{ data: unknown[] }>,
    sleepRes.json() as Promise<{ data: unknown[] }>,
  ])

  const readiness = readinessData.data?.[0] ?? null
  const sleep = sleepData.data?.[0] ?? null

  if (!readiness && !sleep) return null

  const metrics = mapToNormalized(readiness as OuraReadiness, sleep as OuraSleep)
  const allUndefined = Object.values(metrics).every((v) => v === undefined)
  if (allUndefined) {
    Sentry.captureMessage('Oura metric dropout: all mapped metrics are undefined despite non-null API response', {
      level: 'error',
      extra: { readiness, sleep },
    })
  }

  return { metrics, raw: { readiness, sleep } }
}

export async function fetchHistoricalData(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<Array<{ date: string } & NormalizedDailyMetric>> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const base = 'https://api.ouraring.com/v2/usercollection'

  const [readinessRes, sleepRes] = await Promise.all([
    fetch(`${base}/daily_readiness?${params}`, { headers }),
    fetch(`${base}/daily_sleep?${params}`, { headers }),
  ])

  if (!readinessRes.ok || !sleepRes.ok) {
    const status = !readinessRes.ok ? readinessRes.status : sleepRes.status
    throw new Error(`Oura API error: ${status}`)
  }

  const [readinessData, sleepData] = await Promise.all([
    readinessRes.json() as Promise<{ data: Array<{ day: string } & Record<string, unknown>> }>,
    sleepRes.json() as Promise<{ data: Array<{ day: string } & Record<string, unknown>> }>,
  ])

  const readinessByDate = new Map(readinessData.data.map((r) => [r.day, r]))
  const sleepByDate = new Map(sleepData.data.map((s) => [s.day, s]))

  const allDates = new Set([...readinessByDate.keys(), ...sleepByDate.keys()])
  return Array.from(allDates).map((date) => ({
    date,
    ...mapToNormalized(
      (readinessByDate.get(date) ?? null) as OuraReadiness,
      (sleepByDate.get(date) ?? null) as OuraSleep,
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
