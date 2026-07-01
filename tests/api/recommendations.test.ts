import { describe, test, expect, beforeEach, afterEach } from 'vitest'

import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { makeRequest } from '../helpers/api'
import * as handler from '@/app/api/recommendations/route'

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
        sleepScore: 4,
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
        sleepScore: 2,
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
})
