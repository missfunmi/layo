import { vi, describe, test, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    promptConfig: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/llm/providers/anthropic', () => ({
  complete: vi.fn(),
}))

import { generateRecommendation } from '@/lib/llm/index'
import { prisma } from '@/lib/db'
import * as anthropicProvider from '@/lib/llm/providers/anthropic'

const MOCK_PROMPT_CONFIG = {
  id: 'config-1',
  version: 'test-v1',
  systemPrompt: 'You are a fitness coaching assistant for female endurance athletes.',
  temperature: 0.7,
  maxTokens: 1000,
  additionalParams: null,
  notes: null,
  createdAt: new Date(),
}

const VALID_LLM_RESPONSE = {
  recommendation_type: 'as_written',
  modification_detail: null,
  rationale: 'You slept well and feel great. Execute as planned.',
  rationale_internal: 'Sleep 8, feel 5, cycle day 3. All signals positive.',
  readiness_score: 85,
}

const MOCK_RAW_RESPONSE = {
  content: JSON.stringify(VALID_LLM_RESPONSE),
  inputTokens: 100,
  outputTokens: 50,
  latencyMs: 1200,
}

describe('generateRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.promptConfig.findFirst).mockResolvedValue(MOCK_PROMPT_CONFIG)
    vi.mocked(anthropicProvider.complete).mockResolvedValue(MOCK_RAW_RESPONSE)
  })

  test('parses valid JSON response into ParsedRecommendation with correct field values', async () => {
    const result = await generateRecommendation('Test user message')

    expect(result.recommendationType).toBe('as_written')
    expect(result.modificationDetail).toBeNull()
    expect(result.rationale).toBe('You slept well and feel great. Execute as planned.')
    expect(result.rationaleInternal).toBe('Sleep 8, feel 5, cycle day 3. All signals positive.')
    expect(result.readinessScore).toBe(85)
  })

  test('throws when recommendation_type is not in allowed values', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: JSON.stringify({ ...VALID_LLM_RESPONSE, recommendation_type: 'invalid_type' }),
    })

    await expect(generateRecommendation('Test user message')).rejects.toThrow()
  })

  test('throws when JSON response is malformed', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: 'not valid json {{',
    })

    await expect(generateRecommendation('Test user message')).rejects.toThrow()
  })

  test('throws when modification_detail is null but recommendation_type is modify', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: JSON.stringify({
        ...VALID_LLM_RESPONSE,
        recommendation_type: 'modify',
        modification_detail: null,
      }),
    })

    await expect(generateRecommendation('Test user message')).rejects.toThrow()
  })

  test('throws when readiness_score is outside 0-100', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: JSON.stringify({ ...VALID_LLM_RESPONSE, readiness_score: 150 }),
    })

    await expect(generateRecommendation('Test user message')).rejects.toThrow()
  })

  test('selects Anthropic provider when LLM_PROVIDER is absent', async () => {
    delete process.env.LLM_PROVIDER

    await generateRecommendation('Test user message')

    expect(vi.mocked(anthropicProvider.complete)).toHaveBeenCalled()
  })

  test('passes systemPrompt from fetched PromptConfig to provider complete()', async () => {
    await generateRecommendation('Test user message')

    const [systemPrompt] = vi.mocked(anthropicProvider.complete).mock.calls[0]
    expect(systemPrompt).toBe(MOCK_PROMPT_CONFIG.systemPrompt)
  })

  test('returned ParsedRecommendation includes promptVersion from fetched PromptConfig', async () => {
    const result = await generateRecommendation('Test user message')

    expect(result.promptVersion).toBe('test-v1')
  })
})
