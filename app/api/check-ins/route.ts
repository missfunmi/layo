import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
import { resolveUser } from '@/lib/api'
import { calculateCycleDay } from '@/lib/cycle'
import { generateRecommendation } from '@/lib/llm/index'
import { fetchAndStoreTodayMetrics, computeBaseline, formatLLMContext } from '@/lib/wearables/index'
import type { WearableThresholds } from '@/lib/wearables/types'
import { logCtx, logErrorCtx, startRequest, endRequest, type RequestContext } from '@/lib/logger'

const VALID_YESTERDAY_TYPES = ['planned', 'suggested', 'other']

function bad(ctx: RequestContext, message: string) {
  return endRequest(NextResponse.json({ error: message }, { status: 400 }), ctx)
}

function parseDateParam(ctx: RequestContext, request: NextRequest): { date: Date } | NextResponse {
  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date')
  if (!dateStr) return bad(ctx, 'date is required')
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return bad(ctx, 'date is invalid')
  return { date }
}

export async function GET(request: NextRequest) {
  const ctx = startRequest(request, 'GET', '/api/check-ins')

  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return endRequest(err, ctx)
    throw err
  }
  ctx.userId = user.id

  const parsed = parseDateParam(ctx, request)
  if (parsed instanceof NextResponse) return parsed

  const checkIn = await prisma.checkIn.findFirst({
    where: { userId: user.id, checkInDate: parsed.date, status: 'active' },
  })

  return endRequest(NextResponse.json({ checkIn }), ctx)
}

export async function DELETE(request: NextRequest) {
  const ctx = startRequest(request, 'DELETE', '/api/check-ins')

  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return endRequest(err, ctx)
    throw err
  }
  ctx.userId = user.id

  const parsed = parseDateParam(ctx, request)
  if (parsed instanceof NextResponse) return parsed

  const checkIn = await prisma.checkIn.findFirst({
    where: { userId: user.id, checkInDate: parsed.date, status: 'active' },
    include: { recommendation: true },
  })

  if (checkIn) {
    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.checkIn.update({
        where: { id: checkIn.id, status: 'active' },
        data: { status: 'stale' },
      })
      if (checkIn.recommendation) {
        await tx.recommendation.update({
          where: { id: checkIn.recommendation.id, status: 'active' },
          data: { status: 'stale' },
        })
      }
    })
  }

  return endRequest(new NextResponse(null, { status: 204 }), ctx)
}

