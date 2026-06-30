import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/llm/index', () => ({
  generateRecommendation: vi.fn(),
}))

import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { makeRequest } from '../helpers/api'
import * as handler from '@/app/api/check-ins/route'
import { generateRecommendation } from '@/lib/llm/index'

const DEVICE_ID = 'test-device-checkin'
const TODAY = new Date().toISOString().slice(0, 10)

const MOCK_RECOMMENDATION = {
  recommendationType: 'as_written' as const,
  modificationDetail: null,
  rationale: 'You slept well and feel great. Execute as planned.',
  rationaleInternal: 'Sleep 4, feel 4. All signals positive.',
  readinessScore: 80,
  promptVersion: 'test-v1',
}

const BASE_BODY = {
  checkInDate: TODAY,
  todaysPlannedWorkout: '5km easy run',
  sleepScore: 4,
  feelScore: 4,
}

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

describe('POST /api/check-ins', () => {
  beforeEach(async () => {
    await setupTestDb()
    vi.clearAllMocks()
    vi.mocked(generateRecommendation).mockResolvedValue(MOCK_RECOMMENDATION)
    await seedTestUser()
  })

  afterEach(teardownTestDb)

  test('happy path: returns 201 with recommendation fields, creates check_in, recommendation, and llm_inference_log rows', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.recommendationType).toBe('as_written')
    expect(body.modificationDetail).toBeNull()
    expect(body.rationale).toBe('You slept well and feel great. Execute as planned.')

    const checkIns = await getTestClient().checkIn.findMany()
    expect(checkIns).toHaveLength(1)

    const recommendations = await getTestClient().recommendation.findMany()
    expect(recommendations).toHaveLength(1)

    const logs = await getTestClient().llmInferenceLog.findMany()
    expect(logs).toHaveLength(1)
  })

  test('returns 401 when X-Device-ID header is missing', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY)
    expect(response.status).toBe(401)
  })

  test('returns 400 when checkInDate is more than 1 day in the future', async () => {
    const twoDaysOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, checkInDate: twoDaysOut },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when todaysPlannedWorkout is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { todaysPlannedWorkout: _, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/check-ins', body, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when todaysPlannedWorkout exceeds 280 chars', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, todaysPlannedWorkout: 'a'.repeat(281) },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when sleepScore is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sleepScore: _, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/check-ins', body, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when sleepScore is 0', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, sleepScore: 0 },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when sleepScore is 6', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, sleepScore: 6 },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when feelScore is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { feelScore: _, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/check-ins', body, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when feelScore is 0', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, feelScore: 0 },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when feelScore is 6', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, feelScore: 6 },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when todaysPlannedWorkout is an empty string', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, todaysPlannedWorkout: '' },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when todaysPlannedWorkout is whitespace-only', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, todaysPlannedWorkout: '   ' },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when yesterdayWorkoutType is not an allowed value', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, yesterdayWorkoutType: 'skipped' },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when yesterdayWorkoutType is other but yesterdayWorkoutDescription is missing', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, yesterdayWorkoutType: 'other' },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when yesterdayWorkoutType is other and yesterdayWorkoutDescription exceeds 280 chars', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, yesterdayWorkoutType: 'other', yesterdayWorkoutDescription: 'a'.repeat(281) },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when yesterdayWorkoutFeedback exceeds 280 chars', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, yesterdayWorkoutFeedback: 'a'.repeat(281) },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when stressors exceeds 280 chars', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, stressors: 'a'.repeat(281) },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when periodStartedToday is a non-boolean value', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, periodStartedToday: 'yes' },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('LLM throws before check-in is saved: returns 503 with checkInSaved false and no row in check_ins', async () => {
    vi.mocked(generateRecommendation).mockRejectedValue(new Error('LLM timeout'))

    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error).toBe('recommendation_failed')
    expect(body.checkInSaved).toBe(false)

    const checkIns = await getTestClient().checkIn.findMany()
    expect(checkIns).toHaveLength(0)
  })

  test('LLM throws after check-in is saved: returns 503 with checkInSaved true and row exists in check_ins', async () => {
    // First submission succeeds, saving the check-in
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })

    // Retry with LLM failing
    vi.mocked(generateRecommendation).mockRejectedValue(new Error('LLM timeout'))
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error).toBe('recommendation_failed')
    expect(body.checkInSaved).toBe(true)

    const checkIns = await getTestClient().checkIn.findMany()
    expect(checkIns).toHaveLength(1)
  })

  test('upsert: second submission for same date overwrites first, returns new recommendation, only 1 row in check_ins', async () => {
    // First submission
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })

    // Second submission with different planned workout
    vi.mocked(generateRecommendation).mockResolvedValueOnce({
      ...MOCK_RECOMMENDATION,
      rationale: 'Strong signals. Go for it.',
    })
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, todaysPlannedWorkout: '10km tempo run' },
      { 'X-Device-ID': DEVICE_ID }
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.rationale).toBe('Strong signals. Go for it.')

    const checkIns = await getTestClient().checkIn.findMany()
    expect(checkIns).toHaveLength(1)
    expect(checkIns[0].todaysPlannedWorkout).toBe('10km tempo run')
  })
})
