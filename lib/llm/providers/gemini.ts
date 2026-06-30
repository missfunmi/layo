import type { InferenceParams, LLMRawResponse } from '@/lib/llm/types'

export async function complete(
  _systemPrompt: string,
  _userMessage: string,
  _params: InferenceParams
): Promise<LLMRawResponse> {
  throw new Error('Gemini provider not implemented')
}
