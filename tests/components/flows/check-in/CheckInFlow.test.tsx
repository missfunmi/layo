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

function navigateToYesterdayWorkout(previousCheckIn: { plannedWorkout?: string; recommendationHeading?: string } = PREV) {
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

// ─── Today's planned workout step ────────────────────────────────────────────

function navigateToTodayWorkout(previousCheckIn = PREV) {
  navigateToYesterdayFeedback(previousCheckIn)
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('CheckInFlow — step today_workout: entry paths', () => {
  test('yesterday_feedback Continue navigates to today_workout', () => {
    navigateToYesterdayFeedback()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/what workout do you have planned today/i)).toBeInTheDocument()
  })

  test('landing CTA navigates to today_workout when no previousCheckIn', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={null} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.getByText(/what workout do you have planned today/i)).toBeInTheDocument()
  })

  test('landing CTA navigates to today_workout when previousCheckIn is undefined', () => {
    render(<CheckInFlow name="Funmi" />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.getByText(/what workout do you have planned today/i)).toBeInTheDocument()
  })
})

describe('CheckInFlow — step today_workout: layout', () => {
  test('shows heading "What workout do you have planned today?"', () => {
    navigateToTodayWorkout()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/what workout do you have planned today/i)
  })

  test('shows subtext "Be as specific as you like"', () => {
    navigateToTodayWorkout()
    expect(screen.getByText(/be as specific as you like/i)).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    navigateToTodayWorkout()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateToTodayWorkout()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateToTodayWorkout()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows a textarea for the planned workout', () => {
    navigateToTodayWorkout()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('shows Continue button', () => {
    navigateToTodayWorkout()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })
})

describe('CheckInFlow — step today_workout: Continue validation', () => {
  test('Continue is disabled when textarea is empty', () => {
    navigateToTodayWorkout()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when textarea contains only whitespace', () => {
    navigateToTodayWorkout()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled when textarea has at least 1 non-whitespace character', () => {
    navigateToTodayWorkout()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })
})

describe('CheckInFlow — step today_workout: back navigation', () => {
  test('back button navigates to yesterday_feedback when previousCheckIn is provided', () => {
    navigateToTodayWorkout()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/how did it go/i)).toBeInTheDocument()
  })

  test('back button navigates to landing when no previousCheckIn', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={null} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByRole('button', { name: /start today's check-in/i })).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ─── Sleep and feel step ──────────────────────────────────────────────────────

function navigateToSleepFeel(previousCheckIn = PREV) {
  navigateToTodayWorkout(previousCheckIn)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('CheckInFlow — step sleep_feel: entry', () => {
  test('today_workout Continue navigates to sleep_feel', () => {
    navigateToTodayWorkout()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/how satisfied are you with how you slept/i)).toBeInTheDocument()
  })
})

describe('CheckInFlow — step sleep_feel: layout', () => {
  test('shows sleep heading "How satisfied are you with how you slept?"', () => {
    navigateToSleepFeel()
    expect(screen.getByText(/how satisfied are you with how you slept/i)).toBeInTheDocument()
  })

  test('shows sleep subtext "Do you feel like you got enough sleep last night?"', () => {
    navigateToSleepFeel()
    expect(screen.getByText(/do you feel like you got enough sleep last night/i)).toBeInTheDocument()
  })

  test('shows feel heading "How do you feel?"', () => {
    navigateToSleepFeel()
    expect(screen.getByText(/how do you feel/i)).toBeInTheDocument()
  })

  test('shows feel subtext "How ready are you to tackle today?"', () => {
    navigateToSleepFeel()
    expect(screen.getByText(/how ready are you to tackle today/i)).toBeInTheDocument()
  })

  test('shows sleep scale labels "unsatisfied" and "satisfied"', () => {
    navigateToSleepFeel()
    expect(screen.getByText('unsatisfied')).toBeInTheDocument()
    expect(screen.getByText('satisfied')).toBeInTheDocument()
  })

  test('shows feel scale labels "dragging" and "ready to go"', () => {
    navigateToSleepFeel()
    expect(screen.getByText('dragging')).toBeInTheDocument()
    expect(screen.getByText('ready to go')).toBeInTheDocument()
  })

  test('shows ten scale buttons (5 for sleep, 5 for feel)', () => {
    navigateToSleepFeel()
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    expect(scaleButtons).toHaveLength(10)
  })

  test('shows progress dots', () => {
    navigateToSleepFeel()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateToSleepFeel()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateToSleepFeel()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows Continue button', () => {
    navigateToSleepFeel()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })
})

describe('CheckInFlow — step sleep_feel: Continue validation', () => {
  test('Continue is disabled when neither scale has a selection', () => {
    navigateToSleepFeel()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when only sleep is selected', () => {
    navigateToSleepFeel()
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3]) // sleep: 4
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when only feel is selected', () => {
    navigateToSleepFeel()
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[7]) // feel: 3
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled when both sleep and feel are selected', () => {
    navigateToSleepFeel()
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3]) // sleep: 4
    fireEvent.click(scaleButtons[7]) // feel: 3
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })
})

