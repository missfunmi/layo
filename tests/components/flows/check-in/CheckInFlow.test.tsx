// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

import { CheckInFlow } from '@/components/flows/check-in/CheckInFlow'

// ─── Landing screen ───────────────────────────────────────────────────────────

describe('CheckInFlow — landing screen: wordmark and layout', () => {
  test('renders láyo wordmark', () => {
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('láyo')).toBeInTheDocument()
  })

  test('renders heading with the user name', () => {
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/ready for today, funmi\?/i)
  })

  test('renders subtext', () => {
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText(/it takes about two minutes/i)).toBeInTheDocument()
  })

  test('renders "Start today\'s check-in" CTA button', () => {
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByRole('button', { name: /start today's check-in/i })).toBeInTheDocument()
  })

  test('does not render a Back button', () => {
    render(<CheckInFlow name="Funmi" />)
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('does not render a Close button', () => {
    render(<CheckInFlow name="Funmi" />)
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })
})

describe('CheckInFlow — landing screen: header date', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('renders the current date formatted as "Weekday Mon Day" in the header', () => {
    vi.setSystemTime(new Date('2026-07-02T08:00:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Thu Jul 2')).toBeInTheDocument()
  })
})

describe('CheckInFlow — landing screen: time-based greeting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows "Good morning" before noon (hour 0)', () => {
    vi.setSystemTime(new Date('2026-07-02T00:00:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good morning')).toBeInTheDocument()
  })

  test('shows "Good morning" at 11:59', () => {
    vi.setSystemTime(new Date('2026-07-02T11:59:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good morning')).toBeInTheDocument()
  })

  test('shows "Good afternoon" at noon (hour 12)', () => {
    vi.setSystemTime(new Date('2026-07-02T12:00:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good afternoon')).toBeInTheDocument()
  })

  test('shows "Good afternoon" at 16:59', () => {
    vi.setSystemTime(new Date('2026-07-02T16:59:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good afternoon')).toBeInTheDocument()
  })

  test('shows "Good evening" at 17:00', () => {
    vi.setSystemTime(new Date('2026-07-02T17:00:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good evening')).toBeInTheDocument()
  })

  test('shows "Good evening" at 23:59', () => {
    vi.setSystemTime(new Date('2026-07-02T23:59:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good evening')).toBeInTheDocument()
  })
})

// ─── Yesterday workout and feedback steps ─────────────────────────────────────

const PREV = {
  plannedWorkout: '8mi easy run @ Z2',
  recommendationHeading: '6mi easy run, no strides',
}

function navigateToYesterdayWorkout(previousCheckIn = PREV) {
  render(<CheckInFlow name="Funmi" previousCheckIn={previousCheckIn} />)
  fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
}

function navigateToYesterdayFeedback(previousCheckIn = PREV) {
  navigateToYesterdayWorkout(previousCheckIn)
  fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('CheckInFlow — skip logic (no previous record)', () => {
  test('landing CTA skips yesterday screens when no previousCheckIn', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={null} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.queryByText(/what did you do yesterday/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/how did it go/i)).not.toBeInTheDocument()
  })

  test('landing CTA skips yesterday screens when previousCheckIn is undefined', () => {
    render(<CheckInFlow name="Funmi" />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.queryByText(/what did you do yesterday/i)).not.toBeInTheDocument()
  })
})

describe('CheckInFlow — step yesterday_workout: layout', () => {
  test('shows heading "What did you do yesterday?"', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByText(/what did you do yesterday/i)).toBeInTheDocument()
  })

  test('shows subtext "Pick the closest match."', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByText(/pick the closest match/i)).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('back button navigates to landing', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByRole('button', { name: /start today's check-in/i })).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('CheckInFlow — step yesterday_workout: option cards', () => {
  test('shows "Your planned workout" card with previousCheckIn.plannedWorkout as detail', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByRole('button', { name: /your planned workout/i })).toBeInTheDocument()
    expect(screen.getByText('8mi easy run @ Z2')).toBeInTheDocument()
  })

  test('shows "No workout on record" when plannedWorkout is undefined', () => {
    navigateToYesterdayWorkout({ plannedWorkout: undefined, recommendationHeading: '6mi easy run' })
    expect(screen.getByText('No workout on record')).toBeInTheDocument()
  })

  test('shows "Láyo\'s suggested workout" card with recommendationHeading as detail', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByRole('button', { name: /láyo's suggested workout/i })).toBeInTheDocument()
    expect(screen.getByText('6mi easy run, no strides')).toBeInTheDocument()
  })

  test('shows "No suggestion on record" when recommendationHeading is undefined', () => {
    navigateToYesterdayWorkout({ plannedWorkout: '8mi easy run', recommendationHeading: undefined })
    expect(screen.getByText('No suggestion on record')).toBeInTheDocument()
  })

  test('shows "Something else" card with "Tell us what you did" detail', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByRole('button', { name: /something else/i })).toBeInTheDocument()
    expect(screen.getByText('Tell us what you did')).toBeInTheDocument()
  })

  test('Continue is disabled when no option selected', () => {
    navigateToYesterdayWorkout()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled after selecting "Your planned workout"', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue is enabled after selecting "Láyo\'s suggested workout"', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /láyo's suggested workout/i }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('selecting "Something else" shows a textarea', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /something else/i }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('Continue is disabled when "Something else" selected and textarea is empty', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /something else/i }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled when "Something else" selected and textarea has text', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /something else/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Went for a hike' } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('deselecting "Something else" hides the textarea', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /something else/i }))
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  test('Continue advances to yesterday_feedback step', () => {
    navigateToYesterdayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/how did it go/i)).toBeInTheDocument()
  })
})

describe('CheckInFlow — step yesterday_feedback: layout', () => {
  test('shows heading "How did it go?"', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByText(/how did it go/i)).toBeInTheDocument()
  })

  test('shows subtext about the session', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByText(/anything worth noting about the session/i)).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows a textarea for feedback', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('shows Continue button', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  test('Continue is enabled when textarea is empty (feedback is optional)', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('shows Skip link', () => {
    navigateToYesterdayFeedback()
    expect(screen.getByText(/skip/i)).toBeInTheDocument()
  })

  test('back button navigates to yesterday_workout', () => {
    navigateToYesterdayFeedback()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/what did you do yesterday/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
