import { describe, it, expect, vi, afterEach } from 'vitest'
import { RateLimiter } from '../utils/rateLimiter'

afterEach(() => {
  vi.useRealTimers()
})

describe('RateLimiter — under the limit', () => {
  it('allows the first request', () => {
    const limiter = new RateLimiter(60_000, 5)
    expect(limiter.check('user:1')).toBe(false)
  })

  it('allows requests up to the maximum (maxRequests = 3)', () => {
    const limiter = new RateLimiter(60_000, 3)
    expect(limiter.check('key')).toBe(false) // count = 1
    expect(limiter.check('key')).toBe(false) // count = 2
    expect(limiter.check('key')).toBe(false) // count = 3
  })
})

describe('RateLimiter — exceeding the limit', () => {
  it('blocks the request when count exceeds maxRequests', () => {
    const limiter = new RateLimiter(60_000, 2)
    limiter.check('key') // count = 1
    limiter.check('key') // count = 2
    // count = 3 > maxRequests(2) → blocked
    expect(limiter.check('key')).toBe(true)
  })

  it('keeps blocking subsequent requests after limit exceeded', () => {
    const limiter = new RateLimiter(60_000, 1)
    limiter.check('key') // count = 1, passes
    expect(limiter.check('key')).toBe(true)  // count = 2 → blocked
    expect(limiter.check('key')).toBe(true)  // count = 3 → still blocked
  })
})

describe('RateLimiter — reset', () => {
  it('allows requests again after manual reset', () => {
    const limiter = new RateLimiter(60_000, 1)
    limiter.check('key') // count = 1
    expect(limiter.check('key')).toBe(true) // blocked
    limiter.reset('key')
    expect(limiter.check('key')).toBe(false) // reset → allowed again
  })

  it('reset only affects the targeted key', () => {
    const limiter = new RateLimiter(60_000, 1)
    limiter.check('keyA')
    limiter.check('keyA') // keyA blocked
    limiter.check('keyB')
    limiter.check('keyB') // keyB blocked

    limiter.reset('keyA')
    expect(limiter.check('keyA')).toBe(false) // keyA allowed
    expect(limiter.check('keyB')).toBe(true)  // keyB still blocked
  })
})

describe('RateLimiter — window expiry', () => {
  it('resets the counter automatically after the window expires', () => {
    vi.useFakeTimers()
    const windowMs = 1_000
    const limiter = new RateLimiter(windowMs, 2)

    limiter.check('key') // count = 1
    limiter.check('key') // count = 2
    expect(limiter.check('key')).toBe(true) // blocked

    // Advance past the window
    vi.advanceTimersByTime(windowMs + 1)

    // The next check should open a new window
    expect(limiter.check('key')).toBe(false) // new window, count = 1
  })
})

describe('RateLimiter — key independence', () => {
  it('tracks different keys independently', () => {
    const limiter = new RateLimiter(60_000, 1)
    // key-A hits limit
    limiter.check('key-A') // count = 1
    expect(limiter.check('key-A')).toBe(true) // blocked

    // key-B untouched
    expect(limiter.check('key-B')).toBe(false) // fresh key, allowed
  })
})
