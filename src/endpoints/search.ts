import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

/**
 * GET /api/support/search?q=term
 * Global search across tickets, messages, clients, knowledge base.
 * Admin-only.
 */
export function createSearchEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/search',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const url = new URL(req.url!)
        const q = url.searchParams.get('q')?.trim()
        if (!q || q.length < 2) {
          return Response.json({ tickets: [], clients: [], messages: [], articles: [] })
        }

        const [ticketsRes, clientsRes, messagesRes, articlesRes] = await Promise.all([
          payload.find({
            collection: slugs.tickets as any,
            where: {
              or: [
                { ticketNumber: { contains: q } },
                { subject: { contains: q } },
              ],
            },
            sort: '-updatedAt',
            limit: 8,
            depth: 1,
            overrideAccess: true,
          }),
          payload.find({
            collection: slugs.supportClients as any,
            where: {
              or: [
                { firstName: { contains: q } },
                { lastName: { contains: q } },
                { email: { contains: q } },
                { company: { contains: q } },
              ],
            },
            limit: 5,
            depth: 0,
            overrideAccess: true,
          }),
          payload.find({
            collection: slugs.ticketMessages as any,
            where: { body: { contains: q } },
            sort: '-createdAt',
            limit: 5,
            depth: 1,
            overrideAccess: true,
          }),
          payload.find({
            collection: slugs.knowledgeBase as any,
            where: { title: { contains: q } },
            limit: 5,
            depth: 0,
            overrideAccess: true,
          }),
        ])

        return Response.json({
          tickets: ticketsRes.docs.map((t: any) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            client: typeof t.client === 'object' ? { firstName: t.client?.firstName, company: t.client?.company } : null,
          })),
          clients: clientsRes.docs.map((c: any) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            company: c.company,
          })),
          messages: messagesRes.docs.map((m: any) => ({
            id: m.id,
            body: typeof m.body === 'string' ? m.body.slice(0, 100) : '',
            ticketId: typeof m.ticket === 'object' ? m.ticket?.id : m.ticket,
            ticketNumber: typeof m.ticket === 'object' ? m.ticket?.ticketNumber : null,
          })),
          articles: articlesRes.docs.map((a: any) => ({
            id: a.id,
            title: a.title,
            slug: a.slug,
          })),
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[search] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
