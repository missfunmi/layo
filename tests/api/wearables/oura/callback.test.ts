vi.mock('@/lib/wearables/providers/oura', () => ({
  fetchHistoricalData: vi.fn().mockResolvedValue([]),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { testApiHandler, type NtarhInitAppRouter } from 'next-test-api-route-handler'
import { randomUUID } from 'node:crypto'
import { setupTestDb, teardownTestDb, getTestClient } from '@/tests/helpers/db'
import { encrypt, decrypt } from '@/lib/crypto'
import { fetchHistoricalData } from '@/lib/wearables/providers/oura'
import * as handler from '@/app/api/wearables/oura/callback/route'

function loggedEvents(consoleLogSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return consoleLogSpy.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))
}

const DEVICE_ID = 'test-device-callback'
const TEST_KEY = 'a'.repeat(64)
const PLAIN_CODE_VERIFIER = 'test-code-verifier-base64url-43chars-padding00'

const MOCK_TOKENS = {
  access_token: 'oura-access-token',
  refresh_token: 'oura-refresh-token',
  expires_in: 86400,
}

function buildState(deviceId: string): string {
  return encrypt(JSON.stringify({ nonce: randomUUID(), deviceId }))
}

function buildPkceCookie(): string {
  return `layo_oura_pkce_verifier=${encrypt(PLAIN_CODE_VERIFIER)}`
}

async function callCallback(params: Record<string, string>, cookie?: string): Promise<Response> {
  const query = new URLSearchParams(params).toString()
  let result!: Response
  await testApiHandler({
    appHandler: handler,
    url: `/api/wearables/oura/callback?${query}`,
    test: async ({ fetch }) => {
      const headers: Record<string, string> = {}
      if (cookie) headers['cookie'] = cookie
      result = await fetch({ method: 'GET', headers })
    },
  } as NtarhInitAppRouter)
  return result
}

describe('GET /api/wearables/oura/callback', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    await setupTestDb()
    process.env.WEARABLE_TOKEN_KEY = TEST_KEY
    process.env.OURA_CLIENT_ID = 'test-client-id'
    process.env.OURA_CLIENT_SECRET = 'test-client-secret'
    process.env.OURA_REDIRECT_URI = 'https://example.com/callback'
    vi.clearAllMocks()
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKENS,
    })
    vi.stubGlobal('fetch', mockFetch)
    await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await teardownTestDb()
  })

  test('valid code and valid state redirects to /onboarding?wearable=connected', async () => {
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=connected')
  })

  test('WearableConnection row is created and associated with the correct user', async () => {
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    const user = await getTestClient().user.findUnique({ where: { deviceId: DEVICE_ID } })
    const connection = await getTestClient().wearableConnection.findUnique({
      where: { userId_provider: { userId: user!.id, provider: 'oura' } },
    })
    expect(connection).not.toBeNull()
    expect(connection!.status).toBe('active')
  })

  test('tokens are stored encrypted in wearable_connections', async () => {
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    const user = await getTestClient().user.findUnique({ where: { deviceId: DEVICE_ID } })
    const connection = await getTestClient().wearableConnection.findFirst({
      where: { userId: user!.id },
    })
    expect(connection!.accessToken.split(':')).toHaveLength(3)
    expect(connection!.refreshToken.split(':')).toHaveLength(3)
    expect(decrypt(connection!.accessToken)).toBe(MOCK_TOKENS.access_token)
    expect(decrypt(connection!.refreshToken)).toBe(MOCK_TOKENS.refresh_token)
  })

  test('fetchHistoricalData is triggered for the 90-day backfill', async () => {
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    expect(vi.mocked(fetchHistoricalData)).toHaveBeenCalledOnce()
  })

  test('token exchange body includes code_verifier from PKCE cookie', async () => {
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    const tokenExchangeCall = mockFetch.mock.calls.find(
      ([url]: [string]) => url === 'https://api.ouraring.com/oauth/token',
    )
    const body = tokenExchangeCall?.[1]?.body as URLSearchParams
    expect(body.get('code_verifier')).toBe(PLAIN_CODE_VERIFIER)
  })

  test('missing PKCE cookie redirects to /onboarding?wearable=error', async () => {
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ code: 'auth-code', state })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
  })

  test('invalid state redirects to /onboarding?wearable=error and does not write to DB', async () => {
    const res = await callCallback(
      { code: 'auth-code', state: 'not-a-valid-encrypted-state' },
      buildPkceCookie(),
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
    const connections = await getTestClient().wearableConnection.findMany()
    expect(connections).toHaveLength(0)
  })

  test('unknown deviceId in state redirects to /onboarding?wearable=error', async () => {
    const state = encrypt(JSON.stringify({ nonce: randomUUID(), deviceId: 'unknown-device-id' }))
    const res = await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
  })

  test('Oura token exchange failure redirects to /onboarding?wearable=error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
  })

  test('missing code param redirects to /onboarding?wearable=error', async () => {
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ state }, buildPkceCookie())
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
  })

  test('returns an x-request-id response header', async () => {
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  test('logs request_start, request_end, state_decrypted, oura_token_exchange, wearable_connection_written, and oura_backfill phases', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    const events = loggedEvents(consoleLogSpy)
    consoleLogSpy.mockRestore()

    expect(events).toContainEqual(
      expect.objectContaining({ event: 'request_start', method: 'GET', path: '/api/wearables/oura/callback' })
    )
    expect(events).toContainEqual(expect.objectContaining({ event: 'request_end', statusCode: 307 }))
    expect(events).toContainEqual(expect.objectContaining({ event: 'state_decrypted' }))
    expect(events).toContainEqual(expect.objectContaining({ event: 'oura_token_exchange', success: true }))
    expect(events).toContainEqual(expect.objectContaining({ event: 'wearable_connection_written', provider: 'oura' }))
    expect(events).toContainEqual(expect.objectContaining({ event: 'oura_backfill_start' }))
    expect(events).toContainEqual(expect.objectContaining({ event: 'oura_backfill_complete', rowsUpserted: 0 }))
  })

  test('logs a matching logError when the backfill fetch throws', async () => {
    vi.mocked(fetchHistoricalData).mockRejectedValueOnce(new Error('Oura API error: 500'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state }, buildPkceCookie())
    const errorEvents = consoleErrorSpy.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))
    consoleErrorSpy.mockRestore()

    expect(errorEvents).toContainEqual(expect.objectContaining({ event: 'oura_backfill_error' }))
  })
})