export async function POST(request: NextRequest) {
  const ctx = startRequest(request, 'POST', '/api/check-ins')

  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return endRequest(err, ctx)
    throw err
  }
  ctx.userId = user.id
  logCtx(ctx, { event: 'user_resolved' })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return bad(ctx, 'Invalid request body')
  }

  const {
    checkInDate,
    yesterdayWorkoutType,
    yesterdayWorkoutDescription,
    yesterdayWorkoutFeedback,
    todaysPlannedWorkout,
    sleepSatisfaction,
    feelScore,
    periodStartedToday,
    stressors,
  } = body

  if (!checkInDate || typeof checkInDate !== 'string') return bad(ctx, 'checkInDate is required')
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (checkInDate > tomorrowStr) return bad(ctx, 'checkInDate cannot be more than 1 day in the future')

  if (todaysPlannedWorkout === undefined || todaysPlannedWorkout === null || typeof todaysPlannedWorkout !== 'string') {
    return bad(ctx, 'todaysPlannedWorkout is required')
  }
  const trimmedWorkout = todaysPlannedWorkout.trim()
  if (trimmedWorkout.length === 0 || trimmedWorkout.length > 280) {
    return bad(ctx, 'todaysPlannedWorkout must be 1-280 characters')
  }

  if (sleepSatisfaction === undefined || sleepSatisfaction === null) return bad(ctx, 'sleepSatisfaction is required')
  if (typeof sleepSatisfaction !== 'number' || !Number.isInteger(sleepSatisfaction) || sleepSatisfaction < 1 || sleepSatisfaction > 5) {
    return bad(ctx, 'sleepSatisfaction must be an integer between 1 and 5')
  }

  if (feelScore === undefined || feelScore === null) return bad(ctx, 'feelScore is required')
  if (typeof feelScore !== 'number' || !Number.isInteger(feelScore) || feelScore < 1 || feelScore > 5) {
    return bad(ctx, 'feelScore must be an integer between 1 and 5')
  }

  if (yesterdayWorkoutType != null) {
    if (!VALID_YESTERDAY_TYPES.includes(yesterdayWorkoutType as string)) {
      return bad(ctx, 'yesterdayWorkoutType must be planned, suggested, or other')
    }
    if (yesterdayWorkoutType === 'other') {
      if (!yesterdayWorkoutDescription || typeof yesterdayWorkoutDescription !== 'string') {
        return bad(ctx, 'yesterdayWorkoutDescription is required when yesterdayWorkoutType is other')
      }
      const trimmedDesc = yesterdayWorkoutDescription.trim()
      if (trimmedDesc.length === 0 || trimmedDesc.length > 280) {
        return bad(ctx, 'yesterdayWorkoutDescription must be 1-280 characters')
      }
    }
  }

  if (yesterdayWorkoutFeedback != null) {
    if (typeof yesterdayWorkoutFeedback !== 'string' || yesterdayWorkoutFeedback.length > 280) {
      return bad(ctx, 'yesterdayWorkoutFeedback cannot exceed 280 characters')
    }
  }

  if (periodStartedToday != null && typeof periodStartedToday !== 'boolean') {
    return bad(ctx, 'periodStartedToday must be a boolean')
  }

  if (stressors != null) {
    if (typeof stressors !== 'string' || stressors.length > 280) {
      return bad(ctx, 'stressors cannot exceed 280 characters')
    }
  }

  const priorCheckIns = await prisma.checkIn.findMany({
    where: { userId: user.id, checkInDate: { lt: new Date(checkInDate) }, status: 'active' },
    orderBy: { checkInDate: 'desc' },
    take: 14,
    select: {
      checkInDate: true,
      periodStartedToday: true,
      sleepSatisfaction: true,
      feelScore: true,
      todaysPlannedWorkout: true,
      yesterdayWorkoutType: true,
      stressors: true,
    },
  })

  const cycleDay = calculateCycleDay(
    (periodStartedToday as boolean | null) ?? null,
    checkInDate,
    priorCheckIns.map((c) => ({
      checkInDate: c.checkInDate.toISOString().slice(0, 10),
      periodStartedToday: c.periodStartedToday,
    }))
  )
  logCtx(ctx, { event: 'cycle_day_calculated', cycleDay })

  let wearableContext: string | null = null
  const activeConnection = await prisma.wearableConnection.findFirst({
    where: { userId: user.id, status: 'active' },
  })
  if (activeConnection) {
    const ouraStart = performance.now()
    try {
      const todayMetrics = await fetchAndStoreTodayMetrics(user.id, activeConnection.provider, checkInDate)
      logCtx(ctx, {
        event: 'oura_fetch',
        fetchSkipped: false,
        dataAvailable: todayMetrics !== null,
        latencyMs: Math.round(performance.now() - ouraStart),
      })
      const promptConfig = await prisma.promptConfig.findFirst({ orderBy: { createdAt: 'desc' } })
      const thresholds = (
        (promptConfig?.additionalParams as Record<string, unknown> | null)?.wearable_thresholds ?? {}
      ) as WearableThresholds
      const baseline = await computeBaseline(user.id, activeConnection.provider)
      const baselineValues = Object.values(baseline)
      logCtx(ctx, {
        event: 'baseline_computed',
        metricsWithBaseline: baselineValues.filter((v) => v !== undefined).length,
        metricsOmitted: baselineValues.filter((v) => v === undefined).length,
      })
      wearableContext = formatLLMContext(todayMetrics, baseline, thresholds)
    } catch (err) {
      Sentry.captureException(err)
      logErrorCtx(ctx, { event: 'wearable_enrichment_error' })
    }
  } else {
    logCtx(ctx, {
      event: 'oura_fetch',
      fetchSkipped: true,
      dataAvailable: false,
      latencyMs: 0,
    })
  }

  let userMessage = JSON.stringify({
    profile: {
      name: user.profile?.name,
      hormonalLifeStage: user.profile?.hormonalLifeStage,
      trainingGoal: user.profile?.trainingGoal,
    },
    todaysCheckIn: {
      checkInDate,
      todaysPlannedWorkout: trimmedWorkout,
      sleepSatisfaction,
      feelScore,
      yesterdayWorkoutType: yesterdayWorkoutType ?? null,
      yesterdayWorkoutDescription: yesterdayWorkoutDescription ?? null,
      yesterdayWorkoutFeedback: yesterdayWorkoutFeedback ?? null,
      periodStartedToday: periodStartedToday ?? null,
      stressors: stressors ?? null,
      cycleDay: cycleDay ?? null,
    },
    recentHistory: priorCheckIns.map((c) => ({
      checkInDate: c.checkInDate.toISOString().slice(0, 10),
      sleepSatisfaction: c.sleepSatisfaction,
      feelScore: c.feelScore,
      todaysPlannedWorkout: c.todaysPlannedWorkout,
      yesterdayWorkoutType: c.yesterdayWorkoutType,
      stressors: c.stressors,
    })),
  })

  if (wearableContext) {
    userMessage += '\n\n' + wearableContext
  }

  let recommendation: Awaited<ReturnType<typeof generateRecommendation>>
  try {
    recommendation = await generateRecommendation(userMessage, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      deviceId: ctx.deviceId,
      userId: ctx.userId,
    })
  } catch (err) {
    const existing = await prisma.checkIn.findFirst({
      where: { userId: user.id, checkInDate: new Date(checkInDate), status: 'active' },
    })
    if (existing) Sentry.captureException(err)
    return endRequest(
      NextResponse.json(
        { error: 'recommendation_failed', checkInSaved: existing !== null },
        { status: 503 }
      ),
      ctx
    )
  }

  const model = process.env.LLM_MODEL ?? 'claude-opus-4-6'

  const dbStart = performance.now()
  await prisma.$transaction(async (tx) => {
    const checkIn = await tx.checkIn.create({
      data: {
        userId: user.id,
        checkInDate: new Date(checkInDate),
        todaysPlannedWorkout: trimmedWorkout,
        sleepSatisfaction: sleepSatisfaction as number,
        feelScore: feelScore as number,
        yesterdayWorkoutType: yesterdayWorkoutType as 'planned' | 'suggested' | 'other' | undefined ?? undefined,
        yesterdayWorkoutDescription: yesterdayWorkoutDescription as string | undefined ?? undefined,
        yesterdayWorkoutFeedback: yesterdayWorkoutFeedback as string | undefined ?? undefined,
        periodStartedToday: periodStartedToday as boolean | undefined ?? undefined,
        cycleDay: cycleDay ?? undefined,
        stressors: stressors as string | undefined ?? undefined,
      },
    })

    const rec = await tx.recommendation.create({
      data: {
        checkInId: checkIn.id,
        userId: user.id,
        recommendationType: recommendation.recommendationType,
        modificationDetail: recommendation.modificationDetail ?? undefined,
        rationale: recommendation.rationale,
      },
    })

    await tx.llmInferenceLog.create({
      data: {
        recommendationId: rec.id,
        model,
        promptVersion: recommendation.promptVersion,
        correlationId: ctx.correlationId,
        rawResponse: JSON.stringify(recommendation),
        rationaleInternal: recommendation.rationaleInternal,
        readinessScore: recommendation.readinessScore,
        inputTokens: recommendation.inputTokens,
        outputTokens: recommendation.outputTokens,
        latencyMs: recommendation.latencyMs,
      },
    })
  })
  logCtx(ctx, {
    event: 'db_write',
    tables: ['check_ins', 'recommendations', 'llm_inference_logs'],
    latencyMs: Math.round(performance.now() - dbStart),
  })

  return endRequest(
    NextResponse.json(
      {
        recommendationType: recommendation.recommendationType,
        modificationDetail: recommendation.modificationDetail,
        rationale: recommendation.rationale,
      },
      { status: 201 }
    ),
    ctx
  )
}
