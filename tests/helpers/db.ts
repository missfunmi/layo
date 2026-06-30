import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createTestClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

async function truncateAllTables() {
  const prisma = createTestClient()
  try {
    await prisma.$executeRaw`TRUNCATE TABLE users, user_profiles, events, check_ins, recommendations, llm_inference_logs, prompt_configs RESTART IDENTITY CASCADE`
  } finally {
    await prisma.$disconnect()
  }
}

export async function setupTestDb(): Promise<void> {
  execSync('npx prisma migrate deploy', { stdio: 'pipe' })
  await truncateAllTables()
}

export async function teardownTestDb(): Promise<void> {
  await truncateAllTables()
}

export async function seedTestPromptConfig(): Promise<void> {
  const prisma = createTestClient()
  try {
    await prisma.promptConfig.create({
      data: {
        version: 'test-v1',
        systemPrompt: 'You are a fitness coaching assistant for female endurance athletes.',
        temperature: 0.7,
        maxTokens: 1000,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}
