import { describe, test, expect, beforeEach, vi } from 'vitest'
import { makeRequest } from '@/tests/helpers/api'
import { decrypt } from '@/lib/crypto'
import * as handler from '@/app/api/wearables/oura/authorize/route'

function loggedEvents(consoleLogSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return consoleLogSpy.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))
}

const DEVICE_ID = 'test-device-authorize'
const TEST_KEY = 'a'.repeat(64) // 32-byte hex key

beforeEach(() => {
  process.env.WEARABLE_TOKEN_KEY = TEST_KEY
  process.env.OURA_CLIENT_ID = 'test-client-id'
  process.env.OURA_REDIRECT_URI = 'https://example.com/callback'
})

describe('GET /api/wearables/oura/authorize', () => {
  test('returns 401 when X-Device-ID header is missing', async () => {
    const res = await makeRequest(handler, 'GET', '/api/wearables/oura/authorize')
    expect(res.status).toBe(401)
  })

  test('returns 200 with authorizationUrl', async () => {
    const res = await makeRequest(
      handler,
      'GET',
      '/api/wearables/oura/authorize',
      undefined,
      { 'X-Device-ID': DEVICE_ID },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('authorizationUrl')
    expect(body).not.toHaveProperty('codeVerifier')
  })

  test('authorizationUrl contains all required OAuth parameters', async () => {
    const res = await makeRequest(
      handler,
      'GET',
      '/api/wearables/oura/authorize',
      undefined,
      { 'X-Device-ID': DEVICE_ID },
    )
    const { authorizationUrl } = await res.json()
    const url = new URL(authorizationUrl)

    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('daily heartrate personal')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBeTruthy()
  })

  test('state parameter decrypts to JSON with nonce (UUID) and deviceId', async () => {
    const res = await makeRequest(
      handler,
      'GET',
      '/api/wearables/oura/authorize',
      undefined,
      { 'X-Device-ID': DEVICE_ID },
    )
    const { authorizationUrl } = await res.json()
    const url = new URL(authorizationUrl)
    const encryptedState = url.searchParams.get('state')!

    const stateJson = decrypt(encryptedState)
    const state = JSON.parse(stateJson)

    expect(state.deviceId).toBe(DEVICE_ID)
    expect(state.nonce).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  test('sets layo_oura_pkce_verifier HTTP-only cookie with encrypted code verifier', async () => {
    const res = await makeRequest(
      handler,
      'GET',
      '/api/wearables/oura/authorize',
      undefined,
      { 'X-Device-ID': DEVICE_ID },
    )
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('layo_oura_pkce_verifier=')
    expect(setCookie.toLowerCase()).toContain('httponly')

    // Extract and verify the encrypted verifier value (Next.js may percent-encode ':' in the cookie)
    const rawCookieValue = setCookie.split(';')[0].replace('layo_oura_pkce_verifier=', '')
    const cookieValue = decodeURIComponent(rawCookieValue)
    expect(cookieValue.split(':')).toHaveLength(3)
    const plainVerifier = decrypt(cookieValue)
    expect(plainVerifier.length).toBeGreaterThanOrEqual(43)
  })

  test('returns an x-request-id response header', async () => {
    const res = await makeRequest(handler, 'GET', '/api/wearables/oura/authorize', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  test('logs request_start, request_end, and pkce_generated', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await makeRequest(handler, 'GET', '/api/wearables/oura/authorize', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    const events = loggedEvents(consoleLogSpy)
    consoleLogSpy.mockRestore()

    expect(events).toContainEqual(
      expect.objectContaining({ event: 'request_start', method: 'GET', path: '/api/wearables/oura/authorize' })
    )
    expect(events).toContainEqual(expect.objectContaining({ event: 'request_end', statusCode: 200 }))
    expect(events).toContainEqual(expect.objectContaining({ event: 'pkce_generated', userId: DEVICE_ID }))
  })
})
