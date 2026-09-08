import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { purgeOlderThan, purgeableCollections } from '../utils/retention'

/**
 * DELETE /api/support/purge-logs?collection=email-logs&days=30
 * Purge old logs older than X days. Admin-only.
 */
export function createPurgeLogsEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/purge-logs',
    method: 'delete',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const url = new URL(req.url!)
        const collection = url.searchParams.get('collection')
        const days = Number(url.searchParams.get('days') || '0')

        // Map collection param to slug
        const allowedCollections = purgeableCollections(slugs)

        if (!collection || !allowedCollections[collection]) {
          return Response.json({ error: 'Invalid collection. Use email-logs or auth-logs.' }, { status: 400 })
        }

        // `days=0` wipes the journal entirely. It stays available here — an
        // explicit, admin-only, one-off action — and is refused by the
        // scheduled task, which must never be able to do it by accident.
        const count = await purgeOlderThan(payload, allowedCollections[collection], days, req)

        return Response.json({
          purged: count,
          collection,
          days: days || 'all',
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[purge-logs] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
