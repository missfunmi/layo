import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

let prismaInstance: PrismaClient | null = null

function getTestClient(): PrismaClient {
  if (!prismaInstance) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
    prismaInstance = new PrismaClient({ adapter })
  }
  return prismaInstance
}

async function truncateAllTables(): Promise<void> {
  const prisma = getTestClient()
  await prisma.$executeRaw`TRUNCATE TABLE users, user_profiles, events, check_ins, recommendations, llm_inference_logs, prompt_configs RESTART IDENTITY CASCADE`
}

export async function setupTestDb(): Promise<void> {
  await truncateAllTables()
}

export async function teardownTestDb(): Promise<void> {
  await truncateAllTables()
}

export async function seedTestPromptConfig(): Promise<void> {
  await getTestClient().promptConfig.create({
    data: {
      version: 'test-v1',
      systemPrompt: 'You are a fitness coaching assistant for female endurance athletes.',
      temperature: 0.7,
      maxTokens: 1000,
    },
  })
}
