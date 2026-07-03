import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/db'
import * as anthropicProvider from '@/lib/llm/providers/anthropic'
import * as geminiProvider from '@/lib/llm/providers/gemini'
import type { ParsedRecommendation, InferenceParams, LLMRawResponse, LLMProvider } from '@/lib/llm/types'

const ALLOWED_RECOMMENDATION_TYPES = ['as_written', 'modify', 'rest'] as const
type RecommendationType = (typeof ALLOWED_RECOMMENDATION_TYPES)[number]

function getProvider(name: string): LLMProvider {
  if (name === 'gemini') return geminiProvider
  return anthropicProvider
}

function stripCodeFences(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1').trim()
}

function parseAndValidate(raw: LLMRawResponse, promptVersion: string): ParsedRecommendation {
  let parsed: Record<string, unknown>
  const content = stripCodeFences(raw.content)
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(`LLM response is not valid JSON: ${raw.content}`)
  }

  const recommendationType = parsed.recommendation_type as string
  if (!ALLOWED_RECOMMENDATION_TYPES.includes(recommendationType as RecommendationType)) {
    throw new Error(`Invalid recommendation_type: ${recommendationType}`)
  }

  if (recommendationType === 'modify' && parsed.modification_detail == null) {
    throw new Error('modification_detail is required when recommendation_type is modify')
  }

  const readinessScore = parsed.readiness_score as number
  if (typeof readinessScore !== 'number' || readinessScore < 0 || readinessScore > 100) {
    throw new Error(`readiness_score out of range: ${readinessScore}`)
  }

  return {
    recommendationType: recommendationType as RecommendationType,
    modificationDetail: (parsed.modification_detail as string | null) ?? null,
    rationale: parsed.rationale as string,
    rationaleInternal: parsed.rationale_internal as string,
    readinessScore,
    promptVersion,
  }
}

export async function generateRecommendation(userMessage: string): Promise<ParsedRecommendation> {
  const promptConfig = await prisma.promptConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!promptConfig) {
    throw new Error('No PromptConfig found in database')
  }

  const providerName = process.env.LLM_PROVIDER ?? 'anthropic'
  const model = process.env.LLM_MODEL ?? 'claude-opus-4-6'
  const provider = getProvider(providerName)

  const params: InferenceParams = {
    model,
    temperature: promptConfig.temperature,
    maxTokens: promptConfig.maxTokens,
    additionalParams: (promptConfig.additionalParams as Record<string, unknown> | null) ?? undefined,
  }

  let raw: LLMRawResponse
  try {
    raw = await provider.complete(promptConfig.systemPrompt, userMessage, params)
  } catch (err) {
    Sentry.captureException(err)
    throw err
  }

  try {
    return parseAndValidate(raw, promptConfig.version)
  } catch (err) {
    Sentry.captureMessage('LLM response validation failed', {
      level: 'error',
      extra: { raw: raw.content, error: String(err) },
    })
    throw err
  }
}
