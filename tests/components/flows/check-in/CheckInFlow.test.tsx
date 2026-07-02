// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

import { CheckInFlow } from '@/components/flows/check-in/CheckInFlow'

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
