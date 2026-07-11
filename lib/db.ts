import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// pg-connection-string >=2.14 currently treats sslmode=prefer/require/verify-ca as aliases
// for verify-full, but emits a process warning (logged as an error by Vercel) because a
// future major version will switch them to weaker, spec-correct libpq semantics instead.
// Rewriting to the explicit sslmode=verify-full silences the warning while keeping today's
// connection behavior identical (verified: both parse to the same pg ssl config).
export function withExplicitSslMode(connectionString: string | undefined): string | undefined {
  if (!connectionString) return connectionString
  if (/[?&]uselibpqcompat=/.test(connectionString)) return connectionString
  return connectionString.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/, '$1verify-full')
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: withExplicitSslMode(process.env.DATABASE_URL) })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
