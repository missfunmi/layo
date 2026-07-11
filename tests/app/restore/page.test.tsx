// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

afterEach(cleanup)

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSetDeviceId = vi.fn()

vi.mock('@/lib/device', () => ({
  setDeviceId: (id: string) => mockSetDeviceId(id),
}))

beforeEach(() => {
  mockPush.mockReset()
  mockSetDeviceId.mockReset()
  global.fetch = vi.fn()
})

import RestorePage from '@/app/restore/page'

function typeValue(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Paste here'), { target: { value } })
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe('app/restore/page.tsx — initial state', () => {
  test('shows the welcome back heading', () => {
    render(<RestorePage />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  test('shows the instructional subtext', () => {
    render(<RestorePage />)
    expect(
      screen.getByText("Paste what's on your profile page to get your data back.")
    ).toBeInTheDocument()
  })

  test('Continue button is disabled when input is empty', () => {
    render(<RestorePage />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})

// ─── Back navigation ──────────────────────────────────────────────────────────

describe('app/restore/page.tsx — back button', () => {
  test('back button navigates to /onboarding', () => {
    render(<RestorePage />)
    fireEvent.click(screen.getByLabelText('Go back'))
    expect(mockPush).toHaveBeenCalledWith('/onboarding')
  })
})

// ─── Input ────────────────────────────────────────────────────────────────────

describe('app/restore/page.tsx — input', () => {
  test('Continue button is enabled once a value is entered', () => {
    render(<RestorePage />)
    typeValue('3f9a21c0-8b7e-4f2a-9c1d-77e6b0a3f4e2')
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })
})

// ─── Valid value ──────────────────────────────────────────────────────────────

describe('app/restore/page.tsx — valid value', () => {
  test('calls GET /api/users with the pasted value as X-Device-ID', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    render(<RestorePage />)
    typeValue('3f9a21c0-8b7e-4f2a-9c1d-77e6b0a3f4e2')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users', {
        headers: { 'X-Device-ID': '3f9a21c0-8b7e-4f2a-9c1d-77e6b0a3f4e2' },
      })
    })
  })

  test('persists the pasted value via setDeviceId on 200', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    render(<RestorePage />)
    typeValue('3f9a21c0-8b7e-4f2a-9c1d-77e6b0a3f4e2')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(mockSetDeviceId).toHaveBeenCalledWith('3f9a21c0-8b7e-4f2a-9c1d-77e6b0a3f4e2')
    })
  })

  test('redirects to / on 200', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    render(<RestorePage />)
    typeValue('3f9a21c0-8b7e-4f2a-9c1d-77e6b0a3f4e2')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})

// ─── Invalid value ────────────────────────────────────────────────────────────

describe('app/restore/page.tsx — invalid value', () => {
  test('shows an inline error on 401', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    )
    render(<RestorePage />)
    typeValue('not-a-real-value')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(
        screen.getByText("We don't recognize that. Double check what you pasted and try again.")
      ).toBeInTheDocument()
    })
  })

  test('does not call setDeviceId on 401', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    )
    render(<RestorePage />)
    typeValue('not-a-real-value')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(
        screen.getByText("We don't recognize that. Double check what you pasted and try again.")
      ).toBeInTheDocument()
    })
    expect(mockSetDeviceId).not.toHaveBeenCalled()
  })

  test('does not redirect on 401', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    )
    render(<RestorePage />)
    typeValue('not-a-real-value')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(
        screen.getByText("We don't recognize that. Double check what you pasted and try again.")
      ).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})

// ─── Network error ────────────────────────────────────────────────────────────

describe('app/restore/page.tsx — network error', () => {
  test('shows an inline error when the fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))
    render(<RestorePage />)
    typeValue('3f9a21c0-8b7e-4f2a-9c1d-77e6b0a3f4e2')
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => {
      expect(
        screen.getByText("We don't recognize that. Double check what you pasted and try again.")
      ).toBeInTheDocument()
    })
  })
})
