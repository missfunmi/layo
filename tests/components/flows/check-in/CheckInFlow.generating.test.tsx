// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach, beforeEach, afterAll } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'

afterEach(cleanup)

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/device', () => ({
  getDeviceId: () => 'test-device-id',
  getOrCreateDeviceId: () => 'test-device-id',
  generateCorrelationId: () => 'test-correlation-id',
}))

import { CheckInFlow } from '@/components/flows/check-in/CheckInFlow'
import CheckInPage from '@/app/check-in/page'

const GENERATING_HEADERS = [
  'Reading the full picture...',
  "Let's see what we've got...",
  'Putting it all together...',
  'Give us just a moment...',
  'Almost ready for you...',
  'Working out the details...',
  'Checking in on everything...',
]

const mockOnSuccess = vi.fn()

const PREV = {
  plannedWorkout: '8mi easy run @ Z2',
  recommendationHeading: '6mi easy run, no strides',
}

beforeEach(() => {
  mockPush.mockReset()
  mockOnSuccess.mockReset()
  global.fetch = vi.fn()
})

function navigateToGenerating(opts: { menstruating?: boolean } = {}) {
  const { menstruating = false } = opts
  const hormonalLifeStage = menstruating ? ['menstruating'] : ['post_menopausal']

  render(
    <CheckInFlow
      name="Funmi"
      previousCheckIn={PREV}
      hormonalLifeStage={hormonalLifeStage}
      onSuccess={mockOnSuccess}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
  fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
  fireEvent.click(scaleButtons[3])
  fireEvent.click(scaleButtons[7])
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))

  if (menstruating) {
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }

  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

// ─── Generating screen: layout ────────────────────────────────────────────────

describe('CheckInFlow — generating screen: layout', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  test('stressors Continue navigates to generating screen', () => {
    navigateToGenerating()
    expect(screen.getByText(/láyo is working on your recommendation for today/i)).toBeInTheDocument()
  })

  test('shows a valid header from the 7 allowed strings', () => {
    navigateToGenerating()
    const heading = screen.getByRole('heading', { level: 2 })
    expect(GENERATING_HEADERS).toContain(heading.textContent)
  })

  test('shows subtext about generating recommendation', () => {
    navigateToGenerating()
    expect(screen.getByText(/láyo is working on your recommendation for today\./i)).toBeInTheDocument()
  })

  test('does not show a Back button', () => {
    navigateToGenerating()
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('does not show a Close button', () => {
    navigateToGenerating()
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  test('header rotates to a valid pool string after 3 seconds', () => {
    vi.useFakeTimers()
    navigateToGenerating()
    act(() => { vi.advanceTimersByTime(3000) })
    const heading = screen.getByRole('heading', { level: 2 })
    expect(GENERATING_HEADERS).toContain(heading.textContent)
    vi.useRealTimers()
  })

  test('stressors Skip also navigates to generating screen', () => {
    const hormonalLifeStage = ['post_menopausal']
    render(
      <CheckInFlow
        name="Funmi"
        previousCheckIn={PREV}
        hormonalLifeStage={hormonalLifeStage}
        onSuccess={mockOnSuccess}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    fireEvent.click(scaleButtons[7])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))
    expect(screen.getByText(/láyo is working on your recommendation for today/i)).toBeInTheDocument()
  })
})

// ─── Generating screen: API submission ───────────────────────────────────────

describe('CheckInFlow — generating screen: API submission', () => {
  test('calls POST /api/check-ins on entering generating state', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToGenerating()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/check-ins', expect.objectContaining({ method: 'POST' }))
    })
  })

  test('sends X-Device-ID header with device id', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToGenerating()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    expect((opts.headers as Record<string, string>)['X-Device-ID']).toBe('test-device-id')
  })

  test('sends correct checkInDate, todaysPlannedWorkout, sleepSatisfaction, feelScore', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToGenerating()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.todaysPlannedWorkout).toBe('10mi run')
    expect(body.sleepSatisfaction).toBe(4)
    expect(body.feelScore).toBe(3)
    expect(body.checkInDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('sends yesterdayWorkoutType "planned" when planned workout was selected', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToGenerating()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.yesterdayWorkoutType).toBe('planned')
  })

  test('sends periodStartedToday when user is menstruating', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToGenerating({ menstruating: true })
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(typeof body.periodStartedToday).toBe('boolean')
  })

  test('omits periodStartedToday when user is not menstruating', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToGenerating({ menstruating: false })
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.periodStartedToday).toBeUndefined()
  })

  test('calls onSuccess on 201 response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToGenerating()
    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledOnce())
  })
})

// ─── Generating screen: error state (check-in not saved) ─────────────────────

