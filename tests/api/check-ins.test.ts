import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/llm/index', () => ({
  generateRecommendation: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('@/lib/wearables/index', () => ({
  fetchAndStoreTodayMetrics: vi.fn(),
  computeBaseline: vi.fn(),
  formatLLMContext: vi.fn(),
}))

import { setupTestDb, teardownTestDb, getTestClient } from '../helpers/db'
import { makeRequest } from '../helpers/api'
import * as handler from '@/app/api/check-ins/route'
import * as recommendationsHandler from '@/app/api/recommendations/route'
import { generateRecommendation } from '@/lib/llm/index'
import { fetchAndStoreTodayMetrics, computeBaseline, formatLLMContext } from '@/lib/wearables/index'

function loggedEvents(consoleLogSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return consoleLogSpy.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string))
}

const DEVICE_ID = 'test-device-checkin'
const TODAY = new Date().toISOString().slice(0, 10)
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const MOCK_RECOMMENDATION = {
  recommendationType: 'as_written' as const,
  modificationDetail: null,
  rationale: 'You slept well and feel great. Execute as planned.',
  rationaleInternal: 'Sleep 4, feel 4. All signals positive.',
  readinessScore: 80,
  promptVersion: 'test-v1',
  inputTokens: 100,
  outputTokens: 50,
  latencyMs: 1200,
}

