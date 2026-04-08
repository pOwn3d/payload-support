import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

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

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url!)
        const collection = url.searchParams.get('collection')
        const days = Number(url.searchParams.get('days') || '0')

        // Map collection param to slug
        const allowedCollections: Record<string, string> = {
          'email-logs': slugs.emailLogs,
          'auth-logs': slugs.authLogs,
        }

        if (!collection || !allowedCollections[collection]) {
          return Response.json({ error: 'Invalid collection. Use email-logs or auth-logs.' }, { status: 400 })
        }

        const cutoff = days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null

        const result = await payload.delete({
          collection: allowedCollections[collection] as any,
          where: cutoff
            ? { createdAt: { less_than: cutoff } }
            : { id: { exists: true } },
          overrideAccess: true,
        })

        const count = Array.isArray(result.docs) ? result.docs.length : 0

        return Response.json({
          purged: count,
          collection,
          days: days || 'all',
        })
      } catch (error) {
        console.error('[purge-logs] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
