import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireClient, handleAuthError } from '../utils/auth'

/**
 * GET /api/support/export-data
 * RGPD Data Export — allows support clients to download all their personal data.
 */
export function createExportDataEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/export-data',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireClient(req, slugs)

        const [clientData, ticketsResult, messagesResult, surveysResult] = await Promise.all([
          payload.findByID({
            collection: slugs.supportClients as any,
            id: req.user.id,
            depth: 0,
            overrideAccess: true,
          }),
          payload.find({
            collection: slugs.tickets as any,
            where: { client: { equals: req.user.id } },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          }),
          payload.find({
            collection: slugs.ticketMessages as any,
            where: {
              'ticket.client': { equals: req.user.id },
              authorType: { equals: 'client' },
            },
            limit: 5000,
            depth: 0,
            overrideAccess: true,
          }),
          payload.find({
            collection: slugs.satisfactionSurveys as any,
            where: { client: { equals: req.user.id } },
            limit: 500,
            depth: 0,
            overrideAccess: true,
          }),
        ])

        const c = clientData as any
        const exportData = {
          exportDate: new Date().toISOString(),
          exportType: 'RGPD - Export des données personnelles',
          profile: {
            email: c.email,
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company,
            phone: c.phone || null,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          },
          tickets: ticketsResult.docs.map((t: any) => ({
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            category: t.category,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
          messages: messagesResult.docs.map((m: any) => ({
            ticketId: m.ticket,
            body: m.body,
            createdAt: m.createdAt,
          })),
          surveys: surveysResult.docs.map((s: any) => ({
            ticketId: s.ticket,
            rating: s.rating,
            comment: s.comment,
            createdAt: s.createdAt,
          })),
        }

        const json = JSON.stringify(exportData, null, 2)

        return new Response(json, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="support-export-${req.user.id}-${new Date().toISOString().slice(0, 10)}.json"`,
          },
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[export-data] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
