// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

afterEach(cleanup)

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
  generateCorrelationId: () => 'test-correlation-id',
}))

import { CheckInFlow } from '@/components/flows/check-in/CheckInFlow'

const PREV = {
  plannedWorkout: '8mi easy run @ Z2',
  recommendationHeading: '6mi easy run, no strides',
  recommendationType: 'modify' as const,
}

const GENERATING_HEADERS = [
  'Reading the full picture...',
  "Let's see what we've got...",
  'Putting it all together...',
  'Give us just a moment...',
  'Almost ready for you...',
  'Working out the details...',
  'Checking in on everything...',
]

beforeEach(() => {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
})

// ─── Landing: time-based greeting ────────────────────────────────────────────

describe('CheckInFlow smoke — landing: time-based greeting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows "Good morning" before 12', () => {
    vi.setSystemTime(new Date('2026-07-03T08:00:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good morning')).toBeInTheDocument()
  })

  test('shows "Good afternoon" at hour 14', () => {
    vi.setSystemTime(new Date('2026-07-03T14:00:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good afternoon')).toBeInTheDocument()
  })

  test('shows "Good evening" at hour 19', () => {
    vi.setSystemTime(new Date('2026-07-03T19:00:00'))
    render(<CheckInFlow name="Funmi" />)
    expect(screen.getByText('Good evening')).toBeInTheDocument()
  })
})

// ─── Yesterday's workout: three option cards ─────────────────────────────────

describe('CheckInFlow smoke — yesterday_workout: three option cards', () => {
  test('renders exactly three option cards', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    const cards = screen.getAllByRole('button', { name: /your planned workout|láyo's suggested alternative|something else/i })
    expect(cards).toHaveLength(3)
  })

  test('selecting "Something else" expands a TextArea', () => {
    render(<CheckInFlow name="Funmi" previousCheckIn={PREV} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /something else/i }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})

// ─── Today's workout: Continue disabled on empty/whitespace ──────────────────

describe("CheckInFlow smoke — today_workout: Continue disabled", () => {
  function navigateToTodayWorkout() {
    render(<CheckInFlow name="Funmi" />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
  }

  test('Continue is disabled when field is empty', () => {
    navigateToTodayWorkout()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when field contains only whitespace', () => {
    navigateToTodayWorkout()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})

// ─── Sleep and feel: Continue disabled until both selected ───────────────────

describe('CheckInFlow smoke — sleep_feel: Continue requires both selections', () => {
  function navigateToSleepFeel() {
    render(<CheckInFlow name="Funmi" />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }

  test('Continue is disabled until both scale inputs have a selection', () => {
    navigateToSleepFeel()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('selecting only sleep does not enable Continue', () => {
    navigateToSleepFeel()
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })
})

// ─── Cycle tracking: conditional on hormonalLifeStage ────────────────────────

describe('CheckInFlow smoke — cycle_tracking: conditional rendering', () => {
  function navigateToSleepFeelContinue(menstruating: boolean) {
    const hormonalLifeStage = menstruating ? ['menstruating'] : ['post_menopausal']
    render(<CheckInFlow name="Funmi" hormonalLifeStage={hormonalLifeStage} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    fireEvent.click(scaleButtons[7])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }

  test('cycle tracking screen is shown when hormonalLifeStage includes "menstruating"', () => {
    navigateToSleepFeelContinue(true)
    expect(screen.getByText(/did your period start today/i)).toBeInTheDocument()
  })

  test('cycle tracking screen is not shown when hormonalLifeStage does not include "menstruating"', () => {
    navigateToSleepFeelContinue(false)
    expect(screen.queryByText(/did your period start today/i)).not.toBeInTheDocument()
  })
})

// ─── Stressors: Skip link present ────────────────────────────────────────────

describe('CheckInFlow smoke — stressors: Skip link', () => {
  test('stressors screen renders a Skip link', () => {
    render(<CheckInFlow name="Funmi" />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    fireEvent.click(scaleButtons[7])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('button', { name: /^skip$/i })).toBeInTheDocument()
  })
})

// ─── Generating: spinner and heading ─────────────────────────────────────────

describe('CheckInFlow smoke — generating: spinner and heading', () => {
  function navigateToGenerating() {
    render(<CheckInFlow name="Funmi" hormonalLifeStage={['post_menopausal']} />)
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    fireEvent.click(scaleButtons[7])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }

  test('renders a spinner element', () => {
    navigateToGenerating()
    expect(screen.getByTestId('generating-spinner')).toBeInTheDocument()
  })

  test('renders a heading that is one of the 7 allowed strings', () => {
    navigateToGenerating()
    const heading = screen.getByRole('heading', { level: 2 })
    expect(GENERATING_HEADERS).toContain(heading.textContent)
  })
})

// ─── All question screens: CloseButton and BackButton ────────────────────────

describe('CheckInFlow smoke — question screens: CloseButton and BackButton present', () => {
  const PREV_WITH_DATA = PREV

  function renderAtStep(step: number) {
    render(
      <CheckInFlow
        name="Funmi"
        previousCheckIn={PREV_WITH_DATA}
        hormonalLifeStage={['menstruating']}
        onClose={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /start today's check-in/i }))
    if (step === 0) return
    fireEvent.click(screen.getByRole('button', { name: /your planned workout/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    if (step === 1) return
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    if (step === 2) return
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '10mi run' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    if (step === 3) return
    const scaleButtons = screen.getAllByRole('button', { name: /^[1-5]$/ })
    fireEvent.click(scaleButtons[3])
    fireEvent.click(scaleButtons[7])
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    if (step === 4) return
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }

  const SCREEN_LABELS = [
    'yesterday_workout (screen 1)',
    'yesterday_feedback (screen 2)',
    'today_workout (screen 3)',
    'sleep_feel (screen 4)',
    'cycle_tracking (screen 5)',
    'stressors (screen 6)',
  ]

  SCREEN_LABELS.forEach((label, i) => {
    test(`CloseButton is present on ${label}`, () => {
      renderAtStep(i)
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })

    test(`BackButton is present on ${label}`, () => {
      renderAtStep(i)
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
    })
  })
})
