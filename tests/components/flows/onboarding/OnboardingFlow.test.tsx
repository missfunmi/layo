// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

afterEach(cleanup)

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
  generateCorrelationId: () => 'test-correlation-id',
}))

vi.mock('@/components/flows/onboarding/OuraConnectStep', () => ({
  OuraConnectStep: ({ onBack, onClose, onContinue }: {
    onBack: () => void
    onClose: () => void
    onContinue: () => void
  }) => (
    <div data-testid="oura-connect-step">
      <button type="button" aria-label="Go back" onClick={onBack} />
      <button type="button" aria-label="Close" onClick={onClose} />
      <button type="button" onClick={onContinue}>Skip for now</button>
    </div>
  ),
}))

import { OnboardingFlow } from '@/components/flows/onboarding/OnboardingFlow'
import OnboardingPage from '@/app/onboarding/page'

beforeEach(() => {
  mockPush.mockReset()
  global.fetch = vi.fn()
})

// ─── Welcome screen ───────────────────────────────────────────────────────────

describe('OnboardingFlow — welcome screen', () => {
  test('renders wordmark on welcome screen', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    expect(screen.getByText('láyo')).toBeInTheDocument()
  })

  test('renders tagline on welcome screen', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    expect(screen.getByText(/your daily training companion/i)).toBeInTheDocument()
  })

  test('renders "Get started" CTA on welcome screen', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  test('"Get started" advances to name step', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(screen.getByText(/what should we call you/i)).toBeInTheDocument()
  })
})

// ─── Step 1: name ─────────────────────────────────────────────────────────────

