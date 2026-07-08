import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { makeRequest } from '../helpers/api'
import * as handler from '@/app/api/users/route'

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

function loggedEvents(consoleLogSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return consoleLogSpy.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))
}

const CURRENT_YEAR = new Date().getFullYear()

const BASE_BODY = {
  deviceId: 'test-device-abc',
  name: 'Ada Lovelace',
  birthYear: 1990,
  hormonalLifeStage: ['premenopausal'],
  trainingGoal: 'non_race' as const,
}

const RACE_BODY = {
  ...BASE_BODY,
  trainingGoal: 'race' as const,
  eventName: 'Boston Marathon',
  eventType: 'running' as const,
  eventDate: `${CURRENT_YEAR + 1}-06-15`,
}

describe('POST /api/users', () => {
  beforeEach(setupTestDb)
  afterEach(teardownTestDb)

  test('returns 201 with userId, creates user with correct device_id', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(typeof body.userId).toBe('string')
    expect(body.userId.length).toBeGreaterThan(0)

    const users = await getTestClient().user.findMany()
    expect(users).toHaveLength(1)
    expect(users[0].deviceId).toBe('test-device-abc')
    expect(users[0].id).toBe(body.userId)
  })

  test('creates user_profile with correct fields', async () => {
    await makeRequest(handler, 'POST', '/api/users', BASE_BODY)

    const profiles = await getTestClient().userProfile.findMany()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('Ada Lovelace')
    expect(profiles[0].birthYear).toBe(1990)
    expect(profiles[0].hormonalLifeStage).toEqual(['premenopausal'])
    expect(profiles[0].trainingGoal).toBe('non_race')
  })

  test('creates event when trainingGoal is race', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', RACE_BODY)
    expect(response.status).toBe(201)

    const events = await getTestClient().event.findMany()
    expect(events).toHaveLength(1)
    expect(events[0].eventName).toBe('Boston Marathon')
    expect(events[0].eventType).toBe('running')
  })

  test('creates no event when trainingGoal is non_race', async () => {
    await makeRequest(handler, 'POST', '/api/users', BASE_BODY)

    const events = await getTestClient().event.findMany()
    expect(events).toHaveLength(0)
  })

  test('returns 400 when name is missing', async () => {
    const { name: _name, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/users', body)
    expect(response.status).toBe(400)
  })

  test('returns 400 when name is empty string', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...BASE_BODY,
      name: '',
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when name exceeds 50 chars', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...BASE_BODY,
      name: 'A'.repeat(51),
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when birthYear is missing', async () => {
    const { birthYear: _birthYear, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/users', body)
    expect(response.status).toBe(400)
  })

  test('returns 400 when birthYear is too young (currentYear - 12)', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...BASE_BODY,
      birthYear: CURRENT_YEAR - 12,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when birthYear is too old (currentYear - 101)', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...BASE_BODY,
      birthYear: CURRENT_YEAR - 101,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when hormonalLifeStage is empty array', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...BASE_BODY,
      hormonalLifeStage: [],
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when hormonalLifeStage contains an invalid value', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...BASE_BODY,
      hormonalLifeStage: ['not_a_valid_stage'],
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when trainingGoal is missing', async () => {
    const { trainingGoal: _trainingGoal, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/users', body)
    expect(response.status).toBe(400)
  })

  test('returns 400 when trainingGoal is race but eventName is missing', async () => {
    const { eventName: _eventName, ...body } = RACE_BODY
    const response = await makeRequest(handler, 'POST', '/api/users', body)
    expect(response.status).toBe(400)
  })

  test('returns 400 when trainingGoal is race but eventDate is in the past', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...RACE_BODY,
      eventDate: '2020-01-01',
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when trainingGoal is race but eventType is invalid', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...RACE_BODY,
      eventType: 'not_a_valid_type',
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when trainingGoal is race with eventType other but eventTypeOther is missing', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...RACE_BODY,
      eventType: 'other' as const,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when eventName exceeds 100 chars', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', {
      ...RACE_BODY,
      eventName: 'A'.repeat(101),
    })
    expect(response.status).toBe(400)
  })

  test('does not call Sentry.captureMessage on successful user creation', async () => {
    const sentry = await import('@sentry/nextjs')
    vi.mocked(sentry.captureMessage).mockClear()
    await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  test('submitting onboarding twice with the same race details produces one event row', async () => {
    await makeRequest(handler, 'POST', '/api/users', RACE_BODY)
    await makeRequest(handler, 'POST', '/api/users', RACE_BODY)
    const events = await getTestClient().event.findMany()
    expect(events).toHaveLength(1)
  })

  test('submitting onboarding twice with different race details produces one event row reflecting the second submission', async () => {
    await makeRequest(handler, 'POST', '/api/users', RACE_BODY)
    const updated = { ...RACE_BODY, eventName: 'Chicago Marathon', eventDate: `${new Date().getFullYear() + 1}-09-20` }
    await makeRequest(handler, 'POST', '/api/users', updated)
    const events = await getTestClient().event.findMany()
    expect(events).toHaveLength(1)
    expect(events[0].eventName).toBe('Chicago Marathon')
  })

  test('upsert: second identical request returns 201 with same userId, no duplicate row', async () => {
    const r1 = await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    expect(r1.status).toBe(201)
    const { userId: id1 } = await r1.json()

    const r2 = await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    expect(r2.status).toBe(201)
    const { userId: id2 } = await r2.json()

    expect(id1).toBe(id2)

    const users = await getTestClient().user.findMany()
    expect(users).toHaveLength(1)
  })

  test('returns an x-request-id response header', async () => {
    const response = await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('logs request_start and request_end with method, path, and statusCode', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    const events = loggedEvents(consoleLogSpy)
    consoleLogSpy.mockRestore()

    expect(events).toContainEqual(
      expect.objectContaining({ event: 'request_start', method: 'POST', path: '/api/users' })
    )
    expect(events).toContainEqual(expect.objectContaining({ event: 'request_end', statusCode: 201 }))
  })

  test('request_end includes deviceId from the request body and userId from the created user', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    const body = await response.json()
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(201)
    expect(endEvent?.deviceId).toBe(BASE_BODY.deviceId)
    expect(endEvent?.userId).toBe(body.userId)
  })

  test('request_end omits userId (deviceId not yet known) on a validation error before deviceId is read', async () => {
    const { deviceId: _deviceId, ...body } = BASE_BODY
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'POST', '/api/users', body)
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(400)
    expect(endEvent).not.toHaveProperty('deviceId')
    expect(endEvent).not.toHaveProperty('userId')
  })
})

