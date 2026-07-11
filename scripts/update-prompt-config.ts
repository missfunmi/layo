import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

loadEnv({ path: resolve(process.cwd(), '.env.local'), override: false })

const configFilePath = process.argv[2]

if (!configFilePath) {
  console.error('Error: No config file specified.')
  console.error('Usage: npm run update-prompt -- <path-to-config.json>')
  process.exit(1)
}

if (!existsSync(configFilePath)) {
  console.error(`Error: Config file not found: ${configFilePath}`)
  process.exit(1)
}

let rawConfig: unknown
try {
  const fileContent = readFileSync(configFilePath, 'utf-8')
  rawConfig = JSON.parse(fileContent)
} catch (e) {
  console.error(`Error: Could not parse JSON from ${configFilePath}: ${(e as Error).message}`)
  process.exit(1)
}

if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
  console.error('Error: Root JSON value must be a non-array object')
  process.exit(1)
}

const parsed = rawConfig as Record<string, unknown>
const errors: string[] = []

if (typeof parsed.version !== 'string' || parsed.version.trim() === '') {
  errors.push('version: must be a non-empty string')
}
if (typeof parsed.systemPrompt !== 'string') {
  errors.push('systemPrompt: must be a string')
}
if (typeof parsed.temperature !== 'number') {
  errors.push('temperature: must be a number')
}
if (typeof parsed.maxTokens !== 'number') {
  errors.push('maxTokens: must be a number')
}
if ('notes' in parsed && parsed.notes !== undefined && typeof parsed.notes !== 'string') {
  errors.push('notes: must be a string if provided')
}
if ('additionalParams' in parsed && parsed.additionalParams !== undefined && (typeof parsed.additionalParams !== 'object' || Array.isArray(parsed.additionalParams) || parsed.additionalParams === null)) {
  errors.push('additionalParams: must be a non-array object if provided')
}

if (errors.length > 0) {
  console.error('Error: Invalid config file:')
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set. Configure it in .env.local or as an environment variable.')
  process.exit(1)
}

async function main() {
  const { prisma } = await import('../lib/db')
  try {
    const row = await prisma.promptConfig.create({
      data: {
        version: (parsed.version as string).trim(),
        systemPrompt: parsed.systemPrompt as string,
        temperature: parsed.temperature as number,
        maxTokens: parsed.maxTokens as number,
        ...(parsed.notes !== undefined && { notes: parsed.notes as string }),
        ...(parsed.additionalParams !== undefined && { additionalParams: parsed.additionalParams as object }),
      },
    })
    console.log('Inserted PromptConfig:')
    console.log(`  id:         ${row.id}`)
    console.log(`  version:    ${row.version}`)
    console.log(`  created_at: ${row.createdAt.toISOString()}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('Error:', (e as Error).message)
  process.exitCode = 1
})
