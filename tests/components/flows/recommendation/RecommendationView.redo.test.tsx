// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
}))

import { RecommendationView } from '@/components/flows/recommendation/RecommendationView'

const AS_WRITTEN_REC = {
  recommendationType: 'as_written' as const,
  modificationDetail: null as string | null,
  rationale: 'You slept well.',
}
const BASE_CHECK_IN = {
  sleepScore: 5,
  feelScore: 4,
  todaysPlannedWorkout: '10mi tempo run',
}

// ─── Redo button ──────────────────────────────────────────────────────────────

describe('RecommendationView — redo button', () => {
  test('uses ti-reload icon', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    const btn = screen.getByRole('button', { name: /redo today's check-in/i })
    expect(btn.querySelector('.ti-reload')).not.toBeNull()
  })
})

// ─── Confirmation modal: initial state ───────────────────────────────────────

describe('RecommendationView — redo modal: initial state', () => {
  test('confirmation modal is not visible on initial render', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.queryByText("Redo today's check-in?")).not.toBeInTheDocument()
  })
})

// ─── Confirmation modal: open ─────────────────────────────────────────────────

describe('RecommendationView — redo modal: opening', () => {
  test('clicking "Redo today\'s check-in" shows confirmation modal', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    expect(screen.getByText("Redo today's check-in?")).toBeInTheDocument()
  })

  test('modal shows warning body text', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    expect(
      screen.getByText(
        'This will delete your check-in and recommendation for today. This cannot be undone.'
      )
    ).toBeInTheDocument()
  })

  test('modal has "Delete and redo" CTA', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    expect(screen.getByRole('button', { name: /delete and redo/i })).toBeInTheDocument()
  })

  test('modal has "Cancel" CTA', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
  })
})

// ─── Confirmation modal: Cancel ───────────────────────────────────────────────

describe('RecommendationView — redo modal: Cancel', () => {
  test('clicking Cancel closes the modal', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    expect(screen.getByText("Redo today's check-in?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText("Redo today's check-in?")).not.toBeInTheDocument()
  })
})

// ─── Confirmation modal: Delete and redo ─────────────────────────────────────

describe('RecommendationView — redo modal: Delete and redo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-03T12:00:00'))
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('calls DELETE /api/check-ins with today\'s date', async () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete and redo/i }))
    await vi.runAllTimersAsync()

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/check-ins?date=2026-07-03',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  test('includes X-Device-ID header in the DELETE request', async () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete and redo/i }))
    await vi.runAllTimersAsync()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Device-ID': 'test-device-id' }),
      })
    )
  })

  test('calls onRedo after successful delete', async () => {
    const onRedo = vi.fn()
    render(
      <RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} onRedo={onRedo} />
    )
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete and redo/i }))
    await vi.runAllTimersAsync()

    expect(onRedo).toHaveBeenCalledTimes(1)
  })
})
