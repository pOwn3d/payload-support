import { describe, it, expect } from 'vitest'
import { generateTrackingToken } from '../endpoints/track-open'

describe('generateTrackingToken — determinism', () => {
  it('returns the same token for identical inputs (deterministic)', () => {
    const a = generateTrackingToken('42', '7', 'mysecret')
    const b = generateTrackingToken('42', '7', 'mysecret')
    expect(a).toBe(b)
  })

  it('always returns exactly 16 characters', () => {
    const token = generateTrackingToken('1', '2', 'secret')
    expect(token).toHaveLength(16)
  })

  it('returns only hex characters (0-9 a-f)', () => {
    const token = generateTrackingToken('100', '200', 'anothersecret')
    expect(token).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('generateTrackingToken — sensitivity to inputs', () => {
  it('produces different tokens for different ticketIds', () => {
    const t1 = generateTrackingToken('1', '5', 'secret')
    const t2 = generateTrackingToken('2', '5', 'secret')
    expect(t1).not.toBe(t2)
  })

  it('produces different tokens for different messageIds', () => {
    const t1 = generateTrackingToken('10', '1', 'secret')
    const t2 = generateTrackingToken('10', '2', 'secret')
    expect(t1).not.toBe(t2)
  })

  it('produces different tokens for different secrets', () => {
    const t1 = generateTrackingToken('42', '7', 'secret-A')
    const t2 = generateTrackingToken('42', '7', 'secret-B')
    expect(t1).not.toBe(t2)
  })

  it('is sensitive to ticketId/messageId order (no commutative collision)', () => {
    const t1 = generateTrackingToken('1', '23', 'secret')
    const t2 = generateTrackingToken('12', '3', 'secret')
    // '1:23' vs '12:3' — different strings → different HMACs
    expect(t1).not.toBe(t2)
  })

  it('treats ticket "0" and messageId "0" differently from "00"/"00"', () => {
    const t1 = generateTrackingToken('0', '0', 'secret')
    const t2 = generateTrackingToken('00', '00', 'secret')
    expect(t1).not.toBe(t2)
  })
})
