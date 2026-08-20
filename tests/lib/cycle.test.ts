import { describe, test, expect } from 'vitest'
import { calculateCycleDay } from '@/lib/cycle'

describe('calculateCycleDay', () => {
  test('returns 1 when periodStartedToday is true regardless of prior history', () => {
    const result = calculateCycleDay(true, null, '2026-06-10', [
      { checkInDate: '2026-06-01', periodStartedToday: true, periodStartedYesterday: null },
    ])
    expect(result).toBe(1)
  })

  test('returns null when periodStartedToday is null', () => {
    const result = calculateCycleDay(null, null, '2026-06-10', [])
    expect(result).toBeNull()
  })

  test('returns null when no prior period has ever been recorded', () => {
    const result = calculateCycleDay(false, null, '2026-06-10', [
      { checkInDate: '2026-06-08', periodStartedToday: false, periodStartedYesterday: null },
      { checkInDate: '2026-06-05', periodStartedToday: null, periodStartedYesterday: null },
    ])
    expect(result).toBeNull()
  })

  test('returns correct day count: anchor June 1, check-in June 10 returns 10', () => {
    const result = calculateCycleDay(false, null, '2026-06-10', [
      { checkInDate: '2026-06-01', periodStartedToday: true, periodStartedYesterday: null },
    ])
    expect(result).toBe(10)
  })

  test('counts skipped days: anchor June 1, check-in June 6 with no June 2-5 check-ins returns 6', () => {
    const result = calculateCycleDay(false, null, '2026-06-06', [
      { checkInDate: '2026-06-01', periodStartedToday: true, periodStartedYesterday: null },
    ])
    expect(result).toBe(6)
  })

  test('date arithmetic is date-string-based: midnight and noon produce the same result', () => {
    const atMidnight = calculateCycleDay(false, null, '2026-06-10T00:00:00', [
      { checkInDate: '2026-06-01T00:00:00', periodStartedToday: true, periodStartedYesterday: null },
    ])
    const atNoon = calculateCycleDay(false, null, '2026-06-10T12:00:00', [
      { checkInDate: '2026-06-01T12:00:00', periodStartedToday: true, periodStartedYesterday: null },
    ])
    expect(atMidnight).toBe(10)
    expect(atNoon).toBe(10)
  })

  test('returns 1 when anchor date equals check-in date', () => {
    const result = calculateCycleDay(false, null, '2026-06-01', [
      { checkInDate: '2026-06-01', periodStartedToday: true, periodStartedYesterday: null },
    ])
    expect(result).toBe(1)
  })

  test('finds the most recent period start even if history array is out of chronological order', () => {
    const result = calculateCycleDay(false, null, '2026-06-10', [
      { checkInDate: '2026-06-01', periodStartedToday: true, periodStartedYesterday: null },
      { checkInDate: '2026-06-05', periodStartedToday: true, periodStartedYesterday: null },
    ])
    expect(result).toBe(6)
  })

  test('returns 2 when periodStartedYesterday is true with no prior history', () => {
    const result = calculateCycleDay(false, true, '2026-06-10', [])
    expect(result).toBe(2)
  })

  test('returns 2 when periodStartedYesterday is true even if there is prior period history', () => {
    const result = calculateCycleDay(false, true, '2026-06-10', [
      { checkInDate: '2026-05-10', periodStartedToday: true, periodStartedYesterday: null },
    ])
    expect(result).toBe(2)
  })

  test('periodStartedToday takes precedence over periodStartedYesterday: returns 1', () => {
    const result = calculateCycleDay(true, true, '2026-06-10', [])
    expect(result).toBe(1)
  })

  test('anchor with periodStartedYesterday true: cycle day for next day is 3', () => {
    // Period started on June 9 (yesterday relative to anchor check-in on June 10)
    // Subsequent check-in on June 11 should be cycle day 3
    const result = calculateCycleDay(false, null, '2026-06-11', [
      { checkInDate: '2026-06-10', periodStartedToday: false, periodStartedYesterday: true },
    ])
    expect(result).toBe(3)
  })

  test('anchor with periodStartedYesterday true: same-day check-in returns 2', () => {
    // Period started yesterday (June 9), checking in today (June 10) with "not yet" = false
    // An existing check-in on the same day already recorded periodStartedYesterday=true
    // A later same-day re-submission would compute from the anchor
    const result = calculateCycleDay(false, null, '2026-06-10', [
      { checkInDate: '2026-06-10', periodStartedToday: false, periodStartedYesterday: true },
    ])
    expect(result).toBe(2)
  })

  test('mixed history: selects most recent anchor, periodStartedYesterday shifts the anchor date back by 1', () => {
    // Check-in on June 5 had periodStartedToday=true (period started June 5)
    // Check-in on June 10 had periodStartedYesterday=true (period started June 9)
    // June 10 is the more recent anchor; period start date = June 9
    // Subsequent check-in on June 12 → cycle day = (June 12 - June 9) + 1 = 4
    const result = calculateCycleDay(false, null, '2026-06-12', [
      { checkInDate: '2026-06-05', periodStartedToday: true, periodStartedYesterday: null },
      { checkInDate: '2026-06-10', periodStartedToday: false, periodStartedYesterday: true },
    ])
    expect(result).toBe(4)
  })
})
