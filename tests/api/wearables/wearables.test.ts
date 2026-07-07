import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { setupTestDb, teardownTestDb, getTestClient } from '@/tests/helpers/db'
import { makeRequest } from '@/tests/helpers/api'
import * as handler from '@/app/api/wearables/route'

const DEVICE_ID = 'test-device-wearables'

async function seedUserWithConnection(status: 'active' | 'inactive') {
  const user = await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
  await getTestClient().wearableConnection.create({
    data: {
      userId: user.id,
      provider: 'oura',
      accessToken: 'tok',
      refreshToken: 'ref',
      tokenExpiresAt: new Date(Date.now() + 86400000),
      status,
    },
  })
  return user
}

describe('GET /api/wearables', () => {
  beforeEach(setupTestDb)
  afterEach(teardownTestDb)

  test('returns 401 when X-Device-ID header is missing', async () => {
    const res = await makeRequest(handler, 'GET', '/api/wearables')
    expect(res.status).toBe(401)
  })

  test('returns 401 when X-Device-ID does not match any user', async () => {
    const res = await makeRequest(handler, 'GET', '/api/wearables', undefined, {
      'X-Device-ID': 'unknown-device',
    })
    expect(res.status).toBe(401)
  })

  test('user with no connections returns { connections: [] }', async () => {
    await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
    const res = await makeRequest(handler, 'GET', '/api/wearables', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ connections: [] })
  })

  test('user with one active Oura connection returns provider, status, and connectedAt', async () => {
    await seedUserWithConnection('active')
    const res = await makeRequest(handler, 'GET', '/api/wearables', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.connections).toHaveLength(1)
    expect(body.connections[0].provider).toBe('oura')
    expect(body.connections[0].status).toBe('active')
    expect(typeof body.connections[0].connectedAt).toBe('string')
    expect(new Date(body.connections[0].connectedAt).toISOString()).toBe(body.connections[0].connectedAt)
  })

  test('user with one inactive Oura connection returns status inactive', async () => {
    await seedUserWithConnection('inactive')
    const res = await makeRequest(handler, 'GET', '/api/wearables', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.connections).toHaveLength(1)
    expect(body.connections[0].provider).toBe('oura')
    expect(body.connections[0].status).toBe('inactive')
  })
})