describe('OnboardingFlow — step 1: name', () => {
  function renderAtNameStep() {
    render(<OnboardingFlow onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  }

  test('shows progress dots with step 1 active', () => {
    renderAtNameStep()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows close button', () => {
    renderAtNameStep()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('back button is visible on step 1', () => {
    renderAtNameStep()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('back button on step 1 navigates to welcome screen', () => {
    renderAtNameStep()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  test('Continue is disabled when name is empty', () => {
    renderAtNameStep()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when name is whitespace only', () => {
    renderAtNameStep()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when name exceeds 50 characters', () => {
    renderAtNameStep()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'a'.repeat(51) } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled when name has 1 character', () => {
    renderAtNameStep()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'A' } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue is enabled when name has 50 characters', () => {
    renderAtNameStep()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'a'.repeat(50) } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<OnboardingFlow onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('Continue advances to birth year step', () => {
    renderAtNameStep()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/what year were you born/i)).toBeInTheDocument()
  })

  test('shows "Already used Láyo?" link', () => {
    renderAtNameStep()
    expect(screen.getByText('Already used Láyo?')).toBeInTheDocument()
  })

  test('"Already used Láyo?" navigates to /restore', () => {
    renderAtNameStep()
    fireEvent.click(screen.getByText('Already used Láyo?'))
    expect(mockPush).toHaveBeenCalledWith('/restore')
  })
})

// ─── Step 2: birth year ───────────────────────────────────────────────────────

describe('OnboardingFlow — step 2: birth year', () => {
  function renderAtBirthYearStep() {
    render(<OnboardingFlow onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }

  test('shows progress dots with step 2 active', () => {
    renderAtBirthYearStep()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows close button', () => {
    renderAtBirthYearStep()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows back button', () => {
    renderAtBirthYearStep()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('back button navigates to name step', () => {
    renderAtBirthYearStep()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/what should we call you/i)).toBeInTheDocument()
  })

  test('Continue is disabled when birth year is empty', () => {
    renderAtBirthYearStep()
    expect(screen.getByRole('spinbutton')).toHaveValue(null)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when birth year is not 4 digits', () => {
    renderAtBirthYearStep()
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '198' } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when birth year is below minimum (currentYear - 100)', () => {
    renderAtBirthYearStep()
    const minYear = new Date().getFullYear() - 100 - 1
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: String(minYear) } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when birth year is above maximum (currentYear - 13)', () => {
    renderAtBirthYearStep()
    const maxYear = new Date().getFullYear() - 13 + 1
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: String(maxYear) } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled for a valid birth year at lower bound', () => {
    renderAtBirthYearStep()
    const minYear = new Date().getFullYear() - 100
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: String(minYear) } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue is enabled for a valid birth year at upper bound', () => {
    renderAtBirthYearStep()
    const maxYear = new Date().getFullYear() - 13
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: String(maxYear) } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<OnboardingFlow onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ─── Step 3: hormonal life stage ──────────────────────────────────────────────

const HORMONAL_OPTIONS = [
  'Menstruating',
  'Pregnant',
  'Menopausal',
  'Post-menopausal',
  'On birth control',
  'On HRT',
]

function renderAtHormonalStep() {
  render(<OnboardingFlow onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('OnboardingFlow — step 3: hormonal life stage', () => {
  test('birth year Continue advances to hormonal life stage step', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/which of these applies to you/i)).toBeInTheDocument()
  })

  test('shows subtext', () => {
    renderAtHormonalStep()
    expect(screen.getByText(/hormones affect training more than most plans account for/i)).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    renderAtHormonalStep()
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    renderAtHormonalStep()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    renderAtHormonalStep()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('renders all 6 pill options', () => {
    renderAtHormonalStep()
    for (const option of HORMONAL_OPTIONS) {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    }
  })

  test('Continue is disabled when no pills are selected', () => {
    renderAtHormonalStep()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled after selecting one pill', () => {
    renderAtHormonalStep()
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue remains enabled after selecting multiple pills', () => {
    renderAtHormonalStep()
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    fireEvent.click(screen.getByRole('button', { name: 'On birth control' }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('deselecting the only selected pill disables Continue', () => {
    renderAtHormonalStep()
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('back button navigates to birth year step', () => {
    renderAtHormonalStep()
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/what year were you born/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<OnboardingFlow onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ─── Steps 4 & 5: training goal and race details ──────────────────────────────

function navigateTo(step: 'training_goal' | 'race_details') {
  render(<OnboardingFlow onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  if (step === 'race_details') {
    // race detail fields appear inline when "A specific race" is selected
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
  }
}

describe('OnboardingFlow — step 4: training goal', () => {
  test('hormonal life stage Continue advances to training goal step', () => {
    navigateTo('training_goal')
    expect(screen.getByText(/what are you training for/i)).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    navigateTo('training_goal')
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateTo('training_goal')
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateTo('training_goal')
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows both training goal options', () => {
    navigateTo('training_goal')
    expect(screen.getByRole('button', { name: 'A specific race' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Other reasons' })).toBeInTheDocument()
  })

  test('Continue is disabled when no option selected', () => {
    navigateTo('training_goal')
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when "A specific race" is selected but race details are empty', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled after selecting "Other reasons"', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: 'Other reasons' }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('selecting "A specific race" shows race detail fields inline', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    expect(screen.getByPlaceholderText('Event name')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /event type/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/event date/i)).toBeInTheDocument()
  })

  test('race detail fields are hidden when "Other reasons" is selected', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.click(screen.getByRole('button', { name: 'Other reasons' }))
    expect(screen.queryByPlaceholderText('Event name')).not.toBeInTheDocument()
  })

  test('"Other reasons" + Continue shows confirmation screen without race details', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Other reasons' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(screen.queryByText(/tell us about your race/i)).not.toBeInTheDocument()
    expect(screen.getByText(/you're all set, funmi/i)).toBeInTheDocument()
  })

  test('back button navigates to hormonal life stage step', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/which of these applies to you/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<OnboardingFlow onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('OnboardingFlow — step 4: race details (inline)', () => {
  const tomorrow = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('en-CA')
  })()
  const yesterday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toLocaleDateString('en-CA')
  })()
  const today = new Date().toLocaleDateString('en-CA')

  test('shows subtext when race fields are shown', () => {
    navigateTo('race_details')
    expect(screen.getByText(/láyo uses this to pace your recommendations/i)).toBeInTheDocument()
  })

  test('shows progress dots', () => {
    navigateTo('race_details')
    expect(screen.getByTestId('progress-dots')).toBeInTheDocument()
  })

  test('shows back button', () => {
    navigateTo('race_details')
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  test('shows close button', () => {
    navigateTo('race_details')
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  test('shows event name input', () => {
    navigateTo('race_details')
    expect(screen.getByPlaceholderText('Event name')).toBeInTheDocument()
  })

  test('shows event type picker', () => {
    navigateTo('race_details')
    expect(screen.getByRole('combobox', { name: /event type/i })).toBeInTheDocument()
  })

  test('event type picker has all required options', () => {
    navigateTo('race_details')
    const select = screen.getByRole('combobox', { name: /event type/i })
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    for (const type of ['Running', 'Cycling', 'Swimming', 'Triathlon', 'Skiing', 'Other']) {
      expect(options).toContain(type)
    }
  })

  test('shows event date picker', () => {
    navigateTo('race_details')
    expect(screen.getByLabelText(/event date/i)).toBeInTheDocument()
  })

  test('Continue is disabled when all fields empty', () => {
    navigateTo('race_details')
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when event name is empty', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when event type is not selected', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when event date is not set', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when event date is today', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: today } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is disabled when event date is in the past', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: yesterday } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled when all required fields are valid', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('selecting "Other" event type shows detail input', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Other' } })
    expect(screen.getByPlaceholderText('Type of event')).toBeInTheDocument()
  })

  test('Continue is disabled when "Other" selected and detail is empty', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Other' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  test('Continue is enabled when "Other" selected and detail is filled', () => {
    navigateTo('race_details')
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Other' } })
    fireEvent.change(screen.getByPlaceholderText('Type of event'), { target: { value: 'Nordic skiing' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue with all valid fields shows confirmation screen', () => {
    render(<OnboardingFlow onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(screen.getByText(/you're all set, funmi/i)).toBeInTheDocument()
  })

  test('back button navigates to hormonal life stage step', () => {
    navigateTo('race_details')
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/which of these applies to you/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<OnboardingFlow onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ─── Confirmation screen ──────────────────────────────────────────────────────

const tomorrowDate = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA')
})()

function navigateToConfirmation(path: 'non_race' | 'race' = 'non_race') {
  render(<OnboardingFlow onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  if (path === 'race') {
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrowDate } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Other reasons' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  }
  // Advance through the Oura connect step
  fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
}

describe('OnboardingFlow — confirmation screen: UI', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
  })

  test('shows wordmark', () => {
    navigateToConfirmation()
    expect(screen.getByText('láyo')).toBeInTheDocument()
  })

  test('shows "You\'re all set, [name]." heading', () => {
    navigateToConfirmation()
    expect(screen.getByText(/you're all set, funmi\./i)).toBeInTheDocument()
  })

  test('shows subtext about coming back tomorrow', () => {
    navigateToConfirmation()
    expect(screen.getByText(/come back tomorrow morning/i)).toBeInTheDocument()
  })

  test('does not show Back button', () => {
    navigateToConfirmation()
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('does not show Close button', () => {
    navigateToConfirmation()
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })
})

describe('OnboardingFlow — confirmation screen: API submission', () => {
  test('calls POST /api/users on mount', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }))
    })
  })

  test('submits correct non-race payload with API values', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation('non_race')
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.name).toBe('Funmi')
    expect(body.birthYear).toBe(1988)
    expect(body.hormonalLifeStage).toEqual(['menstruating'])
    expect(body.trainingGoal).toBe('non_race')
    expect(body.deviceId).toBeTruthy()
    expect(body.eventName).toBeUndefined()
  })

  test('submits correct race payload with API values', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation('race')
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string)
    expect(body.trainingGoal).toBe('race')
    expect(body.eventName).toBe('NYC Marathon')
    expect(body.eventType).toBe('running')
    expect(body.eventDate).toBe(tomorrowDate)
    expect(body.eventTypeOther).toBeUndefined()
  })

  test('navigates to /check-in on successful response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/check-in')
    })
  })
})

describe('OnboardingFlow — confirmation screen: error state', () => {
  test('shows error message on non-ok API response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  test('shows error message when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network error'))
    navigateToConfirmation()
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  test('shows retry CTA in error state', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  test('error state has no Back button', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByText(/something went wrong/i))
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  test('error state has no Close button', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 500 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByText(/something went wrong/i))
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  test('retry button re-submits to API', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  test('retry navigates to /check-in on success', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    navigateToConfirmation()
    await waitFor(() => screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/check-in')
    })
  })
})

// ─── app/onboarding/page.tsx ──────────────────────────────────────────────────

describe('app/onboarding/page.tsx', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
  })

  test('renders OnboardingFlow with welcome screen', () => {
    render(<OnboardingPage />)
    expect(screen.getByText('láyo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })
})
