import { vi, describe, test, expect, beforeEach } from 'vitest'

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockMessagesCreate }
  },
}))

import { complete } from '@/lib/llm/providers/anthropic'

const BASE_PARAMS = {
  model: 'claude-opus-4-6',
  temperature: 1.0,
  maxTokens: 1000,
}

const MOCK_API_RESPONSE = {
  content: [{ type: 'text', text: '{}' }],
  usage: { input_tokens: 100, output_tokens: 50 },
}

describe('anthropic provider complete()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockMessagesCreate.mockResolvedValue(MOCK_API_RESPONSE)
  })

  test('does not forward wearable_thresholds to Anthropic API', async () => {
    await complete('System prompt.', 'User message.', {
      ...BASE_PARAMS,
      additionalParams: {
        wearable_thresholds: { readinessScore: { report_threshold_pct: 10, higher_is: 'better' } },
      },
    })

    const callArgs = mockMessagesCreate.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('wearable_thresholds')
  })

  test('forwards recognized Anthropic params from additionalParams', async () => {
    await complete('System prompt.', 'User message.', {
      ...BASE_PARAMS,
      additionalParams: { top_k: 5, top_p: 0.9 },
    })

    const callArgs = mockMessagesCreate.mock.calls[0][0]
    expect(callArgs.top_k).toBe(5)
    expect(callArgs.top_p).toBe(0.9)
  })

  test('sends only the user message in the messages array (no assistant prefill)', async () => {
    await complete('System prompt.', 'User message.', BASE_PARAMS)

    const callArgs = mockMessagesCreate.mock.calls[0][0]
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'User message.' }])
  })

  test('returns content exactly as returned by the API without modification', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"recommendation_type": "as_written"}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const result = await complete('System prompt.', 'User message.', BASE_PARAMS)
    expect(result.content).toBe('{"recommendation_type": "as_written"}')
  })

  test('ignores unknown keys even when mixed with recognized params', async () => {
    await complete('System prompt.', 'User message.', {
      ...BASE_PARAMS,
      additionalParams: {
        top_k: 5,
        wearable_thresholds: { readinessScore: { report_threshold_pct: 10, higher_is: 'better' } },
      },
    })

    const callArgs = mockMessagesCreate.mock.calls[0][0]
    expect(callArgs.top_k).toBe(5)
    expect(callArgs).not.toHaveProperty('wearable_thresholds')
  })
})
