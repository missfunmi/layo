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

vi.mock('@/lib/llm/providers/gemini', () => ({
  complete: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
  logError: vi.fn(),
}))

import { generateRecommendation } from '@/lib/llm/index'
import { prisma } from '@/lib/db'
import * as anthropicProvider from '@/lib/llm/providers/anthropic'
import * as geminiProvider from '@/lib/llm/providers/gemini'
import { log, logError } from '@/lib/logger'

const TEST_CTX = { requestId: 'req-1', correlationId: 'corr-1' }

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
    delete process.env.LLM_PROVIDER
    vi.mocked(prisma.promptConfig.findFirst).mockResolvedValue(MOCK_PROMPT_CONFIG)
    vi.mocked(anthropicProvider.complete).mockResolvedValue(MOCK_RAW_RESPONSE)
  })

  test('parses valid JSON response into ParsedRecommendation with correct field values', async () => {
    const result = await generateRecommendation('Test user message', TEST_CTX)

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

    await expect(generateRecommendation('Test user message', TEST_CTX)).rejects.toThrow()
  })

  test('throws when JSON response is malformed', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: 'not valid json {{',
    })

    await expect(generateRecommendation('Test user message', TEST_CTX)).rejects.toThrow()
  })

  test('parses JSON wrapped in ```json code fences', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: `\`\`\`json\n${JSON.stringify(VALID_LLM_RESPONSE)}\n\`\`\``,
    })

    const result = await generateRecommendation('Test user message', TEST_CTX)
    expect(result.recommendationType).toBe('as_written')
    expect(result.readinessScore).toBe(85)
  })

  test('parses JSON wrapped in plain ``` code fences', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: `\`\`\`\n${JSON.stringify(VALID_LLM_RESPONSE)}\n\`\`\``,
    })

    const result = await generateRecommendation('Test user message', TEST_CTX)
    expect(result.recommendationType).toBe('as_written')
    expect(result.readinessScore).toBe(85)
  })

  test('parses JSON wrapped in ```json code fences with leading/trailing whitespace', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: `\n\n  \`\`\`json\n${JSON.stringify(VALID_LLM_RESPONSE)}\n\`\`\`\n  `,
    })

    const result = await generateRecommendation('Test user message', TEST_CTX)
    expect(result.recommendationType).toBe('as_written')
    expect(result.readinessScore).toBe(85)
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

    await expect(generateRecommendation('Test user message', TEST_CTX)).rejects.toThrow()
  })

  test('throws when readiness_score is outside 0-100', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: JSON.stringify({ ...VALID_LLM_RESPONSE, readiness_score: 150 }),
    })

    await expect(generateRecommendation('Test user message', TEST_CTX)).rejects.toThrow()
  })

  test('selects Anthropic provider when LLM_PROVIDER is absent', async () => {
    delete process.env.LLM_PROVIDER

    await generateRecommendation('Test user message', TEST_CTX)

    expect(vi.mocked(anthropicProvider.complete)).toHaveBeenCalled()
  })

  test('passes systemPrompt from fetched PromptConfig to provider complete()', async () => {
    await generateRecommendation('Test user message', TEST_CTX)

    const [systemPrompt] = vi.mocked(anthropicProvider.complete).mock.calls[0]
    expect(systemPrompt).toBe(MOCK_PROMPT_CONFIG.systemPrompt)
  })

  test('returned ParsedRecommendation includes promptVersion from fetched PromptConfig', async () => {
    const result = await generateRecommendation('Test user message', TEST_CTX)

    expect(result.promptVersion).toBe('test-v1')
  })

  test('selects Gemini provider when LLM_PROVIDER is gemini', async () => {
    process.env.LLM_PROVIDER = 'gemini'
    vi.mocked(geminiProvider.complete).mockResolvedValue(MOCK_RAW_RESPONSE)

    await generateRecommendation('Test user message', TEST_CTX)

    expect(vi.mocked(geminiProvider.complete)).toHaveBeenCalled()
  })

  test('returned ParsedRecommendation includes inputTokens, outputTokens, and latencyMs from provider raw response', async () => {
    const result = await generateRecommendation('Test user message', TEST_CTX)

    expect(result.inputTokens).toBe(100)
    expect(result.outputTokens).toBe(50)
    expect(result.latencyMs).toBe(1200)
  })

  test('logs prompt_config_fetched with requestId, correlationId, and promptVersion', async () => {
    await generateRecommendation('Test user message', TEST_CTX)

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'prompt_config_fetched',
        requestId: 'req-1',
        correlationId: 'corr-1',
        promptVersion: 'test-v1',
      })
    )
  })

  test('logs llm_inference with model, promptVersion, token counts, latencyMs, and recommendationType', async () => {
    await generateRecommendation('Test user message', TEST_CTX)

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'llm_inference',
        requestId: 'req-1',
        correlationId: 'corr-1',
        promptVersion: 'test-v1',
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 1200,
        recommendationType: 'as_written',
      })
    )
  })

  test('logs a matching logError when the provider call throws', async () => {
    const providerError = new Error('Anthropic API error: 500')
    vi.mocked(anthropicProvider.complete).mockRejectedValue(providerError)

    await expect(generateRecommendation('Test user message', TEST_CTX)).rejects.toThrow()

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        correlationId: 'corr-1',
      })
    )
  })

  test('logs a matching logError when the LLM response fails validation', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: 'not valid json {{',
    })

    await expect(generateRecommendation('Test user message', TEST_CTX)).rejects.toThrow()

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        correlationId: 'corr-1',
      })
    )
  })

  test('does not include raw LLM response content in the validation-failure logError call', async () => {
    vi.mocked(anthropicProvider.complete).mockResolvedValue({
      ...MOCK_RAW_RESPONSE,
      content: 'not valid json {{ super-secret-rationale-text',
    })

    await expect(generateRecommendation('Test user message', TEST_CTX)).rejects.toThrow()

    const loggedFields = vi.mocked(logError).mock.calls.map((call) => JSON.stringify(call[0]))
    expect(loggedFields.some((f) => f.includes('super-secret-rationale-text'))).toBe(false)
  })
})
