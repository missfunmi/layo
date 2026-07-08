import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { randomUUID } from 'crypto'
import { encrypt } from '@/lib/crypto'
import { logCtx, startRequest, endRequest } from '@/lib/logger'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = startRequest(req, 'GET', '/api/wearables/oura/authorize')

  const deviceId = req.headers.get('X-Device-ID')
  if (!deviceId) {
    return endRequest(NextResponse.json({ error: 'Missing X-Device-ID header' }, { status: 401 }), ctx)
  }

  const codeVerifierPlain = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifierPlain).digest('base64url')

  const statePayload = JSON.stringify({ nonce: randomUUID(), deviceId })
  const encryptedState = encrypt(statePayload)
  const encryptedCodeVerifier = encrypt(codeVerifierPlain)

  const params = new URLSearchParams({
    client_id: process.env.OURA_CLIENT_ID ?? '',
    redirect_uri: process.env.OURA_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: 'daily heartrate personal',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: encryptedState,
  })

  const authorizationUrl = `https://cloud.ouraring.com/oauth/authorize?${params.toString()}`
  logCtx(ctx, { event: 'pkce_generated' })

  const response = NextResponse.json({ authorizationUrl })
  response.cookies.set('layo_oura_pkce_verifier', encryptedCodeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  })
  return endRequest(response, ctx)
}
