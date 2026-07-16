import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRateLimitStore, PayloadRateLimitStore, RateLimiter, type RateLimitStore } from '../utils/rateLimiter'

afterEach(() => {
  vi.useRealTimers()
})

describe('RateLimiter', () => {
  it('allows requests up to the maximum and then blocks', async () => {
    const limiter = new RateLimiter(60_000, 2)
    await expect(limiter.check('key')).resolves.toBe(false)
    await expect(limiter.check('key')).resolves.toBe(false)
    await expect(limiter.check('key')).resolves.toBe(true)
    await expect(limiter.check('key')).resolves.toBe(true)
  })

  it('resets only the targeted key', async () => {
    const limiter = new RateLimiter(60_000, 1)
    await limiter.check('key-a')
    await limiter.check('key-b')
    await expect(limiter.check('key-a')).resolves.toBe(true)
    await expect(limiter.check('key-b')).resolves.toBe(true)

    await limiter.reset('key-a')

    await expect(limiter.check('key-a')).resolves.toBe(false)
    await expect(limiter.check('key-b')).resolves.toBe(true)
  })

  it('opens a new window after expiry', async () => {
    vi.useFakeTimers()
    const limiter = new RateLimiter(1_000, 1)
    await limiter.check('key')
    await expect(limiter.check('key')).resolves.toBe(true)

    vi.advanceTimersByTime(1_001)

    await expect(limiter.check('key')).resolves.toBe(false)
  })

  it('shares counters between limiter instances using the same store', async () => {
    const store = new MemoryRateLimitStore()
    const firstProcess = new RateLimiter(60_000, 1, store)
    const secondProcess = new RateLimiter(60_000, 1, store)

    await expect(firstProcess.check('shared')).resolves.toBe(false)
    await expect(secondProcess.check('shared')).resolves.toBe(true)
  })

  it('supports an asynchronous persistent store adapter', async () => {
    const increment = vi.fn(async () => ({ count: 2, resetAt: Date.now() + 1_000 }))
    const store: RateLimitStore = {
      increment,
      reset: vi.fn(async () => undefined),
    }
    const limiter = new RateLimiter(1_000, 1, store)

    await expect(limiter.check('client:42')).resolves.toBe(true)
    expect(increment).toHaveBeenCalledWith('client:42', 1_000)
  })

  it('persists counters through the Payload adapter', async () => {
    let record: { id: number; key: string; count: number; resetAt: string } | undefined
    const payload = {
      find: vi.fn(async () => ({ docs: record ? [record] : [] })),
      create: vi.fn(async ({ data }: { data: typeof record }) => {
        record = { ...data!, id: 1 }
        return record
      }),
      update: vi.fn(async ({ data }: { data: Partial<typeof record> }) => {
        record = { ...record!, ...data }
        return record
      }),
      delete: vi.fn(async () => undefined),
    }
    const store = new PayloadRateLimitStore()
    const firstProcess = new RateLimiter(60_000, 1, store)
    const secondProcess = new RateLimiter(60_000, 1, store)

    await expect(firstProcess.check('shared', payload)).resolves.toBe(false)
    await expect(secondProcess.check('shared', payload)).resolves.toBe(true)
  })
})
