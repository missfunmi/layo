import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { makeRequest } from '../helpers/api'
import * as handler from '@/app/api/profile/route'

function loggedEvents(consoleLogSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return consoleLogSpy.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))
}

const DEVICE_ID = 'test-device-profile'

async function seedPromptConfig(version: string, createdAt: Date): Promise<void> {
  await getTestClient().promptConfig.create({
    data: {
      version,
      systemPrompt: 'You are a fitness coaching assistant.',
      temperature: 0.7,
      maxTokens: 1000,
      createdAt,
    },
  })
}

describe('GET /api/profile', () => {
  beforeEach(setupTestDb)
  afterEach(teardownTestDb)

  test('returns 401 when X-Device-ID header is missing', async () => {
    const res = await makeRequest(handler, 'GET', '/api/profile')
    expect(res.status).toBe(401)
  })

  test('returns 401 when X-Device-ID does not match any user', async () => {
    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': 'unknown-device',
    })
    expect(res.status).toBe(401)
  })

  test('user with no Oura connection: returns userId, ouraConnected false, and promptVersion', async () => {
    const user = await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
    await seedPromptConfig('v1.2.0', new Date('2026-01-01'))

    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ userId: user.id, ouraConnected: false, promptVersion: 'v1.2.0' })
  })

  test('user with an active Oura connection: returns ouraConnected true', async () => {
    const user = await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
    await seedPromptConfig('v1.2.0', new Date('2026-01-01'))
    await getTestClient().wearableConnection.create({
      data: {
        userId: user.id,
        provider: 'oura',
        accessToken: 'tok',
        refreshToken: 'ref',
        tokenExpiresAt: new Date(Date.now() + 86400000),
        status: 'active',
      },
    })

    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ouraConnected).toBe(true)
  })

  test('user with only an inactive Oura connection: returns ouraConnected false', async () => {
    const user = await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
    await getTestClient().wearableConnection.create({
      data: {
        userId: user.id,
        provider: 'oura',
        accessToken: 'tok',
        refreshToken: 'ref',
        tokenExpiresAt: new Date(Date.now() + 86400000),
        status: 'inactive',
      },
    })

    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ouraConnected).toBe(false)
  })

  test('promptVersion reflects the latest prompt config version by created_at', async () => {
    await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
    await seedPromptConfig('v1.0.0', new Date('2026-01-01'))
    await seedPromptConfig('v1.1.0', new Date('2026-02-01'))

    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    const body = await res.json()
    expect(body.promptVersion).toBe('v1.1.0')
  })

  test('returns an x-request-id response header', async () => {
    await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  test('request_end includes deviceId and userId on success', async () => {
    const user = await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(res.status).toBe(200)
    expect(endEvent?.deviceId).toBe(DEVICE_ID)
    expect(endEvent?.userId).toBe(user.id)
  })

  test('request_end includes deviceId but omits userId on 401 for an unknown device', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await makeRequest(handler, 'GET', '/api/profile', undefined, {
      'X-Device-ID': 'unknown-device',
    })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(res.status).toBe(401)
    expect(endEvent?.deviceId).toBe('unknown-device')
    expect(endEvent).not.toHaveProperty('userId')
  })
})
