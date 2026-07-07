// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
}))

import { OuraConnectStep } from '@/components/flows/onboarding/OuraConnectStep'

function makeProps(overrides: Partial<{
  onBack: () => void
  onClose: () => void
  onContinue: () => void
  active: number
  total: number
}> = {}) {
  return {
    onBack: vi.fn(),
    onClose: vi.fn(),
    onContinue: vi.fn(),
    active: 4,
    total: 5,
    ...overrides,
  }
}

beforeEach(() => {
  // Default: no wearable URL param; fetch returns no active connections
  vi.stubGlobal('location', { ...window.location, search: '' })
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ connections: [] }), { status: 200 })
  )
})

// ─── Default state ────────────────────────────────────────────────────────────

describe('OuraConnectStep — default state', () => {
  test('renders heading', async () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('heading', { name: /connect your oura ring/i })).toBeInTheDocument()
  })

  test('renders subtext', async () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByText(/láyo can use your readiness/i)).toBeInTheDocument()
  })

  test('renders "Connect Oura Ring" CTA', async () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('button', { name: /connect oura ring/i })).toBeInTheDocument()
  })

  test('renders "Skip for now" link', async () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })

  test('back button is present', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('close button is present', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows 5 progress dots with the 5th dot active', () => {
    render(<OuraConnectStep {...makeProps()} />)
    const dotsWrapper = screen.getByTestId('progress-dots')
    const flexContainer = dotsWrapper.querySelector('div')!
    expect(flexContainer.children).toHaveLength(5)
    expect(flexContainer.children[4].className).toContain('w-[18px]')
    expect(flexContainer.children[0].className).not.toContain('w-[18px]')
  })
})

// ─── Connected state (via URL param) ─────────────────────────────────────────

describe('OuraConnectStep — connected state (?wearable=connected)', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, search: '?wearable=connected' })
  })

  test('renders "Oura Ring connected" label', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByText(/oura ring connected/i)).toBeInTheDocument()
  })

  test('renders "Continue" CTA', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  test('does not show "Skip for now" link', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()
  })
})

// ─── Error state (via URL param) ─────────────────────────────────────────────

describe('OuraConnectStep — error state (?wearable=error)', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, search: '?wearable=error' })
  })

  test('renders error banner', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByText(/couldn't connect oura/i)).toBeInTheDocument()
  })

  test('renders "Connect Oura Ring" CTA', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('button', { name: /connect oura ring/i })).toBeInTheDocument()
  })

  test('renders "Skip for now" link', () => {
    render(<OuraConnectStep {...makeProps()} />)
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })
})

// ─── Navigation ───────────────────────────────────────────────────────────────

describe('OuraConnectStep — navigation', () => {
  test('"Skip for now" calls onContinue', () => {
    const props = makeProps()
    render(<OuraConnectStep {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(props.onContinue).toHaveBeenCalledOnce()
  })

  test('"Skip for now" does not call GET /api/wearables/oura/authorize', () => {
    render(<OuraConnectStep {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    const authorizeCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/oura/authorize')
    )
    expect(authorizeCalls).toHaveLength(0)
  })

  test('"Connect Oura Ring" CTA calls GET /api/wearables/oura/authorize', async () => {
    vi.mocked(global.fetch).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/oura/authorize')) {
        return Promise.resolve(
          new Response(JSON.stringify({ authorizationUrl: 'https://cloud.ouraring.com/oauth/authorize' }), { status: 200 })
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ connections: [] }), { status: 200 }))
    })
    render(<OuraConnectStep {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /connect oura ring/i }))
    await waitFor(() => {
      const authorizeCalls = vi.mocked(global.fetch).mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('/oura/authorize')
      )
      expect(authorizeCalls).toHaveLength(1)
    })
  })

  test('back button calls onBack', () => {
    const props = makeProps()
    render(<OuraConnectStep {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(props.onBack).toHaveBeenCalledOnce()
  })

  test('close button calls onClose', () => {
    const props = makeProps()
    render(<OuraConnectStep {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})

// ─── OnboardingFlow: name screen dot count ────────────────────────────────────

// Imported here to keep all onboarding-related dot tests together.
// Tests that the name screen (step 1) shows 5 dots with the 1st active,
// confirming LAYO-96's total=5 update propagated correctly.

import { OnboardingFlow } from '@/components/flows/onboarding/OnboardingFlow'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('OnboardingFlow — name screen progress dots (post LAYO-96)', () => {
  test('shows 5 progress dots on the name screen with the 1st dot active', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    const dotsWrapper = screen.getByTestId('progress-dots')
    const flexContainer = dotsWrapper.querySelector('div')!
    expect(flexContainer.children).toHaveLength(5)
    expect(flexContainer.children[0].className).toContain('w-[18px]')
    expect(flexContainer.children[1].className).not.toContain('w-[18px]')
  })
})
