import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveUser } from '@/lib/api'
import { logCtx, startRequest, endRequest } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const ctx = startRequest(request, 'GET', '/api/profile')

  let user: Awaited<ReturnType<typeof resolveUser>>
  try {
    user = await resolveUser(request)
  } catch (err) {
    if (err instanceof Response) return endRequest(err, ctx)
    throw err
  }
  ctx.userId = user.id

  const [connection, promptConfig] = await Promise.all([
    prisma.wearableConnection.findFirst({ where: { userId: user.id, status: 'active' } }),
    prisma.promptConfig.findFirst({ orderBy: { createdAt: 'desc' } }),
  ])
  logCtx(ctx, { event: 'profile_fetched' })

  return endRequest(
    NextResponse.json({
      userId: user.id,
      ouraConnected: connection !== null,
      promptVersion: promptConfig?.version ?? null,
    }),
    ctx
  )
}
