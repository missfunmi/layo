import { NextRequest, NextResponse } from 'next/server'
import { decrypt, encrypt } from '@/lib/crypto'
import { prisma } from '@/lib/db'
import { fetchHistoricalData } from '@/lib/wearables/providers/oura'
import * as Sentry from '@sentry/nextjs'
import { logCtx, logErrorCtx, startRequest, endRequest, type RequestContext } from '@/lib/logger'

const PROVIDER = 'oura' as const

function errorRedirect(req: NextRequest, ctx: RequestContext): NextResponse {
  return endRequest(NextResponse.redirect(new URL('/onboarding?wearable=error', req.url)), ctx)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = startRequest(req, 'GET', '/api/wearables/oura/callback')

  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')

  if (!code) {
    return errorRedirect(req, ctx)
  }

  let deviceId: string
  try {
    const decrypted = decrypt(stateParam ?? '')
    const state = JSON.parse(decrypted) as { nonce: string; deviceId: string }
    if (!state.deviceId) throw new Error('Missing deviceId in state')
    deviceId = state.deviceId
  } catch {
    return errorRedirect(req, ctx)
  }
  ctx.deviceId = deviceId

  const pkceCookieValue = req.cookies.get('layo_oura_pkce_verifier')?.value
  if (!pkceCookieValue) return errorRedirect(req, ctx)
  const codeVerifier = decrypt(pkceCookieValue)

  let userId: string
  try {
    const user = await prisma.user.findUnique({ where: { deviceId } })
    if (!user) return errorRedirect(req, ctx)
    userId = user.id
  } catch {
    return errorRedirect(req, ctx)
  }
  ctx.userId = userId
  logCtx(ctx, { event: 'state_decrypted' })

  let accessToken: string
  let refreshToken: string
  let expiresIn: number
  const tokenExchangeStart = performance.now()
  try {
    const res = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        client_id: process.env.OURA_CLIENT_ID ?? '',
        client_secret: process.env.OURA_CLIENT_SECRET ?? '',
        redirect_uri: process.env.OURA_REDIRECT_URI ?? '',
      }),
    })
    if (!res.ok) {
      logCtx(ctx, {
        event: 'oura_token_exchange',
        success: false,
        latencyMs: Math.round(performance.now() - tokenExchangeStart),
      })
      return errorRedirect(req, ctx)
    }
    const tokens = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }
    accessToken = tokens.access_token
    refreshToken = tokens.refresh_token
    expiresIn = tokens.expires_in
    logCtx(ctx, {
      event: 'oura_token_exchange',
      success: true,
      latencyMs: Math.round(performance.now() - tokenExchangeStart),
    })
  } catch {
    logCtx(ctx, {
      event: 'oura_token_exchange',
      success: false,
      latencyMs: Math.round(performance.now() - tokenExchangeStart),
    })
    return errorRedirect(req, ctx)
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
    return errorRedirect(req, ctx)
  }
  logCtx(ctx, { event: 'wearable_connection_written', provider: PROVIDER })

  logCtx(ctx, { event: 'oura_backfill_start' })
  const backfillStart = performance.now()
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
    logCtx(ctx, {
      event: 'oura_backfill_complete',
      rowsUpserted: metrics.length,
      latencyMs: Math.round(performance.now() - backfillStart),
    })
  } catch (err) {
    Sentry.captureException(err)
    logErrorCtx(ctx, { event: 'oura_backfill_error' })
  }

  return endRequest(NextResponse.redirect(new URL('/onboarding?wearable=connected', req.url)), ctx)
}
