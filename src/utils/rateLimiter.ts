/**
 * Shared in-memory rate limiter with automatic cleanup.
 * Replaces duplicated rate-limiting logic across endpoints.
 */
export class RateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private windowMs: number,
    private maxRequests: number,
  ) {
    // Periodic cleanup to prevent memory leaks
    const timer = setInterval(() => this.cleanup(), windowMs)
    timer.unref()
  }

  /**
   * Check if a key has exceeded the rate limit.
   * Returns true if the request should be blocked.
   */
  check(key: string): boolean {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs })
      return false
    }

    entry.count++
    return entry.count > this.maxRequests
  }

  /**
   * Reset the counter for a specific key.
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Remove expired entries from the store.
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}
