import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireClient, handleAuthError } from '../utils/auth'
import { dbFindByID, dbFind, dbCreate } from '../utils/db'

/**
 * POST /api/support/satisfaction
 * Client submits a satisfaction survey for a resolved ticket.
 */
export function createSatisfactionEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/satisfaction',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireClient(req, slugs)

        const body = await req.json!()
        const { ticketId, rating, nps, comment } = body

        if (!ticketId) {
          return Response.json({ error: 'ticketId est requis.' }, { status: 400 })
        }
        const hasRating = rating !== undefined && rating !== null
        const hasNps = nps !== undefined && nps !== null
        if (!hasRating && !hasNps) {
          return Response.json({ error: 'Un rating (1-5) et/ou un nps (0-10) est requis.' }, { status: 400 })
        }
        if (hasRating && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
          return Response.json({ error: 'rating doit être un entier 1-5.' }, { status: 400 })
        }
        if (hasNps && (!Number.isInteger(nps) || nps < 0 || nps > 10)) {
          return Response.json({ error: 'nps doit être un entier 0-10.' }, { status: 400 })
        }

        if (comment && typeof comment === 'string' && comment.length > 5000) {
          return Response.json(
            { error: 'Le commentaire ne peut pas dépasser 5000 caractères.' },
            { status: 400 },
          )
        }

        // Verify ticket belongs to client and is resolved
        const ticket = await dbFindByID(payload, slugs.tickets, {
          id: ticketId,
          depth: 0,
          overrideAccess: false,
          user: req.user,
        })

        if (!ticket) {
          return Response.json({ error: 'Ticket introuvable.' }, { status: 404 })
        }

        if (ticket.status !== 'resolved') {
          return Response.json(
            { error: 'Le ticket doit être résolu pour laisser un avis.' },
            { status: 400 },
          )
        }

        // Check if survey already exists
        const existing = await dbFind(payload, slugs.satisfactionSurveys, {
          where: { ticket: { equals: ticketId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.docs.length > 0) {
          return Response.json(
            { error: 'Vous avez déjà évalué ce ticket.' },
            { status: 409 },
          )
        }

        const survey = await dbCreate(payload, slugs.satisfactionSurveys, {
          data: {
            source: 'ticket',
            ticket: ticketId,
            client: req.user.id,
            ...(hasRating ? { rating: Math.round(rating) } : {}),
            ...(hasNps ? { nps: Math.round(nps) } : {}),
            ...(comment ? { comment: comment.trim() } : {}),
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, survey })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[satisfaction] Error:', error)
        return Response.json({ error: 'Erreur interne.' }, { status: 500 })
      }
    },
  }
}
