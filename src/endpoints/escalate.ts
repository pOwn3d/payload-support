import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { dbUpdate } from '../utils/db'

/**
 * POST /api/support/tickets/:id/escalate
 *
 * Admin-only. Transitions a ticket to the "escalated" status.
 * Used when a ticket needs senior attention or is breaching SLA.
 */
export function createEscalateEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/tickets/:id/escalate',
    method: 'post',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)

        const idRaw = req.routeParams?.id as string | undefined
        if (!idRaw) {
          return Response.json({ error: 'missing-id' }, { status: 400 })
        }
        const ticketId = Number(idRaw)
        if (Number.isNaN(ticketId)) {
          return Response.json({ error: 'invalid-id' }, { status: 400 })
        }

        const ticket = await dbUpdate(req.payload, slugs.tickets, {
          id: ticketId,
          data: { status: 'escalated' },
          overrideAccess: true,
        })

        return Response.json({ ok: true, ticket })
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[support/escalate] Error:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
