// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

import { OnboardingFlow } from '@/components/flows/onboarding/OnboardingFlow'

const HORMONAL_OPTIONS = [
  'Menstruating',
  'Pregnant',
  'Menopausal',
  'Post-menopausal',
  'On birth control',
  'On HRT',
]

function renderAtHormonalStep() {
  render(<OnboardingFlow onClose={vi.fn()} onComplete={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /get started/i }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  const yearInput = screen.getByRole('spinbutton')
  fireEvent.change(yearInput, { target: { value: '1988' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('OnboardingFlow — step 3: hormonal life stage', () => {
  test('birth year Continue advances to hormonal life stage step', () => {
    render(<OnboardingFlow onClose={vi.fn()} onComplete={vi.fn()} />)
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
    render(<OnboardingFlow onClose={onClose} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Funmi' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1988' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
