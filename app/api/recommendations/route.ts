import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveUser } from '@/lib/api'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: NextRequest) {
  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date')
  if (!dateStr) return bad('date is required')
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return bad('date is invalid')

  const recommendation = await prisma.recommendation.findFirst({
    where: {
      userId: user.id,
      checkIn: { checkInDate: date },
    },
    select: {
      recommendationType: true,
      modificationDetail: true,
      rationale: true,
    },
  })

  return NextResponse.json({ recommendation })
}
