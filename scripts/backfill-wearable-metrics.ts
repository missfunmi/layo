import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { decrypt } from '../lib/crypto'
import { fetchHistoricalDataWithRaw, refreshToken } from '../lib/wearables/providers/oura'

loadEnv({ path: resolve(process.cwd(), '.env.local'), override: false })

const DRY_RUN = process.argv.includes('--dry-run')

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set. Configure it in .env.local or as an environment variable.')
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function backfillConnection(connection: { id: string; userId: string; accessToken: string }) {
  const existingRows = await prisma.wearableDailyMetric.findMany({
    where: { userId: connection.userId, provider: 'oura' },
    select: { metricDate: true },
  })

  if (existingRows.length === 0) {
    console.log(`  no existing rows for this user, skipping`)
    return { updated: 0, skipped: 0 }
  }

  const existingDates = new Set(existingRows.map((r) => toDateString(r.metricDate)))
  const sortedDates = Array.from(existingDates).sort()
  const startDate = sortedDates[0]
  const endDate = sortedDates[sortedDates.length - 1]

  let accessToken = decrypt(connection.accessToken)
  let entries: Awaited<ReturnType<typeof fetchHistoricalDataWithRaw>>
  try {
    entries = await fetchHistoricalDataWithRaw(accessToken, startDate, endDate)
  } catch (err) {
    const isUnauthorized = err instanceof Error && err.message.includes('401')
    if (!isUnauthorized) throw err
    accessToken = await refreshToken(connection.userId)
    entries = await fetchHistoricalDataWithRaw(accessToken, startDate, endDate)
  }

  let updated = 0
  let skipped = 0
  for (const entry of entries) {
    if (!existingDates.has(entry.date)) {
      skipped++
      continue
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] would update ${entry.date}:`, entry.metrics)
      updated++
      continue
    }
    await prisma.wearableDailyMetric.update({
      where: {
        userId_provider_metricDate: { userId: connection.userId, provider: 'oura', metricDate: new Date(entry.date) },
      },
      data: { ...entry.metrics, rawData: entry.raw as unknown as Prisma.InputJsonValue },
    })
    updated++
  }

  return { updated, skipped }
}

async function main() {
  const connections = await prisma.wearableConnection.findMany({
    where: { provider: 'oura', status: 'active' },
  })

  console.log(`Found ${connections.length} active Oura connection(s)${DRY_RUN ? ' (dry run, no writes)' : ''}`)

  let totalUpdated = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const connection of connections) {
    console.log(`Processing user ${connection.userId}...`)
    try {
      const { updated, skipped } = await backfillConnection(connection)
      console.log(`  updated ${updated} row(s), skipped ${skipped} date(s) with no existing row`)
      totalUpdated += updated
      totalSkipped += skipped
    } catch (err) {
      totalErrors++
      console.error(`  error processing user ${connection.userId}:`, (err as Error).message)
    }
  }

  console.log('---')
  console.log(`Done. ${totalUpdated} row(s) updated, ${totalSkipped} skipped, ${totalErrors} connection(s) errored.`)
}

main()
  .catch((e) => {
    console.error('Fatal error:', (e as Error).message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
