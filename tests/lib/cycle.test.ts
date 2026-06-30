import { describe, test, expect } from 'vitest'
import { calculateCycleDay } from '@/lib/cycle'

describe('calculateCycleDay', () => {
  test('returns 1 when periodStartedToday is true regardless of prior history', () => {
    const result = calculateCycleDay(true, '2026-06-10', [
      { checkInDate: '2026-06-01', periodStartedToday: true },
    ])
    expect(result).toBe(1)
  })

  test('returns null when periodStartedToday is null', () => {
    const result = calculateCycleDay(null, '2026-06-10', [])
    expect(result).toBeNull()
  })

  test('returns null when no prior period has ever been recorded', () => {
    const result = calculateCycleDay(false, '2026-06-10', [
      { checkInDate: '2026-06-08', periodStartedToday: false },
      { checkInDate: '2026-06-05', periodStartedToday: null },
    ])
    expect(result).toBeNull()
  })

  test('returns correct day count: anchor June 1, check-in June 10 returns 10', () => {
    const result = calculateCycleDay(false, '2026-06-10', [
      { checkInDate: '2026-06-01', periodStartedToday: true },
    ])
    expect(result).toBe(10)
  })

  test('counts skipped days: anchor June 1, check-in June 6 with no June 2-5 check-ins returns 6', () => {
    const result = calculateCycleDay(false, '2026-06-06', [
      { checkInDate: '2026-06-01', periodStartedToday: true },
    ])
    expect(result).toBe(6)
  })

  test('date arithmetic is date-string-based: midnight and noon produce the same result', () => {
    const atMidnight = calculateCycleDay(false, '2026-06-10T00:00:00', [
      { checkInDate: '2026-06-01T00:00:00', periodStartedToday: true },
    ])
    const atNoon = calculateCycleDay(false, '2026-06-10T12:00:00', [
      { checkInDate: '2026-06-01T12:00:00', periodStartedToday: true },
    ])
    expect(atMidnight).toBe(10)
    expect(atNoon).toBe(10)
  })

  test('returns 1 when anchor date equals check-in date', () => {
    const result = calculateCycleDay(false, '2026-06-01', [
      { checkInDate: '2026-06-01', periodStartedToday: true },
    ])
    expect(result).toBe(1)
  })

  test('finds the most recent period start even if history array is out of chronological order', () => {
    const result = calculateCycleDay(false, '2026-06-10', [
      { checkInDate: '2026-06-01', periodStartedToday: true },
      { checkInDate: '2026-06-05', periodStartedToday: true },
    ])
    expect(result).toBe(6)
  })
})
