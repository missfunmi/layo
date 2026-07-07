import Anthropic from '@anthropic-ai/sdk'
import type { InferenceParams, LLMRawResponse } from '@/lib/llm/types'

const ANTHROPIC_ALLOWED_ADDITIONAL_PARAMS = new Set([
  'top_k',
  'top_p',
  'stop_sequences',
  'metadata',
  'stream',
  'tool_choice',
  'tools',
])

export async function complete(
  systemPrompt: string,
  userMessage: string,
  params: InferenceParams
): Promise<LLMRawResponse> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const start = performance.now()

  const allowedAdditional = Object.fromEntries(
    Object.entries(params.additionalParams ?? {}).filter(([k]) =>
      ANTHROPIC_ALLOWED_ADDITIONAL_PARAMS.has(k)
    )
  )

  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    ...allowedAdditional,
  })

  const latencyMs = Math.round(performance.now() - start)
  const block = response.content?.[0]
  const content = block?.type === 'text' ? block.text : ''

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  }
}
