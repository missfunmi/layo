import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logCtx, startRequest, endRequest } from '@/lib/logger'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = startRequest(req, 'GET', '/api/wearables')

  const deviceId = req.headers.get('X-Device-ID')
  if (!deviceId) {
    return endRequest(NextResponse.json({ error: 'Missing X-Device-ID header' }, { status: 401 }), ctx)
  }

  const user = await prisma.user.findUnique({ where: { deviceId } })
  if (!user) {
    return endRequest(NextResponse.json({ error: 'Unknown device' }, { status: 401 }), ctx)
  }
  ctx.userId = user.id

  const connections = await prisma.wearableConnection.findMany({
    where: { userId: user.id },
    select: { provider: true, status: true, connectedAt: true },
  })
  logCtx(ctx, { event: 'connections_fetched', count: connections.length })

  return endRequest(
    NextResponse.json({
      connections: connections.map((c) => ({
        provider: c.provider,
        status: c.status,
        connectedAt: c.connectedAt.toISOString(),
      })),
    }),
    ctx
  )
}
