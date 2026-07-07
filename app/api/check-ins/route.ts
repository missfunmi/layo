import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
import { resolveUser } from '@/lib/api'
import { calculateCycleDay } from '@/lib/cycle'
import { generateRecommendation } from '@/lib/llm/index'
import { fetchAndStoreTodayMetrics, computeBaseline, formatLLMContext } from '@/lib/wearables/index'
import type { WearableThresholds } from '@/lib/wearables/types'

const VALID_YESTERDAY_TYPES = ['planned', 'suggested', 'other']

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function parseDateParam(request: NextRequest): { date: Date } | NextResponse {
  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date')
  if (!dateStr) return bad('date is required')
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return bad('date is invalid')
  return { date }
}

export async function GET(request: NextRequest) {
  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const parsed = parseDateParam(request)
  if (parsed instanceof NextResponse) return parsed

  const checkIn = await prisma.checkIn.findUnique({
    where: { userId_checkInDate: { userId: user.id, checkInDate: parsed.date } },
  })

  return NextResponse.json({ checkIn })
}

export async function DELETE(request: NextRequest) {
  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const parsed = parseDateParam(request)
  if (parsed instanceof NextResponse) return parsed

  const checkIn = await prisma.checkIn.findUnique({
    where: { userId_checkInDate: { userId: user.id, checkInDate: parsed.date } },
    include: { recommendation: { include: { llmInferenceLog: true } } },
  })

  if (checkIn) {
    await prisma.$transaction(async (tx: TransactionClient) => {
      if (checkIn.recommendation?.llmInferenceLog) {
        await tx.llmInferenceLog.delete({ where: { id: checkIn.recommendation.llmInferenceLog.id } })
      }
      if (checkIn.recommendation) {
        await tx.recommendation.delete({ where: { id: checkIn.recommendation.id } })
      }
      await tx.checkIn.delete({ where: { id: checkIn.id } })
    })

  }

  return new NextResponse(null, { status: 204 })
}

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return bad('Invalid request body')
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

  if (!checkInDate || typeof checkInDate !== 'string') return bad('checkInDate is required')
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (checkInDate > tomorrowStr) return bad('checkInDate cannot be more than 1 day in the future')

  if (todaysPlannedWorkout === undefined || todaysPlannedWorkout === null || typeof todaysPlannedWorkout !== 'string') {
    return bad('todaysPlannedWorkout is required')
  }
  const trimmedWorkout = todaysPlannedWorkout.trim()
  if (trimmedWorkout.length === 0 || trimmedWorkout.length > 280) {
    return bad('todaysPlannedWorkout must be 1-280 characters')
  }

  if (sleepSatisfaction === undefined || sleepSatisfaction === null) return bad('sleepSatisfaction is required')
  if (typeof sleepSatisfaction !== 'number' || !Number.isInteger(sleepSatisfaction) || sleepSatisfaction < 1 || sleepSatisfaction > 5) {
    return bad('sleepSatisfaction must be an integer between 1 and 5')
  }

  if (feelScore === undefined || feelScore === null) return bad('feelScore is required')
  if (typeof feelScore !== 'number' || !Number.isInteger(feelScore) || feelScore < 1 || feelScore > 5) {
    return bad('feelScore must be an integer between 1 and 5')
  }

  if (yesterdayWorkoutType != null) {
    if (!VALID_YESTERDAY_TYPES.includes(yesterdayWorkoutType as string)) {
      return bad('yesterdayWorkoutType must be planned, suggested, or other')
    }
    if (yesterdayWorkoutType === 'other') {
      if (!yesterdayWorkoutDescription || typeof yesterdayWorkoutDescription !== 'string') {
        return bad('yesterdayWorkoutDescription is required when yesterdayWorkoutType is other')
      }
      const trimmedDesc = yesterdayWorkoutDescription.trim()
      if (trimmedDesc.length === 0 || trimmedDesc.length > 280) {
        return bad('yesterdayWorkoutDescription must be 1-280 characters')
      }
    }
  }

  if (yesterdayWorkoutFeedback != null) {
    if (typeof yesterdayWorkoutFeedback !== 'string' || yesterdayWorkoutFeedback.length > 280) {
      return bad('yesterdayWorkoutFeedback cannot exceed 280 characters')
    }
  }

  if (periodStartedToday != null && typeof periodStartedToday !== 'boolean') {
    return bad('periodStartedToday must be a boolean')
  }

  if (stressors != null) {
    if (typeof stressors !== 'string' || stressors.length > 280) {
      return bad('stressors cannot exceed 280 characters')
    }
  }

  const priorCheckIns = await prisma.checkIn.findMany({
    where: { userId: user.id, checkInDate: { lt: new Date(checkInDate) } },
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

  let wearableContext: string | null = null
  const activeConnection = await prisma.wearableConnection.findFirst({
    where: { userId: user.id, status: 'active' },
  })
  if (activeConnection) {
    try {
      const todayMetrics = await fetchAndStoreTodayMetrics(user.id, activeConnection.provider, checkInDate)
      const promptConfig = await prisma.promptConfig.findFirst({ orderBy: { createdAt: 'desc' } })
      const thresholds = (
        (promptConfig?.additionalParams as Record<string, unknown> | null)?.wearable_thresholds ?? {}
      ) as WearableThresholds
      const baseline = await computeBaseline(user.id, activeConnection.provider)
      wearableContext = formatLLMContext(todayMetrics, baseline, thresholds)
    } catch (err) {
      Sentry.captureException(err)
    }
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
    recommendation = await generateRecommendation(userMessage)
  } catch (err) {
    const existing = await prisma.checkIn.findUnique({
      where: { userId_checkInDate: { userId: user.id, checkInDate: new Date(checkInDate) } },
    })
    if (existing) Sentry.captureException(err)
    return NextResponse.json(
      { error: 'recommendation_failed', checkInSaved: existing !== null },
      { status: 503 }
    )
  }

  const model = process.env.LLM_MODEL ?? 'claude-opus-4-6'

  await prisma.$transaction(async (tx) => {
    const checkIn = await tx.checkIn.upsert({
      where: { userId_checkInDate: { userId: user.id, checkInDate: new Date(checkInDate) } },
      create: {
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
      update: {
        todaysPlannedWorkout: trimmedWorkout,
        sleepSatisfaction: sleepSatisfaction as number,
        feelScore: feelScore as number,
        yesterdayWorkoutType: (yesterdayWorkoutType as 'planned' | 'suggested' | 'other') ?? null,
        yesterdayWorkoutDescription: (yesterdayWorkoutDescription as string) ?? null,
        yesterdayWorkoutFeedback: (yesterdayWorkoutFeedback as string) ?? null,
        periodStartedToday: (periodStartedToday as boolean) ?? null,
        cycleDay: cycleDay ?? null,
        stressors: (stressors as string) ?? null,
      },
    })

    const rec = await tx.recommendation.upsert({
      where: { checkInId: checkIn.id },
      create: {
        checkInId: checkIn.id,
        userId: user.id,
        recommendationType: recommendation.recommendationType,
        modificationDetail: recommendation.modificationDetail ?? undefined,
        rationale: recommendation.rationale,
      },
      update: {
        recommendationType: recommendation.recommendationType,
        modificationDetail: recommendation.modificationDetail ?? null,
        rationale: recommendation.rationale,
      },
    })

    await tx.llmInferenceLog.upsert({
      where: { recommendationId: rec.id },
      create: {
        recommendationId: rec.id,
        model,
        promptVersion: recommendation.promptVersion,
        rawResponse: JSON.stringify(recommendation),
        rationaleInternal: recommendation.rationaleInternal,
        readinessScore: recommendation.readinessScore,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      },
      update: {
        model,
        promptVersion: recommendation.promptVersion,
        rawResponse: JSON.stringify(recommendation),
        rationaleInternal: recommendation.rationaleInternal,
        readinessScore: recommendation.readinessScore,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      },
    })
  })

  return NextResponse.json(
    {
      recommendationType: recommendation.recommendationType,
      modificationDetail: recommendation.modificationDetail,
      rationale: recommendation.rationale,
    },
    { status: 201 }
  )
}
