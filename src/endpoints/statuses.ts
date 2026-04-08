import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * GET /api/support/statuses
 * Returns all ticket statuses sorted by sortOrder.
 */
export function createStatusesEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/statuses',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { docs } = await payload.find({
          collection: slugs.ticketStatuses as any,
          sort: 'sortOrder',
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })

        return Response.json({
          statuses: docs.map((s: any) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            color: s.color,
            type: s.type,
            isDefault: s.isDefault,
            sortOrder: s.sortOrder,
          })),
        })
      } catch (error) {
        console.error('[statuses] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
