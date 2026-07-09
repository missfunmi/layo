import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveUser } from '@/lib/api'
import { startRequest, endRequest, type RequestContext } from '@/lib/logger'

function bad(ctx: RequestContext, message: string) {
  return endRequest(NextResponse.json({ error: message }, { status: 400 }), ctx)
}

export async function GET(request: NextRequest) {
  const ctx = startRequest(request, 'GET', '/api/recommendations')

  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return endRequest(err, ctx)
    throw err
  }
  ctx.userId = user.id

  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date')
  if (!dateStr) return bad(ctx, 'date is required')
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return bad(ctx, 'date is invalid')

  const recommendation = await prisma.recommendation.findFirst({
    where: {
      userId: user.id,
      checkIn: { checkInDate: date },
      status: 'active',
    },
    select: {
      recommendationType: true,
      modificationDetail: true,
      rationale: true,
    },
  })

  return endRequest(NextResponse.json({ recommendation }), ctx)
}
