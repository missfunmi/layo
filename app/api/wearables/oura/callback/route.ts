import { NextRequest, NextResponse } from 'next/server'
import { decrypt, encrypt } from '@/lib/crypto'
import { prisma } from '@/lib/db'
import { fetchHistoricalData } from '@/lib/wearables/providers/oura'
import * as Sentry from '@sentry/nextjs'

const PROVIDER = 'oura' as const

function errorRedirect(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/onboarding?wearable=error', req.url))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')

  if (!code) {
    return errorRedirect(req)
  }

  let deviceId: string
  try {
    const decrypted = decrypt(stateParam ?? '')
    const state = JSON.parse(decrypted) as { nonce: string; deviceId: string }
    if (!state.deviceId) throw new Error('Missing deviceId in state')
    deviceId = state.deviceId
  } catch {
    return errorRedirect(req)
  }

  let userId: string
  try {
    const user = await prisma.user.findUnique({ where: { deviceId } })
    if (!user) return errorRedirect(req)
    userId = user.id
  } catch {
    return errorRedirect(req)
  }

  let accessToken: string
  let refreshToken: string
  let expiresIn: number
  try {
    const res = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.OURA_CLIENT_ID ?? '',
        client_secret: process.env.OURA_CLIENT_SECRET ?? '',
        redirect_uri: process.env.OURA_REDIRECT_URI ?? '',
      }),
    })
    if (!res.ok) return errorRedirect(req)
    const tokens = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }
    accessToken = tokens.access_token
    refreshToken = tokens.refresh_token
    expiresIn = tokens.expires_in
  } catch {
    return errorRedirect(req)
  }

  const encryptedAccess = encrypt(accessToken)
  const encryptedRefresh = encrypt(refreshToken)
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)

  let connectionId: string
  try {
    const connection = await prisma.wearableConnection.upsert({
      where: { userId_provider: { userId, provider: PROVIDER } },
      create: {
        userId,
        provider: PROVIDER,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        status: 'active',
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        status: 'active',
      },
    })
    connectionId = connection.id
  } catch {
    return errorRedirect(req)
  }

  try {
    const today = new Date()
    const endDate = today.toISOString().slice(0, 10)
    const startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const metrics = await fetchHistoricalData(accessToken, startDate, endDate)

    await Promise.all(
      metrics.map(({ date, ...metricData }) =>
        prisma.wearableDailyMetric.upsert({
          where: { userId_provider_metricDate: { userId, provider: PROVIDER, metricDate: new Date(date) } },
          create: {
            userId,
            connectionId,
            provider: PROVIDER,
            metricDate: new Date(date),
            rawData: {},
            ...metricData,
          },
          update: metricData,
        }),
      ),
    )
  } catch (err) {
    Sentry.captureException(err)
  }

  return NextResponse.redirect(new URL('/onboarding?wearable=connected', req.url))
}
