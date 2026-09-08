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

/**
 * Identity part of a rate-limit key for an authenticated caller.
 *
 * Ids are per-collection sequences: support-client #7 and agent #7 are different
 * people with the same `id`. Keying a limiter on `String(user.id)` alone let one
 * consume the other's budget, so the auth collection travels with the id.
 */
export function principalRateKey(
  user: { id?: unknown; collection?: unknown } | null | undefined,
): string {
  if (!user || user.id === undefined || user.id === null) return 'anonymous'
  const collection = typeof user.collection === 'string' && user.collection ? user.collection : 'unknown'
  return `${collection}:${String(user.id)}`
}

export class RateLimiter {
  private readonly store: RateLimitStore
  private readonly prefix: string

  /**
   * @param namespace  Endpoint-scoped prefix for every key this limiter writes.
   *   The store is SHARED (`rateLimitStore: 'payload'` builds one instance for
   *   all endpoints), and the raw keys collide across endpoints: `ip` was used
   *   by both the login and the chatbot limiter — 10 forged chatbot requests
   *   locked a victim out of the portal for 15 minutes — and `String(user.id)`
   *   by five different endpoints. Always pass one; it is optional only because
   *   `RateLimiter` is part of the published API surface.
   */
  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    store?: RateLimitStore,
    namespace?: string,
  ) {
    this.store = store ?? new MemoryRateLimitStore()
    this.prefix = namespace ? `${namespace}:` : ''
  }

  /** The key actually written to the store. Exposed for assertions in tests. */
  scopedKey(key: string): string {
    return `${this.prefix}${key}`
  }

  async check(key: string, context?: unknown): Promise<boolean> {
    const scoped = this.scopedKey(key)
    const entry = context === undefined
      ? await this.store.increment(scoped, this.windowMs)
      : await this.store.increment(scoped, this.windowMs, context)
    return entry.count > this.maxRequests
  }

  async reset(key: string, context?: unknown): Promise<void> {
    const scoped = this.scopedKey(key)
    if (context === undefined) await this.store.reset(scoped)
    else await this.store.reset(scoped, context)
  }
}
import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'
