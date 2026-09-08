import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFind } from '../utils/db'

/**
 * GET /api/support/statuses
 * Returns all ticket statuses sorted by sortOrder.
 *
 * The guard used to be `!!req.user`, which ANY authenticated principal
 * satisfies — including a member of an unrelated auth collection of the host
 * app (customers, members, subscribers created by public sign-up). Because the
 * rows below are read with `overrideAccess: true`, that handed them the whole
 * support workflow taxonomy — internal status names, private states, pipeline
 * order — which `ticket-statuses.access.read` explicitly refuses them.
 *
 * The check below MIRRORS that ACL rather than replacing it: staff and
 * support-clients, nobody else. `overrideAccess` stays, because the endpoint
 * legitimately serves the full list to both, and the projection it returns is
 * narrower than the documents themselves.
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

        const collection = (req.user as { collection?: string }).collection
        if (collection !== slugs.users && collection !== slugs.supportClients) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { docs } = await dbFind(payload, slugs.ticketStatuses, {
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
