// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'test-device-id',
}))

beforeEach(() => {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
})

import { RecommendationView } from '@/components/flows/recommendation/RecommendationView'

const AS_WRITTEN_REC = {
  recommendationType: 'as_written' as const,
  modificationDetail: null as string | null,
  rationale: 'You slept well.',
}
const MODIFY_REC = {
  recommendationType: 'modify' as const,
  modificationDetail: 'Cut the run to 6 miles and keep it fully easy.',
  rationale: 'Sleep was solid but you are sitting at a 3.',
}
const REST_REC = {
  recommendationType: 'rest' as const,
  modificationDetail: null as string | null,
  rationale: 'Poor sleep and you are fighting a cold.',
}
const BASE_CHECK_IN = {
  sleepScore: 5,
  feelScore: 4,
  todaysPlannedWorkout: '10mi tempo run',
  yesterdayWorkoutType: 'planned' as const,
}

// ─── State colors ─────────────────────────────────────────────────────────────

describe('RecommendationView smoke — as_written state colors', () => {
  test('overline renders in #0F6E56', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('overline')).toHaveStyle({ color: '#0F6E56' })
  })

  test('divider renders in #5DCAA5', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('verdict-divider')).toHaveStyle({ backgroundColor: '#5DCAA5' })
  })
})

describe('RecommendationView smoke — modify state colors', () => {
  test('overline renders in #BA7517', () => {
    render(<RecommendationView recommendation={MODIFY_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('overline')).toHaveStyle({ color: '#BA7517' })
  })

  test('divider renders in #FAC775', () => {
    render(<RecommendationView recommendation={MODIFY_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('verdict-divider')).toHaveStyle({ backgroundColor: '#FAC775' })
  })

  test('modificationDetail appears in the heading', () => {
    render(<RecommendationView recommendation={MODIFY_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByRole('heading')).toHaveTextContent(MODIFY_REC.modificationDetail!)
  })
})

describe('RecommendationView smoke — rest state colors', () => {
  test('overline renders in #993C1D', () => {
    render(<RecommendationView recommendation={REST_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('overline')).toHaveStyle({ color: '#993C1D' })
  })

  test('divider renders in #F0997B', () => {
    render(<RecommendationView recommendation={REST_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('verdict-divider')).toHaveStyle({ backgroundColor: '#F0997B' })
  })
})

// ─── Summary card ─────────────────────────────────────────────────────────────

describe('RecommendationView smoke — summary card fields', () => {
  test('renders sleep score', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText('5 / 5')).toBeInTheDocument()
  })

  test('renders feel score', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText('4 / 5')).toBeInTheDocument()
  })

  test('renders planned workout', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText('10mi tempo run')).toBeInTheDocument()
  })

  test('renders yesterday workout type', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  test('truncates planned workout longer than 40 chars with ellipsis', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{
          ...BASE_CHECK_IN,
          todaysPlannedWorkout: 'A very long workout description that exceeds forty characters',
        }}
      />
    )
    expect(screen.getByText('A very long workout description that exc...')).toBeInTheDocument()
  })

  test('cycle day row is visible when cycleDay is provided', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, cycleDay: 14 }}
      />
    )
    expect(screen.getByText('Cycle day')).toBeInTheDocument()
  })

  test('cycle day row is absent when cycleDay is null', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, cycleDay: null }}
      />
    )
    expect(screen.queryByText('Cycle day')).not.toBeInTheDocument()
  })

  test('stressors row is visible when stressors are provided', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, stressors: 'Fighting a cold' }}
      />
    )
    expect(screen.getByText('Stressors')).toBeInTheDocument()
  })

  test('stressors row is absent when stressors is null', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, stressors: null }}
      />
    )
    expect(screen.queryByText('Stressors')).not.toBeInTheDocument()
  })
})

// ─── Redo button and modal ────────────────────────────────────────────────────

describe('RecommendationView smoke — redo button', () => {
  test('"Redo today\'s check-in" link is visible', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(
      screen.getByRole('button', { name: /redo today's check-in/i })
    ).toBeInTheDocument()
  })

  test('redo button contains a reload icon', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    const btn = screen.getByRole('button', { name: /redo today's check-in/i })
    expect(btn.querySelector('.ti-reload')).not.toBeNull()
  })
})

describe('RecommendationView smoke — redo modal', () => {
  test('confirmation modal is hidden by default', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.queryByText("Redo today's check-in?")).not.toBeInTheDocument()
  })

  test('confirmation modal is visible after the redo link is tapped', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    expect(screen.getByText("Redo today's check-in?")).toBeInTheDocument()
  })

  test('"Delete and redo" button has coral background #D85A30', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    const deleteBtn = screen.getByRole('button', { name: /delete and redo/i })
    expect(deleteBtn).toHaveStyle({ background: '#D85A30' })
  })

  test('tapping "Cancel" dismisses the modal', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByRole('button', { name: /redo today's check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText("Redo today's check-in?")).not.toBeInTheDocument()
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('RecommendationView smoke — error state', () => {
  test('renders "Something went wrong." heading', () => {
    render(<RecommendationView isError />)
    expect(screen.getByRole('heading')).toHaveTextContent('Something went wrong.')
  })

  test('renders "Try again" CTA', () => {
    render(<RecommendationView isError />)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
