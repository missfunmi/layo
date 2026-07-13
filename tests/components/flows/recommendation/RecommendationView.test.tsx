// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

afterEach(cleanup)

import { RecommendationView } from '@/components/flows/recommendation/RecommendationView'

const AS_WRITTEN_REC = {
  recommendationType: 'as_written' as const,
  modificationDetail: null as string | null,
  rationale: 'You slept well and you are feeling good this morning.',
}
const MODIFY_REC = {
  recommendationType: 'modify' as const,
  modificationDetail: 'Cut the run to 6 miles and keep it fully easy.',
  rationale: 'Sleep was solid but you are sitting at a 3.',
}
const REST_REC = {
  recommendationType: 'rest' as const,
  modificationDetail: null as string | null,
  rationale: 'Poor sleep, a 2 on feel, and you have been fighting a cold.',
}
const BASE_CHECK_IN = {
  sleepSatisfaction: 5,
  feelScore: 3,
  todaysPlannedWorkout: '10mi tempo run',
}

// ─── Overline ────────────────────────────────────────────────────────────────

describe('RecommendationView — overline', () => {
  test('renders "Today\'s recommendation" overline text', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('overline')).toHaveTextContent("Today's recommendation")
  })

  test('as_written overline has color #0F6E56', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('overline')).toHaveStyle({ color: '#0F6E56' })
  })

  test('modify overline has color #BA7517', () => {
    render(<RecommendationView recommendation={MODIFY_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('overline')).toHaveStyle({ color: '#BA7517' })
  })

  test('rest overline has color #993C1D', () => {
    render(<RecommendationView recommendation={REST_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('overline')).toHaveStyle({ color: '#993C1D' })
  })
})

// ─── Heading ─────────────────────────────────────────────────────────────────

describe('RecommendationView — heading', () => {
  test('as_written heading is "Do your workout as planned."', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Do your workout as planned.')
  })

  test('modify heading shows modificationDetail', () => {
    render(<RecommendationView recommendation={MODIFY_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByRole('heading')).toHaveTextContent(
      'Cut the run to 6 miles and keep it fully easy.'
    )
  })

  test('rest heading is "Take a rest day today."', () => {
    render(<RecommendationView recommendation={REST_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Take a rest day today.')
  })
})

// ─── Divider ─────────────────────────────────────────────────────────────────

describe('RecommendationView — verdict divider', () => {
  test('as_written divider has backgroundColor #5DCAA5', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('verdict-divider')).toHaveStyle({ backgroundColor: '#5DCAA5' })
  })

  test('modify divider has backgroundColor #FAC775', () => {
    render(<RecommendationView recommendation={MODIFY_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('verdict-divider')).toHaveStyle({ backgroundColor: '#FAC775' })
  })

  test('rest divider has backgroundColor #F0997B', () => {
    render(<RecommendationView recommendation={REST_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('verdict-divider')).toHaveStyle({ backgroundColor: '#F0997B' })
  })
})

// ─── Rationale ───────────────────────────────────────────────────────────────

describe('RecommendationView — rationale', () => {
  test('renders rationale text', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText(AS_WRITTEN_REC.rationale)).toBeInTheDocument()
  })
})

// ─── Summary card ─────────────────────────────────────────────────────────────

describe('RecommendationView — check-in summary card', () => {
  test('renders "Today\'s check-in" card label', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText("Today's check-in")).toBeInTheDocument()
  })

  test('shows sleep score as "{n} / 5"', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('5 / 5')).toBeInTheDocument()
  })

  test('shows feel score as "{n} / 5"', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, feelScore: 4 }}
      />
    )
    expect(screen.getByText('Feel')).toBeInTheDocument()
    expect(screen.getByText('4 / 5')).toBeInTheDocument()
  })

  test('shows cycle day row when cycleDay is present', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, cycleDay: 7 }}
      />
    )
    expect(screen.getByText('Cycle day')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  test('does not show cycle day row when cycleDay is null', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, cycleDay: null }}
      />
    )
    expect(screen.queryByText('Cycle day')).not.toBeInTheDocument()
  })

  test('shows planned workout row', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByText('Planned workout')).toBeInTheDocument()
    expect(screen.getByText('10mi tempo run')).toBeInTheDocument()
  })

  test('truncates planned workout at 40 chars with ellipsis', () => {
    const longWorkout = 'A very long workout description that exceeds forty characters'
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: longWorkout }}
      />
    )
    expect(screen.getByText('A very long workout description that exc...')).toBeInTheDocument()
  })

  test('tapping the planned workout value expands it to show the full text', () => {
    const longWorkout = 'A very long workout description that exceeds forty characters'
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: longWorkout }}
      />
    )
    fireEvent.click(screen.getByTestId('planned-workout-value'))
    expect(screen.getByText(longWorkout)).toBeInTheDocument()
    expect(screen.queryByText('A very long workout description that exc...')).not.toBeInTheDocument()
  })

  test('tapping the planned workout value again collapses it back to truncated text', () => {
    const longWorkout = 'A very long workout description that exceeds forty characters'
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: longWorkout }}
      />
    )
    const toggle = screen.getByTestId('planned-workout-value')
    fireEvent.click(toggle)
    fireEvent.click(screen.getByTestId('planned-workout-value'))
    expect(screen.getByText('A very long workout description that exc...')).toBeInTheDocument()
    expect(screen.queryByText(longWorkout)).not.toBeInTheDocument()
  })

  test('planned workout value is not a button (card-level tap handles expand)', () => {
    const longWorkout = 'A very long workout description that exceeds forty characters'
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: longWorkout }}
      />
    )
    expect(screen.getByTestId('planned-workout-value').tagName).not.toBe('BUTTON')
  })

  test('planned workout row has no bottom border on the last row (last:border-b-0)', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    const value = screen.getByTestId('planned-workout-value')
    const row = value.closest('div')
    expect(row).toHaveClass('last:border-b-0')
  })

  test('shows yesterday row with "Planned workout" when type is planned', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, yesterdayWorkoutType: 'planned' }}
      />
    )
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getAllByText('Planned workout')).toHaveLength(2)
  })

  test('shows yesterday row with "Láyo\'s suggestion" when type is suggested', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, yesterdayWorkoutType: 'suggested' }}
      />
    )
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText("Láyo's suggestion")).toBeInTheDocument()
  })

  test('shows yesterday row with "Other workout" when type is other', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, yesterdayWorkoutType: 'other' }}
      />
    )
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText('Other workout')).toBeInTheDocument()
  })

  test('does not show yesterday row when yesterdayWorkoutType is null', () => {
    render(
      <RecommendationView
        recommendation={REST_REC}
        checkIn={{ ...BASE_CHECK_IN, yesterdayWorkoutType: null }}
      />
    )
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument()
  })

  test('shows stressors row when stressors is present', () => {
    render(
      <RecommendationView
        recommendation={REST_REC}
        checkIn={{ ...BASE_CHECK_IN, stressors: 'Fighting a cold' }}
      />
    )
    expect(screen.getByText('Stressors')).toBeInTheDocument()
    expect(screen.getByText('Fighting a cold')).toBeInTheDocument()
  })

  test('does not show stressors row when stressors is null', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, stressors: null }}
      />
    )
    expect(screen.queryByText('Stressors')).not.toBeInTheDocument()
  })
})

