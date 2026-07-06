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

import HomePage from '@/app/page'

function simulateFirstLaunch() {
  mockGetDeviceId.mockReturnValue(null)
}

function mockCheckInFetch(checkIn: object | null) {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ checkIn }), { status: 200 })
  )
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('app/page.tsx — loading state', () => {
  test('shows Láyo wordmark while routing resolves', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<HomePage />)
    expect(screen.getByText('láyo')).toBeInTheDocument()
  })
})

// ─── First launch ─────────────────────────────────────────────────────────────

describe('app/page.tsx — first launch', () => {
  test('redirects to /onboarding when no deviceId exists', async () => {
    simulateFirstLaunch()
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<HomePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })

  test('does not fetch /api/check-ins when no deviceId exists', async () => {
    simulateFirstLaunch()
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<HomePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── Fetch behavior ───────────────────────────────────────────────────────────

describe('app/page.tsx — fetch behavior', () => {
  test('fetches GET /api/check-ins with today\'s date', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<HomePage />)
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls
      const checkInCall = calls.find(([url]) => (url as string).startsWith('/api/check-ins?date='))
      expect(checkInCall).toBeDefined()
    })
  })

  test('fetches GET /api/check-ins with X-Device-ID header', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<HomePage />)
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls
      const checkInCall = calls.find(([url]) => (url as string).startsWith('/api/check-ins?date='))
      expect(checkInCall).toBeDefined()
      expect((checkInCall![1] as RequestInit).headers).toMatchObject({ 'X-Device-ID': 'test-device-id' })
    })
  })
})

// ─── Routing on check-in present ─────────────────────────────────────────────

describe('app/page.tsx — check-in exists', () => {
  test('redirects to /recommendation when check-in is not null', async () => {
    mockCheckInFetch({ sleepSatisfaction: 5, feelScore: 4 })
    render(<HomePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/recommendation')
    })
  })
})

// ─── Routing on no check-in ───────────────────────────────────────────────────

describe('app/page.tsx — no check-in today', () => {
  test('redirects to /check-in when check-in is null', async () => {
    mockCheckInFetch(null)
    render(<HomePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/check-in')
    })
  })
})

// ─── 401 unauthorized ─────────────────────────────────────────────────────────

describe('app/page.tsx — 401 response', () => {
  test('redirects to /onboarding when GET /api/check-ins returns 401', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )
    render(<HomePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('app/page.tsx — error state', () => {
  test('shows error UI when fetch throws a network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<HomePage />)
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  test('shows error UI when fetch returns a non-2xx non-401 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )
    render(<HomePage />)
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  test('clicking "Try again" re-fetches check-ins', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<HomePage />)
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
