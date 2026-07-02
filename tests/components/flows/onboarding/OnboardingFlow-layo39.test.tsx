// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

afterEach(cleanup)

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
}))

import { OnboardingFlow } from '@/components/flows/onboarding/OnboardingFlow'
import OnboardingPage from '@/app/onboarding/page'

const tomorrow = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA')
})()

beforeEach(() => {
  mockPush.mockReset()
  global.fetch = vi.fn()
})

function navigateToConfirmation(path: 'non_race' | 'race' = 'non_race') {
  render(<OnboardingFlow onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  if (path === 'race') {
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Other reasons' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }
}

describe('OnboardingFlow — confirmation screen: UI', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
  })

  test('shows wordmark', () => {
    navigateToConfirmation()
    expect(screen.getByText('láyo')).toBeInTheDocument()
  })

  test('shows "You\'re all set, [name]." heading', () => {
    navigateToConfirmation()
    expect(screen.getByText(/you're all set, funmi\./i)).toBeInTheDocument()
  })

  test('shows subtext about coming back tomorrow', () => {
    navigateToConfirmation()
    expect(screen.getByText(/come back tomorrow morning/i)).toBeInTheDocument()
  })

  test('does not show Back button', () => {
    navigateToConfirmation()
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('does not show Close button', () => {
    navigateToConfirmation()
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })
})

describe('OnboardingFlow — confirmation screen: API submission', () => {
  test('calls POST /api/users on mount', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }))
    })
  })

  test('submits correct non-race payload with API values', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation('non_race')
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.name).toBe('Funmi')
    expect(body.birthYear).toBe(1988)
    expect(body.hormonalLifeStage).toEqual(['menstruating'])
    expect(body.trainingGoal).toBe('non_race')
    expect(body.deviceId).toBeTruthy()
    expect(body.eventName).toBeUndefined()
  })

  test('submits correct race payload with API values', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation('race')
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.trainingGoal).toBe('race')
    expect(body.eventName).toBe('NYC Marathon')
    expect(body.eventType).toBe('running')
    expect(body.eventDate).toBe(tomorrow)
    expect(body.eventTypeOther).toBeUndefined()
  })

  test('navigates to /check-in on successful response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/check-in')
    })
  })
})

describe('OnboardingFlow — confirmation screen: error state', () => {
  test('shows error message on non-ok API response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  test('shows error message when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network error'))
    navigateToConfirmation()
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  test('shows retry CTA in error state', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  test('error state has no Back button', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByText(/something went wrong/i))
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('error state has no Close button', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByText(/something went wrong/i))
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  test('retry button re-submits to API', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  test('retry navigates to /check-in on success', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/check-in')
    })
  })
})

describe('app/onboarding/page.tsx', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
  })

  test('renders OnboardingFlow with welcome screen', () => {
    render(<OnboardingPage />)
    expect(screen.getByText('láyo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })
})
