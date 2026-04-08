import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * POST /api/support/bulk-action
 * Apply an action to multiple tickets at once. Admin-only.
 */
export function createBulkActionEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/bulk-action',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { ticketIds, action, value } = (await req.json!()) as {
          ticketIds: number[]
          action: 'close' | 'reopen' | 'assign' | 'tag' | 'delete' | 'set_priority' | 'set_category'
          value?: string | number
        }

        if (!ticketIds?.length || !action) {
          return Response.json({ error: 'ticketIds and action required' }, { status: 400 })
        }

        let processed = 0

        for (const ticketId of ticketIds) {
          try {
            switch (action) {
              case 'close':
                await payload.update({
                  collection: slugs.tickets as any,
                  id: ticketId,
                  data: { status: 'resolved', resolvedAt: new Date().toISOString() },
                  overrideAccess: true,
                })
                break
              case 'reopen':
                await payload.update({
                  collection: slugs.tickets as any,
                  id: ticketId,
                  data: { status: 'open' },
                  overrideAccess: true,
                })
                break
              case 'assign':
                if (value) {
                  await payload.update({
                    collection: slugs.tickets as any,
                    id: ticketId,
                    data: { assignedTo: Number(value) },
                    overrideAccess: true,
                  })
                }
                break
              case 'set_priority':
                if (value) {
                  await payload.update({
                    collection: slugs.tickets as any,
                    id: ticketId,
                    data: { priority: String(value) },
                    overrideAccess: true,
                  })
                }
                break
              case 'set_category':
                if (value) {
                  await payload.update({
                    collection: slugs.tickets as any,
                    id: ticketId,
                    data: { category: String(value) },
                    overrideAccess: true,
                  })
                }
                break
              case 'delete':
                await payload.delete({
                  collection: slugs.tickets as any,
                  id: ticketId,
                  overrideAccess: true,
                })
                break
            }
            processed++
          } catch (err) {
            console.error(`[bulk-action] Failed for ticket ${ticketId}:`, err)
          }
        }

        return Response.json({ processed, total: ticketIds.length })
      } catch (error) {
        console.error('[bulk-action] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
