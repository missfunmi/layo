import { describe, test, expect, beforeEach } from 'vitest'
import { makeRequest } from '@/tests/helpers/api'
import { decrypt } from '@/lib/crypto'
import * as handler from '@/app/api/wearables/oura/authorize/route'

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

  test('returns 200 with authorizationUrl and codeVerifier', async () => {
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
    expect(body).toHaveProperty('codeVerifier')
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
    expect(url.searchParams.get('scope')).toBe('daily.activity daily.readiness daily.sleep heartrate personal')
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

  test('codeVerifier is a non-empty encrypted string', async () => {
    const res = await makeRequest(
      handler,
      'GET',
      '/api/wearables/oura/authorize',
      undefined,
      { 'X-Device-ID': DEVICE_ID },
    )
    const { codeVerifier } = await res.json()

    expect(typeof codeVerifier).toBe('string')
    expect(codeVerifier.length).toBeGreaterThan(0)

    // Must be encrypted format: iv:tag:ciphertext (3 colon-separated hex segments)
    const parts = codeVerifier.split(':')
    expect(parts).toHaveLength(3)

    // Decrypted value should be a non-empty base64url string
    const plainVerifier = decrypt(codeVerifier)
    expect(plainVerifier.length).toBeGreaterThanOrEqual(43)
  })
})
