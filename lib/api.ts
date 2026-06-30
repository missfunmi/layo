import { Prisma } from '@prisma/client'
import { prisma } from './db'

export type UserWithProfile = Prisma.UserGetPayload<{
  include: { profile: true }
}>

export async function resolveUser(request: Request): Promise<UserWithProfile> {
  const deviceId = request.headers.get('X-Device-ID')

  if (!deviceId) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const user = await prisma.user.findUnique({
    where: { deviceId },
    include: { profile: true },
  })

  if (!user) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return user
}
