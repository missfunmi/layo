import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { makeRequest } from '../helpers/api'
import * as handler from '@/app/api/users/route'

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

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
})
