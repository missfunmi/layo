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
  CheckInFlow: ({
    name,
    previousCheckIn,
  }: {
    name: string
    previousCheckIn?: { plannedWorkout?: string; recommendationHeading?: string } | null
  }) => (
    <div data-testid="check-in-flow">
      {name}
      <div data-testid="recommendation-heading">{previousCheckIn?.recommendationHeading ?? ''}</div>
    </div>
  ),
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
const NO_RECOMMENDATION = { recommendation: null }

function mockFetchSuccess(recommendationResponse: unknown = NO_RECOMMENDATION) {
  vi.mocked(global.fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify(USER), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(PREVIOUS_CHECK_IN), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(recommendationResponse), { status: 200 }))
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

  test('fetches yesterday\'s recommendation', async () => {
    mockFetchSuccess()
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('check-in-flow')).toBeInTheDocument()
    })
    const requestedUrls = vi.mocked(global.fetch).mock.calls.map((call) => call[0])
    expect(requestedUrls.some((url) => String(url).startsWith('/api/recommendations?date='))).toBe(true)
  })

  test('passes a recommendationHeading built from yesterday\'s "modify" recommendation to CheckInFlow', async () => {
    mockFetchSuccess({
      recommendation: {
        recommendationType: 'modify',
        modificationDetail: "Reduce to 4x6' @ HM pace with 1'30\" rest",
        rationale: 'Stacking two hard days is not the move.',
      },
    })
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('recommendation-heading')).toHaveTextContent(
        "Reduce to 4x6' @ HM pace with 1'30\" rest"
      )
    })
  })

  test('passes a recommendationHeading built from yesterday\'s "rest" recommendation to CheckInFlow', async () => {
    mockFetchSuccess({
      recommendation: {
        recommendationType: 'rest',
        modificationDetail: null,
        rationale: 'You need recovery.',
      },
    })
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('recommendation-heading')).toHaveTextContent('Take a rest day today.')
    })
  })

  test('leaves recommendationHeading undefined when no recommendation exists for yesterday', async () => {
    mockFetchSuccess(NO_RECOMMENDATION)
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('check-in-flow')).toBeInTheDocument()
    })
    expect(screen.getByTestId('recommendation-heading')).toHaveTextContent('')
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
