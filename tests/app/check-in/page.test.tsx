// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

afterEach(cleanup)

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
}))

vi.mock('@/components/flows/check-in/CheckInFlow', () => ({
  CheckInFlow: ({ name }: { name: string }) => <div data-testid="check-in-flow">{name}</div>,
}))

beforeEach(() => {
  mockPush.mockReset()
  global.fetch = vi.fn()
})

import CheckInPage from '@/app/check-in/page'

const USER = {
  user: {
    name: 'Amara',
    hormonalLifeStage: ['reproductive'],
  },
}
const PREVIOUS_CHECK_IN = {
  checkIn: {
    todaysPlannedWorkout: '8mi easy run',
  },
}

function mockFetchSuccess() {
  vi.mocked(global.fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify(USER), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(PREVIOUS_CHECK_IN), { status: 200 }))
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('app/check-in/page.tsx — loading state', () => {
  test('CheckInFlow is not rendered while fetching', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<CheckInPage />)
    expect(screen.queryByTestId('check-in-flow')).not.toBeInTheDocument()
  })
})

// ─── Success state ────────────────────────────────────────────────────────────

describe('app/check-in/page.tsx — success state', () => {
  test('renders CheckInFlow after data loads', async () => {
    mockFetchSuccess()
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('check-in-flow')).toBeInTheDocument()
    })
  })

  test('passes user name to CheckInFlow', async () => {
    mockFetchSuccess()
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByText('Amara')).toBeInTheDocument()
    })
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('app/check-in/page.tsx — error state', () => {
  test('shows error UI when fetch throws a network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  test('clicking "Try again" re-fetches data', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
    const callsBefore = vi.mocked(global.fetch).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })
})
