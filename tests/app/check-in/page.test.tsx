// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

afterEach(cleanup)

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockGetDeviceId = vi.fn<() => string | null>()

vi.mock('@/lib/device', () => ({
  getDeviceId: () => mockGetDeviceId(),
}))

vi.mock('@/components/flows/check-in/CheckInFlow', () => ({
  CheckInFlow: ({
    name,
    previousCheckIn,
  }: {
    name: string
    previousCheckIn?: { plannedWorkout?: string; recommendationHeading?: string; recommendationType?: string } | null
  }) => (
    <div data-testid="check-in-flow">
      {name}
      <div data-testid="recommendation-heading">{previousCheckIn?.recommendationHeading ?? ''}</div>
      <div data-testid="recommendation-type">{previousCheckIn?.recommendationType ?? ''}</div>
    </div>
  ),
}))

beforeEach(() => {
  mockPush.mockReset()
  mockGetDeviceId.mockReturnValue('test-device-id')
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

  test('passes recommendationType "modify" to CheckInFlow for a modify recommendation', async () => {
    mockFetchSuccess({
      recommendation: {
        recommendationType: 'modify',
        modificationDetail: "Reduce to 4x6' @ HM pace",
        rationale: 'x',
      },
    })
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('recommendation-type')).toHaveTextContent('modify')
    })
  })

  test('passes recommendationType "rest" to CheckInFlow for a rest recommendation', async () => {
    mockFetchSuccess({
      recommendation: {
        recommendationType: 'rest',
        modificationDetail: null,
        rationale: 'x',
      },
    })
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('recommendation-type')).toHaveTextContent('rest')
    })
  })

  test('passes recommendationType "as_written" to CheckInFlow for an as_written recommendation', async () => {
    mockFetchSuccess({
      recommendation: {
        recommendationType: 'as_written',
        modificationDetail: null,
        rationale: 'x',
      },
    })
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('recommendation-type')).toHaveTextContent('as_written')
    })
  })

  test('leaves recommendationType undefined when no recommendation exists for yesterday', async () => {
    mockFetchSuccess(NO_RECOMMENDATION)
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByTestId('check-in-flow')).toBeInTheDocument()
    })
    expect(screen.getByTestId('recommendation-type')).toHaveTextContent('')
  })
})

// ─── No local deviceId ─────────────────────────────────────────────────────────

describe('app/check-in/page.tsx — no deviceId', () => {
  test('redirects to /onboarding when no deviceId exists', async () => {
    mockGetDeviceId.mockReturnValue(null)
    render(<CheckInPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })

  test('does not fetch when no deviceId exists', async () => {
    mockGetDeviceId.mockReturnValue(null)
    render(<CheckInPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── 401 unauthorized ─────────────────────────────────────────────────────────

describe('app/check-in/page.tsx — 401 response', () => {
  test('redirects to /onboarding when GET /api/users returns 401', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(PREVIOUS_CHECK_IN), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(NO_RECOMMENDATION), { status: 200 }))
    render(<CheckInPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
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
