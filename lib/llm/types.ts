export interface InferenceParams {
  model: string
  temperature: number
  maxTokens: number
  additionalParams?: Record<string, unknown>
}

export interface LLMRawResponse {
  content: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

export interface LLMProvider {
  complete(systemPrompt: string, userMessage: string, params: InferenceParams): Promise<LLMRawResponse>
}

export interface ParsedRecommendation {
  recommendationType: 'as_written' | 'modify' | 'rest'
  modificationDetail: string | null
  rationale: string
  rationaleInternal: string
  readinessScore: number
  promptVersion: string
}