describe('CheckInFlow — generating screen: error (check-in not saved)', () => {
  test('shows error heading when 503 with checkInSaved: false', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: false }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  test('shows error body mentioning check-in not saved', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: false }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => {
      expect(screen.getByText(/we could not save your check-in/i)).toBeInTheDocument()
    })
  })

  test('shows Try again button when check-in not saved', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: false }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  test('no Back button in check-in-failed error state', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: false }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => screen.getByText(/something went wrong/i))
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('no Close button in check-in-failed error state', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: false }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => screen.getByText(/something went wrong/i))
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })
})

// ─── Generating screen: error state (recommendation failed) ──────────────────

describe('CheckInFlow — generating screen: error (recommendation failed)', () => {
  test('shows distinct message when 503 with checkInSaved: true', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: true }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => {
      expect(
        screen.getByText(/we saved your check-in but could not generate a recommendation/i)
      ).toBeInTheDocument()
    })
  })

  test('shows Try again button when recommendation failed', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: true }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  test('no Back button in recommendation-failed error state', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: true }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => screen.getByText(/we saved your check-in/i))
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('no Close button in recommendation-failed error state', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ checkInSaved: true }), { status: 503 })
    )
    navigateToGenerating()
    await waitFor(() => screen.getByText(/we saved your check-in/i))
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })
})

// ─── Generating screen: retry ─────────────────────────────────────────────────

describe('CheckInFlow — generating screen: retry', () => {
  test('Try again re-submits POST /api/check-ins', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkInSaved: false }), { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    navigateToGenerating()
    await waitFor(() => screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  test('Try again calls onSuccess when retry returns 201', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkInSaved: false }), { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    navigateToGenerating()
    await waitFor(() => screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalledOnce())
  })

  test('shows generating screen again while retrying', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkInSaved: false }), { status: 503 }))
      .mockReturnValueOnce(new Promise(() => {}))
    navigateToGenerating()
    await waitFor(() => screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText(/láyo is working on your recommendation for today/i)).toBeInTheDocument()
  })
})

// ─── app/check-in/page.tsx ───────────────────────────────────────────────────

describe('app/check-in/page.tsx', () => {
  test('renders loading state while fetching (CheckInFlow not yet visible)', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<CheckInPage />)
    expect(screen.queryByRole('button', { name: /start today's check-in/i })).not.toBeInTheDocument()
  })

  test('fetches GET /api/users with device ID header', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<CheckInPage />)
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls
      const usersCall = calls.find(([url]) => url === '/api/users')
      expect(usersCall).toBeDefined()
      expect((usersCall![1] as RequestInit).headers).toMatchObject({ 'X-Device-ID': 'test-device-id' })
    })
  })

  test('fetches GET /api/check-ins with date and device ID header', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    render(<CheckInPage />)
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls
      const checkInCall = calls.find(([url]) => (url as string).startsWith('/api/check-ins?date='))
      expect(checkInCall).toBeDefined()
      expect((checkInCall![1] as RequestInit).headers).toMatchObject({ 'X-Device-ID': 'test-device-id' })
    })
  })

  test('renders CheckInFlow landing screen after data loads', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { name: 'Funmi', hormonalLifeStage: ['post_menopausal'] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkIn: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recommendation: null }), { status: 200 }))
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start today's check-in/i })).toBeInTheDocument()
    })
  })

  test('passes name from user profile to CheckInFlow', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { name: 'Amara', hormonalLifeStage: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkIn: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recommendation: null }), { status: 200 }))
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByText(/ready for today, amara/i)).toBeInTheDocument()
    })
  })

  test('passes previousCheckIn from fetched check-in to CheckInFlow', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { name: 'Funmi', hormonalLifeStage: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkIn: { todaysPlannedWorkout: '6mi tempo' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recommendation: null }), { status: 200 }))
    render(<CheckInPage />)
    await waitFor(() => screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.getByText('6mi tempo')).toBeInTheDocument()
  })

  test('passes recommendationHeading built from yesterday\'s recommendation to CheckInFlow', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { name: 'Funmi', hormonalLifeStage: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkIn: { todaysPlannedWorkout: '6mi tempo' } }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recommendation: { recommendationType: 'modify', modificationDetail: '4x6\' @ HM pace', rationale: 'x' },
          }),
          { status: 200 }
        )
      )
    render(<CheckInPage />)
    await waitFor(() => screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.getByText('4x6\' @ HM pace')).toBeInTheDocument()
  })

  test('passes null previousCheckIn when no previous check-in exists', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { name: 'Funmi', hormonalLifeStage: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkIn: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recommendation: null }), { status: 200 }))
    render(<CheckInPage />)
    await waitFor(() => screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.getByText(/what workout do you have planned today/i)).toBeInTheDocument()
  })
})
