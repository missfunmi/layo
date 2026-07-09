// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

afterEach(cleanup)

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockGetDeviceId = vi.fn()

vi.mock('@/lib/device', () => ({
  getDeviceId: () => mockGetDeviceId(),
}))

beforeEach(() => {
  mockPush.mockReset()
  mockGetDeviceId.mockReset()
  mockGetDeviceId.mockReturnValue('test-device-id')
  global.fetch = vi.fn()
})

import ProfilePage from '@/app/profile/page'

const PROFILE = {
  userId: 'user-123',
  ouraConnected: true,
  promptVersion: 'v1.2.0',
}

function mockFetchSuccess(profile: typeof PROFILE = PROFILE) {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(profile), { status: 200 })
  )
}

// ─── No deviceId ──────────────────────────────────────────────────────────────

describe('app/profile/page.tsx — no deviceId', () => {
  test('redirects to /onboarding when no deviceId is in localStorage', async () => {
    mockGetDeviceId.mockReturnValue(null)
    render(<ProfilePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })

  test('does not call GET /api/profile when no deviceId is present', async () => {
    mockGetDeviceId.mockReturnValue(null)
    render(<ProfilePage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ─── Loading state ────────────────────────────────────────────────────────────

describe('app/profile/page.tsx — loading state', () => {
  test('shows Láyo wordmark while loading', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<ProfilePage />)
    expect(screen.getByText('láyo')).toBeInTheDocument()
  })
})

// ─── Fetch call ───────────────────────────────────────────────────────────────

describe('app/profile/page.tsx — fetch call', () => {
  test('fetches GET /api/profile with the device ID header', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<ProfilePage />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', {
        headers: { 'X-Device-ID': 'test-device-id' },
      })
    })
  })
})

// ─── Success state ────────────────────────────────────────────────────────────

describe('app/profile/page.tsx — success state', () => {
  test('displays the deviceId from localStorage', async () => {
    mockFetchSuccess()
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('test-device-id')).toBeInTheDocument()
    })
  })

  test('displays the userId from the API response', async () => {
    mockFetchSuccess()
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument()
    })
  })

  test('displays "Connected" when ouraConnected is true', async () => {
    mockFetchSuccess({ ...PROFILE, ouraConnected: true })
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  test('displays "Not connected" when ouraConnected is false', async () => {
    mockFetchSuccess({ ...PROFILE, ouraConnected: false })
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Not connected')).toBeInTheDocument()
    })
  })

  test('displays the AI version from promptVersion', async () => {
    mockFetchSuccess({ ...PROFILE, promptVersion: 'v1.2.0' })
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('v1.2.0')).toBeInTheDocument()
    })
  })

  test('back button navigates to the app root', async () => {
    mockFetchSuccess()
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByLabelText('Go back')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByLabelText('Go back'))
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('app/profile/page.tsx — error state', () => {
  test('shows an error message when the fetch throws a network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText("Couldn't load your profile")).toBeInTheDocument()
    })
  })

  test('shows an error message when the API returns a non-ok response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText("Couldn't load your profile")).toBeInTheDocument()
    })
  })
})
