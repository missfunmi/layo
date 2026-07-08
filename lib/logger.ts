import { randomUUID } from 'crypto'

export function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }))
}

export function logError(fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }))
}

export interface RequestContext {
  requestId: string
  correlationId: string
  start: number
}

export function startRequest(request: Request, method: string, path: string): RequestContext {
  const requestId = randomUUID()
  const correlationId = request.headers.get('x-correlation-id') || randomUUID()
  log({ event: 'request_start', requestId, correlationId, method, path })
  return { requestId, correlationId, start: performance.now() }
}

export function endRequest<T extends Response>(response: T, ctx: RequestContext): T {
  log({
    event: 'request_end',
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    statusCode: response.status,
    latencyMs: Math.round(performance.now() - ctx.start),
  })
  response.headers.set('x-request-id', ctx.requestId)
  return response
}