describe('GET /api/users', () => {
  beforeEach(setupTestDb)
  afterEach(teardownTestDb)

  test('returns 200 with user name and hormonalLifeStage', async () => {
    await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    const response = await makeRequest(handler, 'GET', '/api/users', undefined, { 'X-Device-ID': BASE_BODY.deviceId })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.user.name).toBe('Ada Lovelace')
    expect(body.user.hormonalLifeStage).toEqual(['premenopausal'])
  })

  test('returns 401 when X-Device-ID header is missing', async () => {
    const response = await makeRequest(handler, 'GET', '/api/users')
    expect(response.status).toBe(401)
  })

  test('returns 401 when device ID is unknown', async () => {
    const response = await makeRequest(handler, 'GET', '/api/users', undefined, { 'X-Device-ID': 'unknown-device' })
    expect(response.status).toBe(401)
  })

  test('returns 404 when user exists but has no profile', async () => {
    await getTestClient().user.create({ data: { deviceId: 'no-profile-device' } })
    const response = await makeRequest(handler, 'GET', '/api/users', undefined, { 'X-Device-ID': 'no-profile-device' })
    expect(response.status).toBe(404)
  })

  test('returns an x-request-id response header', async () => {
    await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    const response = await makeRequest(handler, 'GET', '/api/users', undefined, { 'X-Device-ID': BASE_BODY.deviceId })
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('request_end includes deviceId and userId on success', async () => {
    await makeRequest(handler, 'POST', '/api/users', BASE_BODY)
    const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: BASE_BODY.deviceId } })

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'GET', '/api/users', undefined, { 'X-Device-ID': BASE_BODY.deviceId })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(200)
    expect(endEvent?.deviceId).toBe(BASE_BODY.deviceId)
    expect(endEvent?.userId).toBe(user.id)
  })

  test('request_end includes deviceId but omits userId on 401 for an unknown device', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'GET', '/api/users', undefined, { 'X-Device-ID': 'unknown-device' })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(401)
    expect(endEvent?.deviceId).toBe('unknown-device')
    expect(endEvent).not.toHaveProperty('userId')
  })

  test('request_end omits deviceId and userId on 401 when X-Device-ID header is missing entirely', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'GET', '/api/users')
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(401)
    expect(endEvent).not.toHaveProperty('deviceId')
    expect(endEvent).not.toHaveProperty('userId')
  })
})
