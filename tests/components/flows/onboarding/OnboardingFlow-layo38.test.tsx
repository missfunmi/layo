// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
}))

import { OnboardingFlow } from '@/components/flows/onboarding/OnboardingFlow'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }))
})

function navigateTo(step: 'training_goal' | 'race_details') {
  render(<OnboardingFlow onClose={vi.fn()} onComplete={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  if (step === 'race_details') {
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
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

  test('Continue is enabled after selecting "A specific race"', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('Continue is enabled after selecting "Other reasons"', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: 'Other reasons' }))
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  test('"A specific race" + Continue advances to race details step', () => {
    navigateTo('training_goal')
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/tell us about your race/i)).toBeInTheDocument()
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
    render(<OnboardingFlow onClose={onClose} onComplete={vi.fn()} />)
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

describe('OnboardingFlow — step 5: race details', () => {
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

  test('shows heading and subtext', () => {
    navigateTo('race_details')
    expect(screen.getByText(/tell us about your race/i)).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByPlaceholderText('Event name'), { target: { value: 'NYC Marathon' } })
    fireEvent.change(screen.getByRole('combobox', { name: /event type/i }), { target: { value: 'Running' } })
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: tomorrow } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/you're all set, funmi/i)).toBeInTheDocument()
  })

  test('back button navigates to training goal step', () => {
    navigateTo('race_details')
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(screen.getByText(/what are you training for/i)).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<OnboardingFlow onClose={onClose} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Menstruating' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'A specific race' }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
