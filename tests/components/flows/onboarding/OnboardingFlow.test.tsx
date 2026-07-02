// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { OnboardingFlow } from '@/components/flows/onboarding/OnboardingFlow'

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
})

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
