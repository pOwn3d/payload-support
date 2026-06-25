import { describe, it, expect } from 'vitest'
import { computeSlaState, formatSlaRemaining } from '../views/shared/sla'

// ---------------------------------------------------------------------------
// computeSlaState
// ---------------------------------------------------------------------------

describe('computeSlaState — no SLA data', () => {
  it('returns state "none" when no due date is set', () => {
    const result = computeSlaState({})
    expect(result.state).toBe('none')
    expect(result.remainingMs).toBeNull()
    expect(result.due).toBeNull()
  })

  it('returns state "none" when dueRaw is null', () => {
    const result = computeSlaState({ slaFirstResponseDue: null })
    expect(result.state).toBe('none')
  })

  it('returns state "none" when dueRaw is an invalid date string', () => {
    const result = computeSlaState({ slaFirstResponseDue: 'not-a-date' })
    expect(result.state).toBe('none')
  })
})

describe('computeSlaState — first response SLA (no firstResponseAt)', () => {
  const future2h = new Date(Date.now() + 2 * 3_600_000).toISOString()
  const future30m = new Date(Date.now() + 30 * 60_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  it('returns "ok" when deadline is more than 1 hour away', () => {
    const result = computeSlaState({ slaFirstResponseDue: future2h })
    expect(result.state).toBe('ok')
    expect(result.remainingMs).toBeGreaterThan(3_600_000)
  })

  it('returns "warn" when deadline is less than 1 hour away', () => {
    const result = computeSlaState({ slaFirstResponseDue: future30m })
    expect(result.state).toBe('warn')
    expect(result.remainingMs).toBeGreaterThan(0)
    expect(result.remainingMs).toBeLessThan(3_600_000)
  })

  it('returns "breach" when deadline is in the past', () => {
    const result = computeSlaState({ slaFirstResponseDue: past })
    expect(result.state).toBe('breach')
    expect(result.remainingMs).toBeLessThan(0)
  })

  it('returns "breach" when slaFirstResponseBreached flag is set (even with future due)', () => {
    const result = computeSlaState({
      slaFirstResponseDue: future2h,
      slaFirstResponseBreached: true,
    })
    expect(result.state).toBe('breach')
  })

  it('exposes the due ISO string in result', () => {
    const result = computeSlaState({ slaFirstResponseDue: future2h })
    expect(result.due).toBe(future2h)
  })
})

describe('computeSlaState — resolution SLA (firstResponseAt present)', () => {
  const firstResponseAt = new Date(Date.now() - 60_000).toISOString()
  const future2h = new Date(Date.now() + 2 * 3_600_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  it('uses resolution SLA when firstResponseAt is set', () => {
    const result = computeSlaState({
      firstResponseAt,
      slaFirstResponseDue: past, // would be breach if used
      slaResolutionDue: future2h, // ok
    })
    // Should use resolution SLA → ok
    expect(result.state).toBe('ok')
    expect(result.due).toBe(future2h)
  })

  it('returns "breach" when resolution deadline is passed', () => {
    const result = computeSlaState({
      firstResponseAt,
      slaResolutionDue: past,
    })
    expect(result.state).toBe('breach')
  })

  it('returns "breach" when slaResolutionBreached flag is set', () => {
    const result = computeSlaState({
      firstResponseAt,
      slaResolutionDue: future2h,
      slaResolutionBreached: true,
    })
    expect(result.state).toBe('breach')
  })
})

describe('computeSlaState — pinned "now" parameter', () => {
  it('uses the provided "now" date for comparison', () => {
    const due = '2024-01-15T10:00:00.000Z'
    // now before due → ok
    const before = new Date('2024-01-15T08:00:00.000Z')
    expect(computeSlaState({ slaFirstResponseDue: due }, before).state).toBe('ok')
    // now after due → breach
    const after = new Date('2024-01-15T12:00:00.000Z')
    expect(computeSlaState({ slaFirstResponseDue: due }, after).state).toBe('breach')
    // now 30 min before due → warn
    const soon = new Date('2024-01-15T09:35:00.000Z')
    expect(computeSlaState({ slaFirstResponseDue: due }, soon).state).toBe('warn')
  })
})

// ---------------------------------------------------------------------------
// formatSlaRemaining
// ---------------------------------------------------------------------------

describe('formatSlaRemaining', () => {
  it('returns "—" for null', () => {
    expect(formatSlaRemaining(null)).toBe('—')
  })

  it('formats less-than-1-hour remaining as minutes (positive)', () => {
    const thirtyMin = 30 * 60_000
    expect(formatSlaRemaining(thirtyMin)).toBe('30m')
  })

  it('formats 0 remaining as "0m"', () => {
    expect(formatSlaRemaining(0)).toBe('0m')
  })

  it('formats negative < 1 hour as −Xm', () => {
    const minus15min = -(15 * 60_000)
    expect(formatSlaRemaining(minus15min)).toBe('−15m')
  })

  it('formats exactly 1 hour as "1h"', () => {
    const oneHour = 3_600_000
    expect(formatSlaRemaining(oneHour)).toBe('1h')
  })

  it('formats 90 minutes as "1h 30"', () => {
    const ninetyMin = 90 * 60_000
    expect(formatSlaRemaining(ninetyMin)).toBe('1h 30')
  })

  it('formats negative hours as −Xh', () => {
    const minus2h = -(2 * 3_600_000)
    expect(formatSlaRemaining(minus2h)).toBe('−2h')
  })

  it('formats 24h+ as days (Xj)', () => {
    const twoDays = 48 * 3_600_000
    expect(formatSlaRemaining(twoDays)).toBe('2j')
  })

  it('formats negative 24h+ as −Xj', () => {
    const minusThreeDays = -(3 * 24 * 3_600_000)
    expect(formatSlaRemaining(minusThreeDays)).toBe('−3j')
  })

  it('formats whole hours without trailing "00" minutes', () => {
    const twoHoursExact = 2 * 3_600_000
    const result = formatSlaRemaining(twoHoursExact)
    expect(result).toBe('2h')
  })
})

// ---------------------------------------------------------------------------
// calculateBusinessHoursDeadline (imported from hooks/checkSLA)
// ---------------------------------------------------------------------------

import { calculateBusinessHoursDeadline } from '../hooks/checkSLA'

describe('calculateBusinessHoursDeadline', () => {
  // Use UTC dates — the function uses local Date methods without TZ conversion.
  // We pin times to Tuesday 2024-01-09 so all boundary math is predictable.

  it('adds 60 minutes within the same business day', () => {
    // Tuesday 2024-01-09 at 10:00 local
    const start = new Date(2024, 0, 9, 10, 0, 0) // month is 0-indexed
    const result = calculateBusinessHoursDeadline(start, 60)
    expect(result.getHours()).toBe(11)
    expect(result.getMinutes()).toBe(0)
    expect(result.getDate()).toBe(9)
  })

  it('carries over minutes past end-of-day to the next business day', () => {
    // Tuesday at 17:00, add 120 minutes (only 60 remain today: 17:00→18:00)
    // Remaining 60 minutes spills into Wednesday morning: 9:00→10:00
    const start = new Date(2024, 0, 9, 17, 0, 0)
    const result = calculateBusinessHoursDeadline(start, 120)
    expect(result.getDate()).toBe(10) // Wednesday
    expect(result.getHours()).toBe(10)
    expect(result.getMinutes()).toBe(0)
  })

  it('skips Saturday and Sunday', () => {
    // Friday 2024-01-12 at 17:00, add 120 minutes → skips Sat/Sun → Monday 10:00
    const start = new Date(2024, 0, 12, 17, 0, 0) // Friday
    const result = calculateBusinessHoursDeadline(start, 120)
    // 60 min remaining Friday (17→18), then 60 min on Monday (9→10)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getHours()).toBe(10)
  })

  it('moves a Saturday start to Monday 9:00 before counting', () => {
    // Saturday at 10:00, add 60 minutes → Monday 10:00
    const start = new Date(2024, 0, 13, 10, 0, 0) // Saturday
    const result = calculateBusinessHoursDeadline(start, 60)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getHours()).toBe(10)
  })

  it('moves a Sunday start to Monday 9:00 before counting', () => {
    // Sunday at 15:00, add 30 minutes → Monday 9:30
    const start = new Date(2024, 0, 14, 15, 0, 0) // Sunday
    const result = calculateBusinessHoursDeadline(start, 30)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(30)
  })

  it('moves a before-hours start to 9:00 before counting', () => {
    // Tuesday at 7:00 (before 9:00), add 30 minutes → 9:30 same day
    const start = new Date(2024, 0, 9, 7, 0, 0)
    const result = calculateBusinessHoursDeadline(start, 30)
    expect(result.getDate()).toBe(9)
    expect(result.getHours()).toBe(9)
    expect(result.getMinutes()).toBe(30)
  })

  it('moves an after-hours start to next business day 9:00', () => {
    // Tuesday at 19:00 (after 18:00), add 60 minutes → Wednesday 10:00
    const start = new Date(2024, 0, 9, 19, 0, 0)
    const result = calculateBusinessHoursDeadline(start, 60)
    expect(result.getDate()).toBe(10) // Wednesday
    expect(result.getHours()).toBe(10)
  })

  it('handles 0 minutes (deadline = start clamped to business hours)', () => {
    const start = new Date(2024, 0, 9, 10, 30, 0) // Tuesday at 10:30
    const result = calculateBusinessHoursDeadline(start, 0)
    // Start is within business hours → no movement
    expect(result.getDate()).toBe(9)
    expect(result.getHours()).toBe(10)
    expect(result.getMinutes()).toBe(30)
  })

  it('handles a full business day (540 min = 9 hours) spanning exactly one day', () => {
    // Tuesday at 9:00, add 540 min (exactly one business day) → Tuesday 18:00
    const start = new Date(2024, 0, 9, 9, 0, 0)
    const result = calculateBusinessHoursDeadline(start, 540)
    expect(result.getDate()).toBe(9)
    expect(result.getHours()).toBe(18)
    expect(result.getMinutes()).toBe(0)
  })
})