describe('CheckInFlow — step sleep_feel: back navigation', () => {
  test('back button navigates to today_workout', () => {
    navigateToSleepFeel()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/what workout do you have planned today/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ─── Cycle tracking step ──────────────────────────────────────────────────────

function navigateToCycleTracking(previousCheckIn = PREV) {
  render(<CheckInFlow name="Funmi" previousCheckIn={previousCheckIn} hormonalLifeStage={['menstruating']} />)
  fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
  fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
  fireEvent.click(scaleButtons[3]) // sleep: 4
  fireEvent.click(scaleButtons[7]) // feel: 3
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('CheckInFlow — step cycle_tracking: entry', () => {
  test('sleep_feel Continue navigates to cycle_tracking when hormonalLifeStage includes menstruating', () => {
    navigateToCycleTracking()
    expect(screen.getByText(/did your period start today/i)).toBeInTheDocument()
  })

  test('sleep_feel Continue skips cycle_tracking when hormonalLifeStage does not include menstruating', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} hormonalLifeStage={['post_menopausal']} />)
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
    expect(screen.queryByText(/did your period start today/i)).not.toBeInTheDocument()
  })

  test('sleep_feel Continue skips cycle_tracking when hormonalLifeStage is not provided', () => {
    navigateToSleepFeel()
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    fireEvent.click(scaleButtons[7])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.queryByText(/did your period start today/i)).not.toBeInTheDocument()
  })
})

describe('CheckInFlow — step cycle_tracking: layout', () => {
  test('shows heading "Did your period start today?"', () => {
    navigateToCycleTracking()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/did your period start today\?/i)
  })

  test('shows subtext about cycle tracking', () => {
    navigateToCycleTracking()
    expect(screen.getByText(/láyo uses this to track where you are in your cycle/i)).toBeInTheDocument()
  })

  test('shows "Yes" button', () => {
    navigateToCycleTracking()
    expect(screen.getByRole('button', { name: /^yes$/i })).toBeInTheDocument()
  })

  test('shows "No" button', () => {
    navigateToCycleTracking()
    expect(screen.getByRole('button', { name: /^no$/i })).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    navigateToCycleTracking()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateToCycleTracking()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateToCycleTracking()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows Continue button', () => {
    navigateToCycleTracking()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })
})

describe('CheckInFlow — step cycle_tracking: Continue validation', () => {
  test('Continue is disabled when no option selected', () => {
    navigateToCycleTracking()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled after selecting Yes', () => {
    navigateToCycleTracking()
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue is enabled after selecting No', () => {
    navigateToCycleTracking()
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })
})

describe('CheckInFlow — step cycle_tracking: back navigation', () => {
  test('back button navigates to sleep_feel', () => {
    navigateToCycleTracking()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/how satisfied are you with how you slept/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} hormonalLifeStage={['menstruating']} onClose={onClose} />)
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
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ─── Stressors step ───────────────────────────────────────────────────────────

function navigateToStressors(previousCheckIn = PREV) {
  render(<CheckInFlow name="Funmi" previousCheckIn={previousCheckIn} hormonalLifeStage={['menstruating']} />)
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
  fireEvent.click(screen.getByRole('button', { name: /^yes$/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('CheckInFlow — step stressors: entry', () => {
  test('cycle_tracking Continue navigates to stressors', () => {
    navigateToStressors()
    expect(screen.getByText(/anything new since yesterday/i)).toBeInTheDocument()
  })

  test('sleep_feel Continue navigates to stressors when hormonalLifeStage does not include menstruating', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} hormonalLifeStage={['post_menopausal']} />)
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
    expect(screen.getByText(/anything new since yesterday/i)).toBeInTheDocument()
  })

  test('sleep_feel Continue navigates to stressors when hormonalLifeStage is not provided', () => {
    navigateToSleepFeel()
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    fireEvent.click(scaleButtons[7])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/anything new since yesterday/i)).toBeInTheDocument()
  })
})

describe('CheckInFlow — step stressors: layout', () => {
  test('shows heading "Anything new since yesterday?"', () => {
    navigateToStressors()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/anything new since yesterday\?/i)
  })

  test('shows subtext about travel and illness', () => {
    navigateToStressors()
    expect(screen.getByText(/travel, illness, bad news/i)).toBeInTheDocument()
  })

  test('shows a textarea', () => {
    navigateToStressors()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('textarea has the correct placeholder', () => {
    navigateToStressors()
    expect(screen.getByPlaceholderText(/e\.g\. bad night's sleep/i)).toBeInTheDocument()
  })

  test('shows character count display', () => {
    navigateToStressors()
    expect(screen.getByText('0/280')).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    navigateToStressors()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateToStressors()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateToStressors()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows Continue button', () => {
    navigateToStressors()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  test('shows Skip link', () => {
    navigateToStressors()
    expect(screen.getByText(/skip/i)).toBeInTheDocument()
  })
})

describe('CheckInFlow — step stressors: Continue validation', () => {
  test('Continue is enabled when textarea is empty (stressors is optional)', () => {
    navigateToStressors()
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue is enabled when textarea has text', () => {
    navigateToStressors()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Stressful day at work' } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })
})

describe('CheckInFlow — step stressors: back navigation', () => {
  test('back button navigates to cycle_tracking when hormonalLifeStage includes menstruating', () => {
    navigateToStressors()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/did your period start today/i)).toBeInTheDocument()
  })

  test('back button navigates to sleep_feel when hormonalLifeStage does not include menstruating', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} hormonalLifeStage={['post_menopausal']} />)
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
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/how satisfied are you with how you slept/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} hormonalLifeStage={['menstruating']} onClose={onClose} />)
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
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
