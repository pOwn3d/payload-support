import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { generateTicketSynthesis } from '../utils/generateTicketSynthesis'

/**
 * POST /api/support/ticket-synthesis?ticketId=X[&force=true]
 *
 * Admin-only. Generates (or returns the cached) AI bullet-point synthesis for a single ticket.
 * The synthesis is persisted on the ticket itself (aiSummary, aiSummaryGeneratedAt, aiSummaryStatus).
 *
 * Cache behaviour:
 * - If aiSummary already exists and force is not set, returns the cached value (status: cached).
 * - If force=true, regenerates regardless of existing summary.
 * - The hook on Tickets clears aiSummary when a ticket is reopened, so the next pass through
 *   "resolved" status will trigger a regeneration automatically.
 */
export function createTicketSynthesisEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/ticket-synthesis',
    method: 'post',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)
        const payload = req.payload

        const url = new URL(req.url || '', 'http://localhost')
        const ticketIdRaw = url.searchParams.get('ticketId')
        const force = url.searchParams.get('force') === 'true'

        if (!ticketIdRaw) {
          return Response.json({ error: 'ticketId required' }, { status: 400 })
        }

        const ticketId = Number(ticketIdRaw)
        if (Number.isNaN(ticketId)) {
          return Response.json({ error: 'ticketId must be a number' }, { status: 400 })
        }

        if (!force) {
          const existing = await payload.findByID({
            collection: slugs.tickets as any,
            id: ticketId,
            depth: 0,
            overrideAccess: true,
          }) as { aiSummary?: string; aiSummaryGeneratedAt?: string; aiSummaryStatus?: string } | null

          if (existing?.aiSummary && existing.aiSummaryStatus === 'done') {
            return Response.json({
              summary: existing.aiSummary,
              generatedAt: existing.aiSummaryGeneratedAt,
              status: 'cached',
            })
          }
        }

        const result = await generateTicketSynthesis({ payload, slugs, ticketId })
        return Response.json(result)
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[support/ticket-synthesis] Error:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
