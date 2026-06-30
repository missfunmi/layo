/**
 * Standard pattern for API route tests in this project:
 *
 * import { describe, test, expect, beforeEach, afterEach } from 'vitest'
 * import { setupTestDb, teardownTestDb, seedTestPromptConfig } from '@/tests/helpers/db'
 * import { makeRequest } from '@/tests/helpers/api'
 * import * as handler from '@/app/api/your-route/route'
 *
 * describe('GET /api/your-route', () => {
 *   beforeEach(setupTestDb)
 *   afterEach(teardownTestDb)
 *
 *   test('returns 401 without device ID', async () => {
 *     const response = await makeRequest(handler, 'GET', '/api/your-route')
 *     expect(response.status).toBe(401)
 *   })
 *
 *   test('returns 200 with valid device ID', async () => {
 *     const response = await makeRequest(handler, 'GET', '/api/your-route', undefined, {
 *       'X-Device-ID': 'test-device-id',
 *     })
 *     expect(response.status).toBe(200)
 *   })
 * })
 */

export {}
