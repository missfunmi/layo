import { testApiHandler } from 'next-test-api-route-handler'

export async function makeRequest(
  handler: Parameters<typeof testApiHandler>[0]['appHandler'],
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<Response> {
  let result!: Response
  await testApiHandler({
    appHandler: handler,
    url: path,
    test: async ({ fetch }) => {
      const init: RequestInit = { method }
      const allHeaders: Record<string, string> = { ...headers }
      if (body !== undefined) {
        init.body = JSON.stringify(body)
        allHeaders['Content-Type'] = 'application/json'
      }
      if (Object.keys(allHeaders).length > 0) init.headers = allHeaders
      result = await fetch(init)
    },
  })
  return result
}
