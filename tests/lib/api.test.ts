import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { resolveUser } from '@/lib/api'

describe('resolveUser', () => {
  beforeEach(setupTestDb)
  afterEach(teardownTestDb)

  test('throws 401 Response when X-Device-ID header is missing', async () => {
    const request = new Request('http://localhost/api/test')
    const error = await resolveUser(request).catch((e) => e)
    expect(error).toBeInstanceOf(Response)
    expect((error as Response).status).toBe(401)
    expect(await (error as Response).json()).toEqual({ error: 'unauthorized' })
  })

  test('throws 401 Response when device ID has no matching user', async () => {
    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Device-ID': 'unknown-device-id' },
    })
    const error = await resolveUser(request).catch((e) => e)
    expect(error).toBeInstanceOf(Response)
    expect((error as Response).status).toBe(401)
    expect(await (error as Response).json()).toEqual({ error: 'unauthorized' })
  })

  test('returns user with profile when device ID matches', async () => {
    const created = await getTestClient().user.create({
      data: {
        deviceId: 'test-device-abc',
        profile: {
          create: {
            name: 'Ada Lovelace',
            birthYear: 1990,
            hormonalLifeStage: ['premenopausal'],
            trainingGoal: 'race',
          },
        },
      },
    })

    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Device-ID': 'test-device-abc' },
    })
    const user = await resolveUser(request)
    expect(user.id).toBe(created.id)
    expect(user.deviceId).toBe('test-device-abc')
    expect(user.profile).not.toBeNull()
    expect(user.profile?.name).toBe('Ada Lovelace')
  })

  test('returns user with null profile when user has no profile', async () => {
    const created = await getTestClient().user.create({
      data: { deviceId: 'no-profile-device' },
    })

    const request = new Request('http://localhost/api/test', {
      headers: { 'X-Device-ID': 'no-profile-device' },
    })
    const user = await resolveUser(request)
    expect(user.id).toBe(created.id)
    expect(user.profile).toBeNull()
  })
})
