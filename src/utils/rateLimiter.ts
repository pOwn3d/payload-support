export interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitStore {
  increment(key: string, windowMs: number, context?: unknown): Promise<RateLimitEntry>
  reset(key: string, context?: unknown): Promise<void>
}

/**
 * Hard ceiling on the number of distinct keys held at once, all endpoints
 * combined. Sized for a busy install (thousands of client IPs inside one
 * 15-minute window) while capping the map at a few hundred kilobytes.
 */
export const MAX_MEMORY_RATE_LIMIT_KEYS = 10_000

/**
 * Process-local fallback store. Applications running more than one process
 * should provide a persistent RateLimitStore through the plugin options.
 *
 * BOUNDED, because the keys come from anonymous HTTP traffic: `/support/login`
 * and `/support/chatbot` key their limiter on the client IP, and the IP is read
 * from `x-forwarded-for`. A caller rotating that header wrote one PERMANENT
 * entry per value into a map that had no ceiling, no expiry sweep and no
 * eviction — only `reset()` ever removed anything, and the login path never
 * calls it. Worse, every fresh key opened a fresh window, so the limiter did
 * not even slow down the flood that was exhausting it.
 *
 * Two independent bounds, the same pair `endpoints/typing.ts` already applies
 * to its own module-level map: `clientIpRateKey` caps the SIZE of a key, the
 * ceiling below caps their NUMBER.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, RateLimitEntry>()

  constructor(private readonly maxKeys: number = MAX_MEMORY_RATE_LIMIT_KEYS) {}

  /** Distinct keys currently held. Exposed so the ceiling can be asserted. */
  get size(): number {
    return this.entries.size
  }

  /** Reclaims every window that has already closed. */
  private sweepExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (now > entry.resetAt) this.entries.delete(key)
    }
  }

  /** Soonest-closing window first, so the ceiling drops the least useful entry. */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestResetAt = Infinity
    for (const [key, entry] of this.entries) {
      if (entry.resetAt < oldestResetAt) {
        oldestResetAt = entry.resetAt
        oldestKey = key
      }
    }
    if (oldestKey !== null) this.entries.delete(oldestKey)
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now()
    const current = this.entries.get(key)
    const next = !current || now > current.resetAt
      ? { count: 1, resetAt: now + windowMs }
      : { ...current, count: current.count + 1 }

    // Only a key that is not already held can grow the map.
    if (!current && this.entries.size >= this.maxKeys) {
      this.sweepExpired(now)
      if (this.entries.size >= this.maxKeys) this.evictOldest()
    }

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

/**
 * Longest textual IPv6 address, `xxxx:` * 7 + an embedded IPv4 literal.
 * Nothing legitimate is longer; the cap is what makes the key bounded.
 */
const MAX_IP_KEY_LENGTH = 45
/** Dotted-quad, or the hex/`::`/zone alphabet of an IPv6 literal. Shape only. */
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/
const IPV6_PATTERN = /^[0-9a-fA-F:.%]+$/

/**
 * Identity part of a rate-limit key for an ANONYMOUS caller.
 *
 * `x-forwarded-for` is attacker-controlled — the note in `endpoints/login.ts`
 * has always said so, and Payload's account lock is what actually stops a
 * brute-force. But the header was also used RAW as the limiter key, and that is
 * a second, distinct problem: a key is a stored object. A caller rotating the
 * header minted one unbounded, never-reclaimed entry per value; a value can be
 * most of Node's 16 KB header budget. This validates the SHAPE and caps the
 * LENGTH, so a forged header can still pick a bucket but can no longer invent
 * an unbounded number of them, nor make any single one large.
 *
 * Anything that is not an IP literal falls back to the shared `unknown` bucket.
 * That is the fail-closed direction: an install with no proxy already puts
 * every caller there, and one behind a proxy never lands there legitimately.
 */
export function clientIpRateKey(req: { headers: { get(name: string): string | null } }): string {
  const candidate = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || ''
  return normalizeIpKey(candidate)
}

/** Exposed separately so a caller holding an already-extracted address can reuse it. */
export function normalizeIpKey(candidate: string): string {
  if (!candidate || candidate.length > MAX_IP_KEY_LENGTH) return 'unknown'
  const host = candidate.startsWith('[') && candidate.endsWith(']')
    ? candidate.slice(1, -1)
    : candidate
  if (!host) return 'unknown'
  if (IPV4_PATTERN.test(host)) {
    return host.split('.').every((octet) => Number(octet) <= 255) ? host : 'unknown'
  }
  if (host.includes(':') && IPV6_PATTERN.test(host)) return host.toLowerCase()
  return 'unknown'
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
