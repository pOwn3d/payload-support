import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireClient, handleAuthError } from '../utils/auth'
import { dbFind, dbFindByID, dbCreate } from '../utils/db'

/**
 * POST /api/support/tickets/:id/feedback
 *
 * Authenticated portal client submits a feedback (rating + optional comment)
 * for one of their tickets. Only one feedback per ticket is allowed.
 *
 * Body: { rating: number (1-5), comment?: string }
 */
export function createTicketFeedbackEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/tickets/:id/feedback',
    method: 'post',
    handler: async (req) => {
      try {
        requireClient(req, slugs)
        const payload = req.payload

        const idRaw = req.routeParams?.id as string | undefined
        if (!idRaw) {
          return Response.json({ error: 'missing-id' }, { status: 400 })
        }
        const ticketId = Number(idRaw)
        if (Number.isNaN(ticketId)) {
          return Response.json({ error: 'invalid-id' }, { status: 400 })
        }

        const body = (await req.json!()) as { rating?: unknown; comment?: unknown }
        const ratingNum = Number(body?.rating)
        if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
          return Response.json(
            { error: 'rating (entier 1-5) requis.' },
            { status: 400 },
          )
        }
        const comment =
          typeof body?.comment === 'string' ? body.comment.trim() : undefined
        if (comment && comment.length > 5000) {
          return Response.json(
            { error: 'Le commentaire ne peut pas depasser 5000 caracteres.' },
            { status: 400 },
          )
        }

        // Find ticket and check it belongs to the requesting client
        const ticket = (await dbFindByID(payload, slugs.tickets, {
          id: ticketId,
          depth: 0,
          overrideAccess: true,
        })) as { id: number; client?: number | { id: number } } | null

        if (!ticket) {
          return Response.json({ error: 'Ticket introuvable.' }, { status: 404 })
        }

        const ticketClientId =
          typeof ticket.client === 'object' && ticket.client !== null
            ? ticket.client.id
            : ticket.client
        if (ticketClientId !== req.user.id) {
          return Response.json({ error: 'forbidden' }, { status: 403 })
        }

        // Check no feedback already exists for this ticket
        const existing = await dbFind(payload, 'ticket-feedback', {
          where: { ticket: { equals: ticketId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          return Response.json(
            { error: 'Feedback deja soumis pour ce ticket.' },
            { status: 409 },
          )
        }

        const feedback = await dbCreate(payload, 'ticket-feedback', {
          data: {
            ticket: ticketId,
            client: req.user.id,
            rating: ratingNum,
            ...(comment ? { comment } : {}),
            submittedFrom: 'portal',
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, feedback })
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[support/ticket-feedback] Error:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
