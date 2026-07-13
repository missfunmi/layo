import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
import type { PrismaClient, Prisma } from '@prisma/client'
import { decrypt } from '../lib/crypto'
// Imported for its types only; the runtime module is loaded dynamically in main(), after
// loadEnv() runs below. oura.ts statically imports lib/db.ts (for the shared prisma client),
// and a static import here would evaluate that whole chain before loadEnv() populates
// DATABASE_URL from .env.local.
import type { fetchHistoricalDataWithRaw, refreshToken } from '../lib/wearables/providers/oura'

loadEnv({ path: resolve(process.cwd(), '.env.local'), override: false })

function getArgValue(prefix: string): string | undefined {
  const arg = process.argv.slice(2).find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const KNOWN_ARG_PREFIXES = ['--start-date=', '--end-date=']
const unknownArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== '--dry-run' && !KNOWN_ARG_PREFIXES.some((p) => arg.startsWith(p)))
if (unknownArgs.length > 0) {
  console.error(`Error: unrecognized argument(s): ${unknownArgs.join(', ')}`)
  console.error('Usage: npm run backfill-wearable-metrics -- [--dry-run] [--start-date=YYYY-MM-DD --end-date=YYYY-MM-DD]')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const START_DATE = getArgValue('--start-date=')
const END_DATE = getArgValue('--end-date=')

if (!!START_DATE !== !!END_DATE) {
  console.error('Error: --start-date and --end-date must be provided together')
  console.error('Usage: npm run backfill-wearable-metrics -- [--dry-run] [--start-date=YYYY-MM-DD --end-date=YYYY-MM-DD]')
  process.exit(1)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
if (START_DATE && !DATE_RE.test(START_DATE)) {
  console.error(`Error: invalid --start-date "${START_DATE}", expected YYYY-MM-DD`)
  process.exit(1)
}
if (END_DATE && !DATE_RE.test(END_DATE)) {
  console.error(`Error: invalid --end-date "${END_DATE}", expected YYYY-MM-DD`)
  process.exit(1)
}
if (START_DATE && END_DATE && START_DATE > END_DATE) {
  console.error(`Error: --start-date (${START_DATE}) must be on or before --end-date (${END_DATE})`)
  process.exit(1)
}

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'WEARABLE_TOKEN_KEY', 'OURA_CLIENT_ID', 'OURA_CLIENT_SECRET']
const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name])
if (missingEnvVars.length > 0) {
  console.error(`Error: missing required environment variable(s): ${missingEnvVars.join(', ')}`)
  console.error('These must match the target database: WEARABLE_TOKEN_KEY decrypts stored tokens, and')
  console.error('OURA_CLIENT_ID/OURA_CLIENT_SECRET are needed if any token needs refreshing mid-run.')
  process.exit(1)
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function backfillConnection(
  prisma: PrismaClient,
  oura: { fetchHistoricalDataWithRaw: typeof fetchHistoricalDataWithRaw; refreshToken: typeof refreshToken },
  connection: { id: string; userId: string; accessToken: string },
  overrideRange?: { startDate: string; endDate: string }
) {
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
  const startDate = overrideRange?.startDate ?? sortedDates[0]
  const endDate = overrideRange?.endDate ?? sortedDates[sortedDates.length - 1]

  let accessToken = decrypt(connection.accessToken)
  let entries: Awaited<ReturnType<typeof fetchHistoricalDataWithRaw>>
  try {
    entries = await oura.fetchHistoricalDataWithRaw(accessToken, startDate, endDate)
  } catch (err) {
    const isUnauthorized = err instanceof Error && err.message.includes('401')
    if (!isUnauthorized) throw err
    accessToken = await oura.refreshToken(connection.userId)
    entries = await oura.fetchHistoricalDataWithRaw(accessToken, startDate, endDate)
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
  const { prisma } = await import('../lib/db')
  const oura = await import('../lib/wearables/providers/oura')
  const overrideRange = START_DATE && END_DATE ? { startDate: START_DATE, endDate: END_DATE } : undefined
  try {
    const connections = await prisma.wearableConnection.findMany({
      where: { provider: 'oura', status: 'active' },
    })

    const rangeNote = overrideRange ? ` (date range: ${overrideRange.startDate} to ${overrideRange.endDate})` : ''
    console.log(`Found ${connections.length} active Oura connection(s)${DRY_RUN ? ' (dry run, no writes)' : ''}${rangeNote}`)

    let totalUpdated = 0
    let totalSkipped = 0
    let totalErrors = 0

    for (const connection of connections) {
      console.log(`Processing user ${connection.userId}...`)
      try {
        const { updated, skipped } = await backfillConnection(prisma, oura, connection, overrideRange)
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
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('Fatal error:', (e as Error).message)
  process.exitCode = 1
})
