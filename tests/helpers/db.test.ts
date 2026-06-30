import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { setupTestDb, teardownTestDb, seedTestPromptConfig } from './db'

function createTestClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

describe('db test helpers', () => {
  beforeEach(setupTestDb)
  afterEach(teardownTestDb)

  test('setupTestDb leaves all tables empty', async () => {
    const prisma = createTestClient()
    const users = await prisma.user.findMany()
    await prisma.$disconnect()
    expect(users).toHaveLength(0)
  })

  test('seedTestPromptConfig inserts one PromptConfig row', async () => {
    await seedTestPromptConfig()
    const prisma = createTestClient()
    const configs = await prisma.promptConfig.findMany()
    await prisma.$disconnect()
    expect(configs).toHaveLength(1)
    expect(configs[0].version).toBe('test-v1')
  })

  test('teardownTestDb truncates tables after seeding', async () => {
    await seedTestPromptConfig()
    await teardownTestDb()
    const prisma = createTestClient()
    const configs = await prisma.promptConfig.findMany()
    await prisma.$disconnect()
    expect(configs).toHaveLength(0)
  })
})
