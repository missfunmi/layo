import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { setupTestDb, teardownTestDb, seedTestPromptConfig, getTestClient } from './db'

describe('db test helpers', () => {
  beforeEach(setupTestDb)
  afterEach(teardownTestDb)

  test('setupTestDb leaves all tables empty', async () => {
    const users = await getTestClient().user.findMany()
    expect(users).toHaveLength(0)
  })

  test('seedTestPromptConfig inserts one PromptConfig row', async () => {
    await seedTestPromptConfig()
    const configs = await getTestClient().promptConfig.findMany()
    expect(configs).toHaveLength(1)
    expect(configs[0].version).toBe('test-v1')
  })

  test('teardownTestDb truncates tables after seeding', async () => {
    await seedTestPromptConfig()
    await teardownTestDb()
    const configs = await getTestClient().promptConfig.findMany()
    expect(configs).toHaveLength(0)
  })
})
