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

const DEVICE_ID = 'test-device-callback'
const TEST_KEY = 'a'.repeat(64)

const MOCK_TOKENS = {
  access_token: 'oura-access-token',
  refresh_token: 'oura-refresh-token',
  expires_in: 86400,
}

function buildState(deviceId: string): string {
  return encrypt(JSON.stringify({ nonce: randomUUID(), deviceId }))
}

async function callCallback(params: Record<string, string>): Promise<Response> {
  const query = new URLSearchParams(params).toString()
  let result!: Response
  await testApiHandler({
    appHandler: handler,
    url: `/api/wearables/oura/callback?${query}`,
    test: async ({ fetch }) => {
      result = await fetch({ method: 'GET' })
    },
  } as NtarhInitAppRouter)
  return result
}

describe('GET /api/wearables/oura/callback', () => {
  beforeEach(async () => {
    await setupTestDb()
    process.env.WEARABLE_TOKEN_KEY = TEST_KEY
    process.env.OURA_CLIENT_ID = 'test-client-id'
    process.env.OURA_CLIENT_SECRET = 'test-client-secret'
    process.env.OURA_REDIRECT_URI = 'https://example.com/callback'
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_TOKENS,
      }),
    )
    await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await teardownTestDb()
  })

  test('valid code and valid state redirects to /onboarding?wearable=connected', async () => {
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ code: 'auth-code', state })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=connected')
  })

  test('WearableConnection row is created and associated with the correct user', async () => {
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state })
    const user = await getTestClient().user.findUnique({ where: { deviceId: DEVICE_ID } })
    const connection = await getTestClient().wearableConnection.findUnique({
      where: { userId_provider: { userId: user!.id, provider: 'oura' } },
    })
    expect(connection).not.toBeNull()
    expect(connection!.status).toBe('active')
  })

  test('tokens are stored encrypted in wearable_connections', async () => {
    const state = buildState(DEVICE_ID)
    await callCallback({ code: 'auth-code', state })
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
    await callCallback({ code: 'auth-code', state })
    expect(vi.mocked(fetchHistoricalData)).toHaveBeenCalledOnce()
  })

  test('invalid state redirects to /onboarding?wearable=error and does not write to DB', async () => {
    const res = await callCallback({ code: 'auth-code', state: 'not-a-valid-encrypted-state' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
    const connections = await getTestClient().wearableConnection.findMany()
    expect(connections).toHaveLength(0)
  })

  test('unknown deviceId in state redirects to /onboarding?wearable=error', async () => {
    const state = encrypt(JSON.stringify({ nonce: randomUUID(), deviceId: 'unknown-device-id' }))
    const res = await callCallback({ code: 'auth-code', state })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
  })

  test('Oura token exchange failure redirects to /onboarding?wearable=error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ code: 'auth-code', state })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
  })

  test('missing code param redirects to /onboarding?wearable=error', async () => {
    const state = buildState(DEVICE_ID)
    const res = await callCallback({ state })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/onboarding?wearable=error')
  })
})