const BASE_BODY = {
  checkInDate: TODAY,
  todaysPlannedWorkout: '5km easy run',
  sleepSatisfaction: 4,
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

describe('POST /api/check-ins request tracing', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    await setupTestDb()
    vi.clearAllMocks()
    vi.mocked(generateRecommendation).mockResolvedValue(MOCK_RECOMMENDATION)
    await seedTestUser()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    consoleLogSpy.mockRestore()
    await teardownTestDb()
  })

  test('returns an x-request-id response header on success', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(201)
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('returns an x-request-id response header on a validation error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { todaysPlannedWorkout: _, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/check-ins', body, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('returns an x-request-id response header on 401', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY)
    expect(response.status).toBe(401)
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('generates a correlationId and persists it to llm_inference_logs when x-correlation-id header is absent', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(201)

    const inferenceLog = await getTestClient().llmInferenceLog.findFirstOrThrow()
    expect(inferenceLog.correlationId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/))
  })

  test('uses the x-correlation-id request header when provided, and persists it to llm_inference_logs', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
      'x-correlation-id': 'my-correlation-id',
    })
    expect(response.status).toBe(201)

    const startEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_start')
    expect(startEvent?.correlationId).toBe('my-correlation-id')

    const inferenceLog = await getTestClient().llmInferenceLog.findFirstOrThrow()
    expect(inferenceLog.correlationId).toBe('my-correlation-id')
  })

  test('logs request_start and request_end with method, path, and statusCode', async () => {
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })

    const events = loggedEvents(consoleLogSpy)
    expect(events).toContainEqual(
      expect.objectContaining({ event: 'request_start', method: 'POST', path: '/api/check-ins' })
    )
    expect(events).toContainEqual(expect.objectContaining({ event: 'request_end', statusCode: 201 }))
  })

  test('logs user_resolved, cycle_day_calculated, and db_write phase events on success', async () => {
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })

    const eventNames = loggedEvents(consoleLogSpy).map((e) => e.event)
    expect(eventNames).toContain('user_resolved')
    expect(eventNames).toContain('cycle_day_calculated')
    expect(eventNames).toContain('db_write')
  })

  test('logs oura_fetch with fetchSkipped true when there is no active wearable connection', async () => {
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })

    const ouraFetchEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'oura_fetch')
    expect(ouraFetchEvent?.fetchSkipped).toBe(true)
  })

  test('request_end includes deviceId and userId on success', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })
    const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })

    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    expect(response.status).toBe(201)
    expect(endEvent?.deviceId).toBe(DEVICE_ID)
    expect(endEvent?.userId).toBe(user.id)
  })

  test('request_end includes deviceId but omits userId on 401 for an unknown device', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': 'unknown-device',
    })

    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    expect(response.status).toBe(401)
    expect(endEvent?.deviceId).toBe('unknown-device')
    expect(endEvent).not.toHaveProperty('userId')
  })

  test('request_end omits deviceId and userId on 401 when X-Device-ID header is missing entirely', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY)

    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    expect(response.status).toBe(401)
    expect(endEvent).not.toHaveProperty('deviceId')
    expect(endEvent).not.toHaveProperty('userId')
  })

  test('user_resolved event includes deviceId and userId', async () => {
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })
    const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })

    const userResolvedEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'user_resolved')
    expect(userResolvedEvent?.deviceId).toBe(DEVICE_ID)
    expect(userResolvedEvent?.userId).toBe(user.id)
  })
})

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

  test('returns 400 when sleepSatisfaction is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sleepSatisfaction: _, ...body } = BASE_BODY
    const response = await makeRequest(handler, 'POST', '/api/check-ins', body, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when sleepSatisfaction is 0', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, sleepSatisfaction: 0 },
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(400)
  })

  test('returns 400 when sleepSatisfaction is 6', async () => {
    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, sleepSatisfaction: 6 },
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

  test('does not call Sentry.captureMessage on successful check-in submission', async () => {
    const sentry = await import('@sentry/nextjs')
    vi.mocked(sentry.captureMessage).mockClear()
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  test('history sent to the LLM excludes stale check-ins: a redone past day contributes only its active entry', async () => {
    const testUser = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(YESTERDAY),
        todaysPlannedWorkout: 'stale entry from before a redo',
        sleepSatisfaction: 1,
        feelScore: 1,
        status: 'stale',
      },
    })
    await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(YESTERDAY),
        todaysPlannedWorkout: '5km easy',
        sleepSatisfaction: 4,
        feelScore: 4,
        status: 'active',
      },
    })

    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })

    const [userMessage] = vi.mocked(generateRecommendation).mock.calls[0]
    const parsed = JSON.parse(userMessage as string)
    const yesterdayEntries = parsed.recentHistory.filter(
      (h: { checkInDate: string }) => h.checkInDate === YESTERDAY
    )
    expect(yesterdayEntries).toHaveLength(1)
    expect(yesterdayEntries[0].todaysPlannedWorkout).toBe('5km easy')
  })

  test('user with no active wearable connection: fetchAndStoreTodayMetrics not called', async () => {
    const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(201)
    expect(vi.mocked(fetchAndStoreTodayMetrics)).not.toHaveBeenCalled()
  })

  describe('with active Oura connection', () => {
    const MOCK_METRICS = { readinessScore: 82, hrvAvg: 65 }
    const MOCK_BASELINE = { readinessScore: 78, hrvAvg: 60 }
    const MOCK_WEARABLE_CONTEXT = 'Wearable data (Oura Ring):\nReadiness score: 82 (90-day avg: 78)'

    beforeEach(async () => {
      const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
      await getTestClient().wearableConnection.create({
        data: {
          userId: user.id,
          provider: 'oura',
          accessToken: 'enc-access-tok',
          refreshToken: 'enc-refresh-tok',
          tokenExpiresAt: new Date(Date.now() + 86400000),
          status: 'active',
        },
      })
      vi.mocked(fetchAndStoreTodayMetrics).mockResolvedValue(MOCK_METRICS)
      vi.mocked(computeBaseline).mockResolvedValue(MOCK_BASELINE)
      vi.mocked(formatLLMContext).mockReturnValue(MOCK_WEARABLE_CONTEXT)
    })

    test('calls fetchAndStoreTodayMetrics and appends wearable context to LLM message', async () => {
      const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
        'X-Device-ID': DEVICE_ID,
      })
      expect(response.status).toBe(201)
      expect(vi.mocked(fetchAndStoreTodayMetrics)).toHaveBeenCalledOnce()
      expect(vi.mocked(generateRecommendation)).toHaveBeenCalledWith(
        expect.stringContaining(MOCK_WEARABLE_CONTEXT),
        expect.anything(),
      )
    })

    test('fetchAndStoreTodayMetrics returns null: formatLLMContext called with null and fallback context appended to LLM message', async () => {
      const FALLBACK_CONTEXT = "Wearable data (Oura Ring):\nToday's data: not yet synced"
      vi.mocked(fetchAndStoreTodayMetrics).mockResolvedValue(null)
      vi.mocked(formatLLMContext).mockReturnValue(FALLBACK_CONTEXT)

      const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
        'X-Device-ID': DEVICE_ID,
      })
      expect(response.status).toBe(201)
      expect(vi.mocked(formatLLMContext)).toHaveBeenCalledWith(
        null,
        expect.anything(),
        expect.anything(),
      )
      expect(vi.mocked(generateRecommendation)).toHaveBeenCalledWith(
        expect.stringContaining(FALLBACK_CONTEXT),
        expect.anything(),
      )
    })

    test('wearable lib throws: check-in proceeds, Sentry.captureException called, wearable context not appended', async () => {
      vi.mocked(fetchAndStoreTodayMetrics).mockRejectedValue(new Error('Oura API error'))
      const sentry = await import('@sentry/nextjs')

      const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
        'X-Device-ID': DEVICE_ID,
      })
      expect(response.status).toBe(201)
      expect(vi.mocked(sentry.captureException)).toHaveBeenCalled()
      expect(vi.mocked(formatLLMContext)).not.toHaveBeenCalled()
      expect(vi.mocked(generateRecommendation)).toHaveBeenCalledOnce()
    })

    describe('wearable freshness check', () => {
      async function seedFreshMetricRow(userId: string, connectionId: string, ageMinutes: number): Promise<void> {
        const createdAt = new Date(Date.now() - ageMinutes * 60 * 1000)
        await getTestClient().wearableDailyMetric.create({
          data: {
            userId,
            connectionId,
            provider: 'oura',
            metricDate: new Date(TODAY),
            rawData: {},
            readinessScore: 85,
            hrvAvg: 62,
            createdAt,
          },
        })
      }

      test('row exists within threshold: fetchAndStoreTodayMetrics is not called, stored row is passed to formatLLMContext, computeBaseline still runs', async () => {
        const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
        const conn = await getTestClient().wearableConnection.findFirstOrThrow({ where: { userId: user.id } })
        await seedFreshMetricRow(user.id, conn.id, 10)

        const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
          'X-Device-ID': DEVICE_ID,
        })
        expect(response.status).toBe(201)
        expect(vi.mocked(fetchAndStoreTodayMetrics)).not.toHaveBeenCalled()
        expect(vi.mocked(computeBaseline)).toHaveBeenCalledOnce()
        expect(vi.mocked(formatLLMContext)).toHaveBeenCalledOnce()
        expect(vi.mocked(formatLLMContext)).toHaveBeenCalledWith(
          expect.objectContaining({ readinessScore: 85, hrvAvg: 62 }),
          expect.anything(),
          expect.anything(),
        )
      })

      test('row exists beyond threshold: fetchAndStoreTodayMetrics is called', async () => {
        const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
        const conn = await getTestClient().wearableConnection.findFirstOrThrow({ where: { userId: user.id } })
        await seedFreshMetricRow(user.id, conn.id, 130)

        const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
          'X-Device-ID': DEVICE_ID,
        })
        expect(response.status).toBe(201)
        expect(vi.mocked(fetchAndStoreTodayMetrics)).toHaveBeenCalledOnce()
      })

      test('no row exists: fetchAndStoreTodayMetrics is called', async () => {
        const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
          'X-Device-ID': DEVICE_ID,
        })
        expect(response.status).toBe(201)
        expect(vi.mocked(fetchAndStoreTodayMetrics)).toHaveBeenCalledOnce()
      })

      test('wearable_refetch_threshold_minutes absent from additional_params: falls back to 120 minute default', async () => {
        await getTestClient().promptConfig.create({
          data: {
            version: 'test-no-threshold',
            systemPrompt: 'Test prompt',
            temperature: 0.7,
            maxTokens: 1000,
            additionalParams: { wearable_thresholds: {} },
          },
        })
        const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
        const conn = await getTestClient().wearableConnection.findFirstOrThrow({ where: { userId: user.id } })
        await seedFreshMetricRow(user.id, conn.id, 10)

        const response = await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, {
          'X-Device-ID': DEVICE_ID,
        })
        expect(response.status).toBe(201)
        expect(vi.mocked(fetchAndStoreTodayMetrics)).not.toHaveBeenCalled()
      })

      test('oura_freshness_check log event emitted with rowFound and withinThreshold', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
        const conn = await getTestClient().wearableConnection.findFirstOrThrow({ where: { userId: user.id } })
        await seedFreshMetricRow(user.id, conn.id, 10)

        await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })

        const events = loggedEvents(consoleLogSpy)
        const freshnessEvent = events.find((e) => e.event === 'oura_freshness_check')
        consoleLogSpy.mockRestore()

        expect(freshnessEvent).toBeDefined()
        expect(freshnessEvent?.rowFound).toBe(true)
        expect(freshnessEvent?.withinThreshold).toBe(true)
      })
    })
  })
})

