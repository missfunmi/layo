import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const deviceId = req.headers.get('X-Device-ID')
  if (!deviceId) {
    return NextResponse.json({ error: 'Missing X-Device-ID header' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { deviceId } })
  if (!user) {
    return NextResponse.json({ error: 'Unknown device' }, { status: 401 })
  }

  const connections = await prisma.wearableConnection.findMany({
    where: { userId: user.id },
    select: { provider: true, status: true, connectedAt: true },
  })

  return NextResponse.json({
    connections: connections.map((c) => ({
      provider: c.provider,
      status: c.status,
      connectedAt: c.connectedAt.toISOString(),
    })),
  })
}
