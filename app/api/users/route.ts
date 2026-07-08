import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db'
import { resolveUser } from '@/lib/api'
import { logError, startRequest, endRequest } from '@/lib/logger'

const ALLOWED_HORMONAL_STAGES = [
  'premenopausal',
  'menstruating',
  'pregnant',
  'menopausal',
  'post-menopausal',
  'on_birth_control',
  'on_hrt',
]

const VALID_EVENT_TYPES = ['running', 'cycling', 'swimming', 'triathlon', 'skiing', 'other'] as const
type ValidEventType = (typeof VALID_EVENT_TYPES)[number]

function bad(ctx: ReturnType<typeof startRequest>, message: string) {
  return endRequest(NextResponse.json({ error: message }, { status: 400 }), ctx)
}

export async function POST(request: NextRequest) {
  const ctx = startRequest(request, 'POST', '/api/users')

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return bad(ctx, 'Invalid request body')
  }

  const {
    deviceId,
    name: rawName,
    birthYear,
    hormonalLifeStage,
    trainingGoal,
    eventName: rawEventName,
    eventType,
    eventTypeOther: rawEventTypeOther,
    eventDate,
  } = body as Record<string, unknown>

  if (!deviceId || typeof deviceId !== 'string') {
    return bad(ctx, 'deviceId is required')
  }

  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!rawName || name.length < 1 || name.length > 50) {
    return bad(ctx, 'name must be 1-50 characters')
  }

  const currentYear = new Date().getFullYear()
  if (
    birthYear === undefined ||
    birthYear === null ||
    !Number.isInteger(birthYear) ||
    (birthYear as number) < currentYear - 100 ||
    (birthYear as number) > currentYear - 13
  ) {
    return bad(ctx, 'birthYear is invalid')
  }

  if (
    !Array.isArray(hormonalLifeStage) ||
    hormonalLifeStage.length < 1 ||
    !hormonalLifeStage.every((s) => ALLOWED_HORMONAL_STAGES.includes(s as string))
  ) {
    return bad(ctx, 'hormonalLifeStage is invalid')
  }

  if (trainingGoal !== 'race' && trainingGoal !== 'non_race') {
    return bad(ctx, 'trainingGoal must be race or non_race')
  }

  let eventName: string | undefined
  let validatedEventType: ValidEventType | undefined
  let eventTypeOther: string | null = null
  let eventDateParsed: Date | undefined

  if (trainingGoal === 'race') {
    eventName = typeof rawEventName === 'string' ? rawEventName.trim() : ''
    if (!rawEventName || eventName.length < 1 || eventName.length > 100) {
      return bad(ctx, 'eventName must be 1-100 characters when trainingGoal is race')
    }

    if (!VALID_EVENT_TYPES.includes(eventType as ValidEventType)) {
      return bad(ctx, 'eventType is invalid')
    }
    validatedEventType = eventType as ValidEventType

    if (eventType === 'other') {
      const trimmed = typeof rawEventTypeOther === 'string' ? rawEventTypeOther.trim() : ''
      if (!rawEventTypeOther || trimmed.length < 1 || trimmed.length > 50) {
        return bad(ctx, 'eventTypeOther must be 1-50 characters when eventType is other')
      }
      eventTypeOther = trimmed
    }

    if (!eventDate || typeof eventDate !== 'string') {
      return bad(ctx, 'eventDate is required when trainingGoal is race')
    }
    eventDateParsed = new Date(eventDate as string)
    if (isNaN(eventDateParsed.getTime())) {
      return bad(ctx, 'eventDate is invalid')
    }
    const todayStr = new Date().toISOString().slice(0, 10)
    if ((eventDate as string) <= todayStr) {
      return bad(ctx, 'eventDate must be in the future')
    }
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.upsert({
        where: { deviceId: deviceId as string },
        create: { deviceId: deviceId as string },
        update: {},
      })

      await tx.userProfile.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          name,
          birthYear: birthYear as number,
          hormonalLifeStage: hormonalLifeStage as string[],
          trainingGoal: trainingGoal as 'race' | 'non_race',
        },
        update: {
          name,
          birthYear: birthYear as number,
          hormonalLifeStage: hormonalLifeStage as string[],
          trainingGoal: trainingGoal as 'race' | 'non_race',
        },
      })

      if (trainingGoal === 'race') {
        await tx.event.upsert({
          where: { userId: u.id },
          create: {
            userId: u.id,
            eventName: eventName!,
            eventType: validatedEventType!,
            eventTypeOther,
            eventDate: eventDateParsed!,
          },
          update: {
            eventName: eventName!,
            eventType: validatedEventType!,
            eventTypeOther,
            eventDate: eventDateParsed!,
          },
        })
      } else {
        await tx.event.deleteMany({ where: { userId: u.id } })
      }

      return u
    })

    return endRequest(NextResponse.json({ userId: user.id }, { status: 201 }), ctx)
  } catch (err) {
    Sentry.captureException(err)
    logError({ event: 'user_upsert_error', requestId: ctx.requestId, correlationId: ctx.correlationId })
    return endRequest(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), ctx)
  }
}

export async function GET(request: NextRequest) {
  const ctx = startRequest(request, 'GET', '/api/users')

  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return endRequest(err, ctx)
    throw err
  }

  const profile = await prisma.userProfile.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { name: true, hormonalLifeStage: true },
  })

  if (!profile) {
    return endRequest(NextResponse.json({ error: 'not_found' }, { status: 404 }), ctx)
  }

  return endRequest(
    NextResponse.json({ user: { name: profile.name, hormonalLifeStage: profile.hormonalLifeStage } }),
    ctx
  )
}