describe('GET /api/check-ins', () => {
  beforeEach(async () => {
    await setupTestDb()
    await seedTestUser()
  })

  afterEach(teardownTestDb)

  test('check-in found: returns 200 with checkIn fields', async () => {
    const testUser = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(TODAY),
        todaysPlannedWorkout: '5km easy run',
        sleepSatisfaction: 4,
        feelScore: 4,
      },
    })

    const response = await makeRequest(handler, 'GET', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.checkIn).not.toBeNull()
    expect(body.checkIn.todaysPlannedWorkout).toBe('5km easy run')
    expect(body.checkIn.sleepSatisfaction).toBe(4)
    expect(body.checkIn.feelScore).toBe(4)
  })

  test('no check-in for date: returns 200 with checkIn null', async () => {
    const response = await makeRequest(handler, 'GET', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.checkIn).toBeNull()
  })

  test('only a stale check-in exists for date: returns 200 with checkIn null', async () => {
    const testUser = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(TODAY),
        todaysPlannedWorkout: '5km easy run',
        sleepSatisfaction: 4,
        feelScore: 4,
        status: 'stale',
      },
    })

    const response = await makeRequest(handler, 'GET', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.checkIn).toBeNull()
  })

  test('returns an x-request-id response header', async () => {
    const response = await makeRequest(handler, 'GET', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('request_end includes deviceId and userId', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'GET', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(200)
    expect(endEvent?.deviceId).toBe(DEVICE_ID)
    expect(endEvent?.userId).toBe(user.id)
  })

  test('returns 401 when X-Device-ID header is missing', async () => {
    const response = await makeRequest(handler, 'GET', `/api/check-ins?date=${TODAY}`)
    expect(response.status).toBe(401)
  })

  test('returns 400 when date param is missing', async () => {
    const response = await makeRequest(handler, 'GET', '/api/check-ins', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when date param is invalid', async () => {
    const response = await makeRequest(handler, 'GET', '/api/check-ins?date=not-a-date', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })
})

describe('DELETE /api/check-ins', () => {
  beforeEach(async () => {
    await setupTestDb()
    await seedTestUser()
  })

  afterEach(teardownTestDb)

  test('check-in exists: returns 204, marks check-in and recommendation as stale in a single transaction, and hard-deletes nothing', async () => {
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
    const rec = await getTestClient().recommendation.create({
      data: {
        checkInId: checkIn.id,
        userId: testUser.id,
        recommendationType: 'as_written',
        rationale: 'Test rationale',
      },
    })
    await getTestClient().llmInferenceLog.create({
      data: {
        recommendationId: rec.id,
        model: 'claude-opus-4-6',
        promptVersion: 'test-v1',
        rawResponse: '{}',
        rationaleInternal: 'internal',
        readinessScore: 80,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      },
    })

    const response = await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBe(204)

    const checkIns = await getTestClient().checkIn.findMany()
    expect(checkIns).toHaveLength(1)
    expect(checkIns[0].status).toBe('stale')

    const recommendations = await getTestClient().recommendation.findMany()
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0].status).toBe('stale')

    const logs = await getTestClient().llmInferenceLog.findMany()
    expect(logs).toHaveLength(1)
  })

  test('if the recommendation was already staled by a concurrent request, the transaction fails and the check-in is left active (rollback confirmed)', async () => {
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
    // Simulates a race: another request already marked the recommendation stale
    // between this request's read and its transaction.
    await getTestClient().recommendation.create({
      data: {
        checkInId: checkIn.id,
        userId: testUser.id,
        recommendationType: 'as_written',
        rationale: 'Test rationale',
        status: 'stale',
      },
    })

    const response = await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })

    expect(response.status).toBeGreaterThanOrEqual(500)

    const unchangedCheckIn = await getTestClient().checkIn.findUniqueOrThrow({ where: { id: checkIn.id } })
    expect(unchangedCheckIn.status).toBe('active')
  })

  test('does not call Sentry.captureMessage when check-in is deleted (redo)', async () => {
    const testUser = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(TODAY),
        todaysPlannedWorkout: '5km easy run',
        sleepSatisfaction: 4,
        feelScore: 4,
      },
    })

    const sentry = await import('@sentry/nextjs')
    vi.mocked(sentry.captureMessage).mockClear()
    await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(sentry.captureMessage).not.toHaveBeenCalled()
  })

  test('no check-in exists for date: returns 204 (idempotent)', async () => {
    const response = await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(204)
  })

  test('returns an x-request-id response header', async () => {
    const response = await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  test('request_end includes deviceId and userId', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    const user = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    const endEvent = loggedEvents(consoleLogSpy).find((e) => e.event === 'request_end')
    consoleLogSpy.mockRestore()

    expect(response.status).toBe(204)
    expect(endEvent?.deviceId).toBe(DEVICE_ID)
    expect(endEvent?.userId).toBe(user.id)
  })

  test('returns 401 when X-Device-ID header is missing', async () => {
    const response = await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`)
    expect(response.status).toBe(401)
  })

  test('returns 400 when date param is missing', async () => {
    const response = await makeRequest(handler, 'DELETE', '/api/check-ins', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })

  test('returns 400 when date param is invalid', async () => {
    const response = await makeRequest(handler, 'DELETE', '/api/check-ins?date=not-a-date', undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(400)
  })
})

describe('delete-and-redo history preservation', () => {
  beforeEach(async () => {
    await setupTestDb()
    vi.clearAllMocks()
    vi.mocked(generateRecommendation).mockResolvedValue(MOCK_RECOMMENDATION)
    await seedTestUser()
  })

  afterEach(teardownTestDb)

  async function submitAndRedo(): Promise<void> {
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })
    await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, { 'X-Device-ID': DEVICE_ID })
  }

  test('GET /api/check-ins returns only the new active check-in after a redo, not the stale one', async () => {
    await submitAndRedo()

    await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, todaysPlannedWorkout: '10km tempo run' },
      { 'X-Device-ID': DEVICE_ID }
    )

    const response = await makeRequest(handler, 'GET', `/api/check-ins?date=${TODAY}`, undefined, {
      'X-Device-ID': DEVICE_ID,
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.checkIn.todaysPlannedWorkout).toBe('10km tempo run')
  })

  test('GET /api/recommendations returns only the new active recommendation after a redo, not the stale one', async () => {
    await submitAndRedo()

    vi.mocked(generateRecommendation).mockResolvedValueOnce({
      ...MOCK_RECOMMENDATION,
      rationale: 'Second attempt rationale.',
    })
    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })

    const response = await makeRequest(
      recommendationsHandler,
      'GET',
      `/api/recommendations?date=${TODAY}`,
      undefined,
      { 'X-Device-ID': DEVICE_ID }
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.recommendation.rationale).toBe('Second attempt rationale.')
  })

  test('submitting a new check-in after redo inserts a new active row; the previous stale row remains in the database', async () => {
    await submitAndRedo()

    await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, todaysPlannedWorkout: '10km tempo run' },
      { 'X-Device-ID': DEVICE_ID }
    )

    const checkIns = await getTestClient().checkIn.findMany({ orderBy: { createdAt: 'asc' } })
    expect(checkIns).toHaveLength(2)
    expect(checkIns[0].status).toBe('stale')
    expect(checkIns[0].todaysPlannedWorkout).toBe('5km easy run')
    expect(checkIns[1].status).toBe('active')
    expect(checkIns[1].todaysPlannedWorkout).toBe('10km tempo run')
  })

  test('llm inference logs accumulate as inserts across a redo; no previous log is overwritten', async () => {
    await submitAndRedo()

    await makeRequest(handler, 'POST', '/api/check-ins', BASE_BODY, { 'X-Device-ID': DEVICE_ID })

    const logs = await getTestClient().llmInferenceLog.findMany()
    expect(logs).toHaveLength(2)
  })

  test('cycle day after a redo is computed from prior history, not the now-stale check-in for today', async () => {
    const testUser = await getTestClient().user.findFirstOrThrow({ where: { deviceId: DEVICE_ID } })
    await getTestClient().checkIn.create({
      data: {
        userId: testUser.id,
        checkInDate: new Date(YESTERDAY),
        todaysPlannedWorkout: '5km easy',
        sleepSatisfaction: 4,
        feelScore: 4,
        periodStartedToday: true,
      },
    })

    await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, periodStartedToday: true },
      { 'X-Device-ID': DEVICE_ID }
    )
    await makeRequest(handler, 'DELETE', `/api/check-ins?date=${TODAY}`, undefined, { 'X-Device-ID': DEVICE_ID })

    const response = await makeRequest(
      handler,
      'POST',
      '/api/check-ins',
      { ...BASE_BODY, periodStartedToday: false },
      { 'X-Device-ID': DEVICE_ID }
    )

    expect(response.status).toBe(201)
    const activeCheckIn = await getTestClient().checkIn.findFirstOrThrow({
      where: { userId: testUser.id, checkInDate: new Date(TODAY), status: 'active' },
    })
    expect(activeCheckIn.cycleDay).toBe(2)
  })
})
