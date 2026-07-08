import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { makeRequest } from '../helpers/api'
import * as handler from '@/app/api/recommendations/route'

function loggedEvents(consoleLogSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return consoleLogSpy.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))
}

const DEVICE_ID = 'test-device-recommendations'
const TODAY = new Date().toISOString().slice(0, 10)

async function seedTestUser(): Promise<void> {
  const user = await getTestClient().user.create({ data: { deviceId: DEVICE_ID } })
  await getTestClient().userProfile.create({
    data: {
      userId: user.id,
      name: 'Test Athlete',
      birthYear: 1990,
      hormonalLifeStage: ['menstruating'],
      trainingGoal: 'non_race',
    },
  })
}

describe('GET /api/recommendations', () => {
  beforeEach(async () => {
    await setupTestDb()
    await seedTestUser()
  })

  afterEach(teardownTestDb)

  test('recommendation found: returns 200 with recommendationType, modificationDetail, and rationale', async () => {
    const testUser = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    const checkIn = await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(TODAY),
        todaysPlannedWorkout: '5km easy run',
        sleepSatisfaction: 4,
        feelScore: 4,
      },
    })
    await getTestClient().recommendation.create({
      data: {
        checkInId: checkIn.id,
        userId: testUser.id,
        recommendationType: 'as_written',
        modificationDetail: null,
        rationale: 'All signals positive. Execute as planned.',
      },
    })

    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.recommendation).not.toBeNull()
    expect(body.recommendation.recommendationType).toBe('as_written')
    expect(body.recommendation.modificationDetail).toBeNull()
    expect(body.recommendation.rationale).toBe('All signals positive. Execute as planned.')
  })

  test('recommendation found with modificationDetail: returns 200 with modificationDetail populated', async () => {
    const testUser = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    const checkIn = await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(TODAY),
        todaysPlannedWorkout: '10km tempo',
        sleepSatisfaction: 2,
        feelScore: 2,
      },
    })
    await getTestClient().recommendation.create({
      data: {
        checkInId: checkIn.id,
        userId: testUser.id,
        recommendationType: 'modify',
        modificationDetail: 'Drop to 5km easy instead.',
        rationale: 'Low sleep and feel scores indicate fatigue.',
      },
    })

    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.recommendation.recommendationType).toBe('modify')
    expect(body.recommendation.modificationDetail).toBe('Drop to 5km easy instead.')
  })

  test('no recommendation for date: returns 200 with recommendation null', async () => {
    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.recommendation).toBeNull()
  })

  test('returns 401 when X-Device-ID header is missing', async () => {
    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`)
    expect(response.status).toBe(401)
  })

  test('returns 400 when date param is missing', async () => {
    const response = await makeRequest(handler, 'GET', '/api/recommendations', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when date param is invalid', async () => {
    const response = await makeRequest(handler, 'GET', '/api/recommendations?date=not-a-date', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns an x-request-id response header', async () => {
    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('request_end includes deviceId and userId on success', async () => {
    const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(200)
    expect(endEvent?.deviceId).toBe(DEVICE_ID)
    expect(endEvent?.userId).toBe(user.id)
  })

  test('request_end includes deviceId but omits userId on 401 for an unknown device', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`, undefined, {
      'X-Device-ID': 'unknown-device',
    })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(401)
    expect(endEvent?.deviceId).toBe('unknown-device')
    expect(endEvent).not.toHaveProperty('userId')
  })

  test('request_end omits deviceId and userId on 401 when X-Device-ID header is missing entirely', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'GET', `/api/recommendations?date=${TODAY}`)
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(401)
    expect(endEvent).not.toHaveProperty('deviceId')
    expect(endEvent).not.toHaveProperty('userId')
  })
})
