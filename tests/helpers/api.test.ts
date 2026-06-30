import { describe, test, expect } from 'vitest'
import { makeRequest } from './api'

describe('makeRequest helper', () => {
  test('sends GET and returns response from route handler', async () => {
    const handler = {
      GET: async (_req: Request) => Response.json({ ok: true }),
    }
    const response = await makeRequest(handler, 'GET', '/')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  test('sends POST with JSON body', async () => {
    const handler = {
      POST: async (req: Request) => {
        const body = await req.json()
        return Response.json({ received: body })
      },
    }
    const response = await makeRequest(handler, 'POST', '/', { name: 'Test' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: { name: 'Test' } })
  })

  test('forwards custom headers', async () => {
    const handler = {
      GET: async (req: Request) => {
        const deviceId = req.headers.get('x-device-id')
        return Response.json({ deviceId })
      },
    }
    const response = await makeRequest(handler, 'GET', '/', undefined, {
      'x-device-id': 'test-device-123',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ deviceId: 'test-device-123' })
  })
})
