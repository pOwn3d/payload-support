import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

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

        if (!req.user || req.user.collection !== slugs.supportClients) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json!()
        const { ticketId, rating, comment } = body

        if (!ticketId || !rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
          return Response.json(
            { error: 'ticketId et rating (entier 1-5) sont requis.' },
            { status: 400 },
          )
        }

        if (comment && typeof comment === 'string' && comment.length > 5000) {
          return Response.json(
            { error: 'Le commentaire ne peut pas dépasser 5000 caractères.' },
            { status: 400 },
          )
        }

        // Verify ticket belongs to client and is resolved
        const ticket = await payload.findByID({
          collection: slugs.tickets as any,
          id: ticketId,
          depth: 0,
          overrideAccess: false,
          user: req.user,
        }) as any

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
        const existing = await payload.find({
          collection: slugs.satisfactionSurveys as any,
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

        const survey = await payload.create({
          collection: slugs.satisfactionSurveys as any,
          data: {
            source: 'ticket',
            ticket: ticketId,
            client: req.user.id,
            rating: Math.round(rating),
            ...(comment ? { comment: comment.trim() } : {}),
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, survey })
      } catch (error) {
        console.error('[satisfaction] Error:', error)
        return Response.json({ error: 'Erreur interne.' }, { status: 500 })
      }
    },
  }
}