// ─── Card-level expand / collapse ────────────────────────────────────────────

describe('RecommendationView — card-level expand/collapse', () => {
  const LONG_WORKOUT = 'A very long workout description that exceeds forty characters'
  const LONG_STRESSORS = 'A very long stressor description that exceeds forty characters'

  test('tapping anywhere on the check-in card expands the planned workout text', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: LONG_WORKOUT }}
      />
    )
    fireEvent.click(screen.getByTestId('check-in-card'))
    expect(screen.getByTestId('planned-workout-value')).toHaveTextContent(LONG_WORKOUT)
  })

  test('tapping the check-in card again collapses the planned workout text', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: LONG_WORKOUT }}
      />
    )
    const card = screen.getByTestId('check-in-card')
    fireEvent.click(card)
    fireEvent.click(card)
    expect(screen.getByTestId('planned-workout-value')).toHaveTextContent(
      'A very long workout description that exc...'
    )
  })

  test('stressors text is truncated at 40 chars with ellipsis when the card is collapsed', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, stressors: LONG_STRESSORS }}
      />
    )
    expect(screen.getByTestId('stressors-value')).toHaveTextContent(
      'A very long stressor description that ex...'
    )
  })

  test('tapping the check-in card expands stressors to show full text', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, stressors: LONG_STRESSORS }}
      />
    )
    fireEvent.click(screen.getByTestId('check-in-card'))
    expect(screen.getByTestId('stressors-value')).toHaveTextContent(LONG_STRESSORS)
  })

  test('tapping the check-in card again collapses stressors back to truncated text', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, stressors: LONG_STRESSORS }}
      />
    )
    const card = screen.getByTestId('check-in-card')
    fireEvent.click(card)
    fireEvent.click(card)
    expect(screen.getByTestId('stressors-value')).toHaveTextContent(
      'A very long stressor description that ex...'
    )
  })

  test('expanded planned workout text stays on the right side of its label', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: LONG_WORKOUT }}
      />
    )
    fireEvent.click(screen.getByTestId('check-in-card'))
    const valueEl = screen.getByTestId('planned-workout-value')
    const row = valueEl.closest('div')
    expect(row).not.toHaveClass('flex-col')
    expect(valueEl).toHaveClass('text-right')
  })

  test('expanding the card applies whitespace-normal even when value is 40 chars or fewer', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: 'Short workout' }}
      />
    )
    fireEvent.click(screen.getByTestId('check-in-card'))
    expect(screen.getByTestId('planned-workout-value')).toHaveClass('whitespace-normal')
  })

  test('check-in card has aria-expanded=false when collapsed', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(screen.getByTestId('check-in-card')).toHaveAttribute('aria-expanded', 'false')
  })

  test('check-in card has aria-expanded=true when expanded', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    fireEvent.click(screen.getByTestId('check-in-card'))
    expect(screen.getByTestId('check-in-card')).toHaveAttribute('aria-expanded', 'true')
  })

  test('pressing Enter on the check-in card expands the planned workout text', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: LONG_WORKOUT }}
      />
    )
    fireEvent.keyDown(screen.getByTestId('check-in-card'), { key: 'Enter' })
    expect(screen.getByTestId('planned-workout-value')).toHaveTextContent(LONG_WORKOUT)
  })

  test('pressing Space on the check-in card expands the planned workout text', () => {
    render(
      <RecommendationView
        recommendation={AS_WRITTEN_REC}
        checkIn={{ ...BASE_CHECK_IN, todaysPlannedWorkout: LONG_WORKOUT }}
      />
    )
    fireEvent.keyDown(screen.getByTestId('check-in-card'), { key: ' ' })
    expect(screen.getByTestId('planned-workout-value')).toHaveTextContent(LONG_WORKOUT)
  })
})

// ─── Redo link ────────────────────────────────────────────────────────────────

describe('RecommendationView — redo link', () => {
  test('renders "Redo today\'s check-in" button', () => {
    render(<RecommendationView recommendation={AS_WRITTEN_REC} checkIn={BASE_CHECK_IN} />)
    expect(
      screen.getByRole('button', { name: /redo today's check-in/i })
    ).toBeInTheDocument()
  })
})
