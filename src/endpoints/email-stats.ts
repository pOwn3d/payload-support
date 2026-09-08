import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { handleAuthError, requireAdmin } from '../utils/auth'
import { principalRateKey, RateLimiter, type RateLimitStore } from '../utils/rateLimiter'
import { dbFind } from '../utils/db'

/**
 * GET /api/support/email-stats?days=7
 * Aggregates EmailLogs data for the tracking dashboard. Admin-only.
 *
 * The guard used to be `!!req.user`, which ANY authenticated principal
 * satisfies — a support-client, or a member of any other auth collection of the
 * host app. That leaked the operational aggregate of `email-logs` (volume,
 * failure rate, per-day and per-action breakdown) even though the collection's
 * own `read` is staff-only, because the pages below are fetched with
 * `overrideAccess: true`. It also handed any account an amplification primitive:
 * up to 25 000 rows read and materialised per call, with no rate limit.
 */
export function createEmailStatsEndpoint(slugs: CollectionSlugs, store?: RateLimitStore): Endpoint {
  const statsLimiter = new RateLimiter(60_000, 20, store, 'email-stats')
  return {
    path: '/support/email-stats',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        // Keyed on the authenticated user id, not on a spoofable header.
        if (await statsLimiter.check(principalRateKey(req.user), req)) {
          return Response.json({ error: 'Too many requests.' }, { status: 429 })
        }

        const url = new URL(req.url!)
        const days = Math.min(Number(url.searchParams.get('days')) || 7, 365)
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

        const allDocs: Array<{
          status: string
          processingTimeMs?: number | null
          action?: string | null
          createdAt: string
        }> = []
        const MAX_PAGES = 50
        let page = 1
        let hasMore = true

        while (hasMore && page <= MAX_PAGES) {
          const result = await dbFind(payload, slugs.emailLogs, {
            where: { createdAt: { greater_than: cutoff } },
            sort: '-createdAt',
            limit: 500,
            page,
            depth: 0,
            overrideAccess: true,
            select: {
              status: true,
              processingTimeMs: true,
              action: true,
              createdAt: true,
            },
          })

          allDocs.push(
            ...result.docs.map((d: any) => ({
              status: d.status,
              processingTimeMs: d.processingTimeMs,
              action: d.action,
              createdAt: d.createdAt,
            })),
          )

          hasMore = result.hasNextPage
          page++
        }

        const total = allDocs.length
        const success = allDocs.filter((d) => d.status === 'success').length
        const errors = allDocs.filter((d) => d.status === 'error').length
        const ignored = allDocs.filter((d) => d.status === 'ignored').length
        const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0

        const withTime = allDocs.filter((d) => typeof d.processingTimeMs === 'number' && d.processingTimeMs > 0)
        const avgProcessingTime = withTime.length > 0
          ? Math.round(withTime.reduce((sum, d) => sum + (d.processingTimeMs || 0), 0) / withTime.length)
          : 0

        // Daily breakdown
        const dailyMap = new Map<string, { success: number; error: number; ignored: number }>()
        for (const doc of allDocs) {
          const day = doc.createdAt.slice(0, 10)
          const entry = dailyMap.get(day) || { success: 0, error: 0, ignored: 0 }
          if (doc.status === 'success') entry.success++
          else if (doc.status === 'error') entry.error++
          else if (doc.status === 'ignored') entry.ignored++
          dailyMap.set(day, entry)
        }

        // Action breakdown
        const actionMap = new Map<string, number>()
        for (const doc of allDocs) {
          const action = doc.action || 'unknown'
          actionMap.set(action, (actionMap.get(action) || 0) + 1)
        }

        return Response.json({
          total,
          success,
          errors,
          ignored,
          successRate,
          avgProcessingTime,
          daily: Object.fromEntries(dailyMap),
          actions: Object.fromEntries(actionMap),
        })
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[email-stats] Error:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
