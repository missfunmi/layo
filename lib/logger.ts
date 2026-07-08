import { randomUUID } from 'crypto'

export function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }))
}

export function logError(fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }))
}

export interface LogContext {
  requestId: string
  correlationId: string
  deviceId?: string
  userId?: string
}

export interface RequestContext extends LogContext {
  start: number
}

function ctxFields(ctx: LogContext): Record<string, unknown> {
  return {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    ...(ctx.deviceId !== undefined && { deviceId: ctx.deviceId }),
    ...(ctx.userId !== undefined && { userId: ctx.userId }),
  }
}

export function logCtx(ctx: LogContext, fields: Record<string, unknown>): void {
  log({ ...ctxFields(ctx), ...fields })
}

export function logErrorCtx(ctx: LogContext, fields: Record<string, unknown>): void {
  logError({ ...ctxFields(ctx), ...fields })
}

export function startRequest(request: Request, method: string, path: string): RequestContext {
  const requestId = randomUUID()
  const correlationId = request.headers.get('x-correlation-id') || randomUUID()
  const deviceId = request.headers.get('X-Device-ID') ?? undefined
  const ctx: RequestContext = {
    requestId,
    correlationId,
    start: performance.now(),
    ...(deviceId !== undefined && { deviceId }),
  }
  logCtx(ctx, { event: 'request_start', method, path })
  return ctx
}

export function endRequest<T extends Response>(response: T, ctx: RequestContext): T {
  logCtx(ctx, {
    event: 'request_end',
    statusCode: response.status,
    latencyMs: Math.round(performance.now() - ctx.start),
  })
  response.headers.set('x-request-id', ctx.requestId)
  return response
}
