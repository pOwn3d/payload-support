export interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitStore {
  increment(key: string, windowMs: number, context?: unknown): Promise<RateLimitEntry>
  reset(key: string, context?: unknown): Promise<void>
}

/**
 * Process-local fallback store. Applications running more than one process
 * should provide a persistent RateLimitStore through the plugin options.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, RateLimitEntry>()

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now()
    const current = this.entries.get(key)
    const next = !current || now > current.resetAt
      ? { count: 1, resetAt: now + windowMs }
      : { ...current, count: current.count + 1 }

    this.entries.set(key, next)
    return next
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key)
  }
}

interface PayloadRateLimitContext {
  find(args: Record<string, unknown>): Promise<{ docs: Array<Record<string, unknown>> }>
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>
  delete(args: Record<string, unknown>): Promise<unknown>
}

type PayloadRateLimitRequest = Pick<PayloadRequest, 'payload' | 'transactionID'>

export class PayloadRateLimitStore implements RateLimitStore {
  constructor(private readonly collectionSlug = 'support-rate-limits') {}

  async increment(key: string, windowMs: number, context?: unknown): Promise<RateLimitEntry> {
    const { payload, req } = this.resolveContext(context)
    const ownsTransaction = req ? await initTransaction(req) : false
    try {
      const now = Date.now()
      const result = await payload.find({
        collection: this.collectionSlug,
        where: { key: { equals: key } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        ...(req ? { req } : {}),
      })
      const current = result.docs[0]
      const currentResetAt = current?.resetAt ? new Date(String(current.resetAt)).getTime() : 0
      const next = !current || now > currentResetAt
        ? { count: 1, resetAt: now + windowMs }
        : { count: Number(current.count || 0) + 1, resetAt: currentResetAt }

      if (current?.id != null) {
        await payload.update({
          collection: this.collectionSlug,
          id: current.id,
          data: { count: next.count, resetAt: new Date(next.resetAt).toISOString() },
          overrideAccess: true,
          ...(req ? { req } : {}),
        })
      } else {
        await payload.create({
          collection: this.collectionSlug,
          data: { key, count: next.count, resetAt: new Date(next.resetAt).toISOString() },
          overrideAccess: true,
          ...(req ? { req } : {}),
        })
      }

      if (ownsTransaction && req) await commitTransaction(req)
      return next
    } catch (error) {
      if (ownsTransaction && req) await killTransaction(req)
      throw error
    }
  }

  async reset(key: string, context?: unknown): Promise<void> {
    const { payload, req } = this.resolveContext(context)
    const ownsTransaction = req ? await initTransaction(req) : false
    try {
      await payload.delete({
        collection: this.collectionSlug,
        where: { key: { equals: key } },
        overrideAccess: true,
        ...(req ? { req } : {}),
      })
      if (ownsTransaction && req) await commitTransaction(req)
    } catch (error) {
      if (ownsTransaction && req) await killTransaction(req)
      throw error
    }
  }

  private resolveContext(context: unknown): {
    payload: PayloadRateLimitContext
    req?: PayloadRateLimitRequest
  } {
    if (!context || typeof context !== 'object') {
      throw new Error('PayloadRateLimitStore requires the current Payload request or instance')
    }
    if ('payload' in context) {
      const req = context as PayloadRateLimitRequest
      return { payload: req.payload as unknown as PayloadRateLimitContext, req }
    }
    return { payload: context as PayloadRateLimitContext }
  }
}

export class RateLimiter {
  private readonly store: RateLimitStore

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    store?: RateLimitStore,
  ) {
    this.store = store ?? new MemoryRateLimitStore()
  }

  async check(key: string, context?: unknown): Promise<boolean> {
    const entry = context === undefined
      ? await this.store.increment(key, this.windowMs)
      : await this.store.increment(key, this.windowMs, context)
    return entry.count > this.maxRequests
  }

  async reset(key: string, context?: unknown): Promise<void> {
    if (context === undefined) await this.store.reset(key)
    else await this.store.reset(key, context)
  }
}
import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'
