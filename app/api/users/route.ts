import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db'

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

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return bad('Invalid request body')
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
    return bad('deviceId is required')
  }

  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!rawName || name.length < 1 || name.length > 50) {
    return bad('name must be 1-50 characters')
  }

  const currentYear = new Date().getFullYear()
  if (
    birthYear === undefined ||
    birthYear === null ||
    !Number.isInteger(birthYear) ||
    (birthYear as number) < currentYear - 100 ||
    (birthYear as number) > currentYear - 13
  ) {
    return bad('birthYear is invalid')
  }

  if (
    !Array.isArray(hormonalLifeStage) ||
    hormonalLifeStage.length < 1 ||
    !hormonalLifeStage.every((s) => ALLOWED_HORMONAL_STAGES.includes(s as string))
  ) {
    return bad('hormonalLifeStage is invalid')
  }

  if (trainingGoal !== 'race' && trainingGoal !== 'non_race') {
    return bad('trainingGoal must be race or non_race')
  }

  let eventName: string | undefined
  let validatedEventType: ValidEventType | undefined
  let eventTypeOther: string | null = null
  let eventDateParsed: Date | undefined

  if (trainingGoal === 'race') {
    eventName = typeof rawEventName === 'string' ? rawEventName.trim() : ''
    if (!rawEventName || eventName.length < 1 || eventName.length > 100) {
      return bad('eventName must be 1-100 characters when trainingGoal is race')
    }

    if (!VALID_EVENT_TYPES.includes(eventType as ValidEventType)) {
      return bad('eventType is invalid')
    }
    validatedEventType = eventType as ValidEventType

    if (eventType === 'other') {
      const trimmed = typeof rawEventTypeOther === 'string' ? rawEventTypeOther.trim() : ''
      if (!rawEventTypeOther || trimmed.length < 1 || trimmed.length > 50) {
        return bad('eventTypeOther must be 1-50 characters when eventType is other')
      }
      eventTypeOther = trimmed
    }

    if (!eventDate || typeof eventDate !== 'string') {
      return bad('eventDate is required when trainingGoal is race')
    }
    eventDateParsed = new Date(eventDate as string)
    if (isNaN(eventDateParsed.getTime())) {
      return bad('eventDate is invalid')
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (eventDateParsed < today) {
      return bad('eventDate must be in the future')
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
        await tx.event.deleteMany({ where: { userId: u.id } })
        await tx.event.create({
          data: {
            userId: u.id,
            eventName: eventName!,
            eventType: validatedEventType!,
            eventTypeOther,
            eventDate: eventDateParsed!,
          },
        })
      }

      return u
    })

    Sentry.captureMessage('New user created', {
      level: 'info',
      extra: { deviceId, userId: user.id },
    })

    return NextResponse.json({ userId: user.id }, { status: 201 })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
