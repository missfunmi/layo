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

beforeEach(() => {
  mockPush.mockReset()
  mockGetDeviceId.mockReturnValue('test-device-id')
  global.fetch = vi.fn()
})

import RecommendationPage from '@/app/recommendation/page'

const RECOMMENDATION = {
  recommendationType: 'as_written',
  modificationDetail: null,
  rationale: 'You slept well and are feeling good.',
}
const CHECK_IN = {
  sleepSatisfaction: 5,
  feelScore: 4,
  cycleDay: 7,
  todaysPlannedWorkout: '10mi tempo run',
  yesterdayWorkoutType: 'planned',
  stressors: null,
}

function mockFetchSuccess() {
  vi.mocked(global.fetch)
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ recommendation: RECOMMENDATION }), { status: 200 })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ checkIn: CHECK_IN }), { status: 200 })
    )
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('app/recommendation/page.tsx — loading state', () => {
  test('RecommendationView is not rendered while fetching', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<RecommendationPage />)
    expect(screen.queryByTestId('overline')).not.toBeInTheDocument()
  })

  test('shows Láyo wordmark while loading', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<RecommendationPage />)
    expect(screen.getByText('láyo')).toBeInTheDocument()
  })
})

// ─── Fetch calls ─────────────────────────────────────────────────────────────

describe('app/recommendation/page.tsx — fetch calls', () => {
  test('fetches GET /api/recommendations with today\'s date and device ID header', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<RecommendationPage />)
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls
      const recCall = calls.find(([url]) => (url as string).startsWith('/api/recommendations?date='))
      expect(recCall).toBeDefined()
      expect((recCall![1] as RequestInit).headers).toMatchObject({ 'X-Device-ID': 'test-device-id' })
    })
  })

  test('fetches GET /api/check-ins with today\'s date and device ID header', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<RecommendationPage />)
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls
      const checkInCall = calls.find(([url]) => (url as string).startsWith('/api/check-ins?date='))
      expect(checkInCall).toBeDefined()
      expect((checkInCall![1] as RequestInit).headers).toMatchObject({ 'X-Device-ID': 'test-device-id' })
    })
  })
})

// ─── Success state ────────────────────────────────────────────────────────────

describe('app/recommendation/page.tsx — success state', () => {
  test('renders RecommendationView after data loads', async () => {
    mockFetchSuccess()
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(screen.getByTestId('overline')).toBeInTheDocument()
    })
  })

  test('passes rationale from recommendation to RecommendationView', async () => {
    mockFetchSuccess()
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(screen.getByText(RECOMMENDATION.rationale)).toBeInTheDocument()
    })
  })

  test('passes sleepSatisfaction from check-in to RecommendationView', async () => {
    mockFetchSuccess()
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(screen.getByText('5 / 5')).toBeInTheDocument()
    })
  })

  test('passes todaysPlannedWorkout from check-in to RecommendationView', async () => {
    mockFetchSuccess()
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(screen.getByText('10mi tempo run')).toBeInTheDocument()
    })
  })
})

// ─── Null recommendation fallback ─────────────────────────────────────────────

describe('app/recommendation/page.tsx — null recommendation fallback', () => {
  test('redirects to /check-in when recommendation is null', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ recommendation: null }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ checkIn: CHECK_IN }), { status: 200 })
      )
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/check-in')
    })
  })
})

// ─── No local deviceId ─────────────────────────────────────────────────────────

describe('app/recommendation/page.tsx — no deviceId', () => {
  test('redirects to /onboarding when no deviceId exists', async () => {
    mockGetDeviceId.mockReturnValue(null)
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })

  test('does not fetch when no deviceId exists', async () => {
    mockGetDeviceId.mockReturnValue(null)
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── 401 unauthorized ─────────────────────────────────────────────────────────

describe('app/recommendation/page.tsx — 401 response', () => {
  test('redirects to /onboarding when GET /api/recommendations returns 401', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkIn: CHECK_IN }), { status: 200 }))
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('app/recommendation/page.tsx — error state', () => {
  test('shows error UI when fetch throws a network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<RecommendationPage />)
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  test('clicking "Try again" re-fetches data', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<RecommendationPage />)
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
