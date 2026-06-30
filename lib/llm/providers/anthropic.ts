import Anthropic from '@anthropic-ai/sdk'
import type { InferenceParams, LLMRawResponse } from '@/lib/llm/types'

export async function complete(
  systemPrompt: string,
  userMessage: string,
  params: InferenceParams
): Promise<LLMRawResponse> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const start = performance.now()

  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    ...(params.additionalParams ?? {}),
  })

  const latencyMs = Math.round(performance.now() - start)
  const block = response.content[0]
  const content = block.type === 'text' ? block.text : ''

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs,
  }
}
