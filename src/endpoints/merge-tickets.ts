import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

/**
 * POST /api/support/merge-tickets
 * Merge source ticket into target ticket. Admin-only.
 */
export function createMergeTicketsEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/merge-tickets',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const { sourceTicketId, targetTicketId } = await req.json!()

        if (!sourceTicketId || !targetTicketId) {
          return Response.json({ error: 'sourceTicketId et targetTicketId requis' }, { status: 400 })
        }

        if (sourceTicketId === targetTicketId) {
          return Response.json({ error: 'Impossible de fusionner un ticket avec lui-même' }, { status: 400 })
        }

        const [source, target] = await Promise.all([
          payload.findByID({ collection: slugs.tickets as any, id: sourceTicketId, depth: 0, overrideAccess: true }),
          payload.findByID({ collection: slugs.tickets as any, id: targetTicketId, depth: 0, overrideAccess: true }),
        ])

        if (!source) return Response.json({ error: 'Ticket source introuvable' }, { status: 404 })
        if (!target) return Response.json({ error: 'Ticket cible introuvable' }, { status: 404 })

        const sourceClient = typeof source.client === 'object' ? (source.client as any).id : source.client
        const targetClient = typeof target.client === 'object' ? (target.client as any).id : target.client

        if (sourceClient !== targetClient) {
          return Response.json({ error: 'Les deux tickets doivent appartenir au même client' }, { status: 400 })
        }

        // Move all messages from source to target
        const messages = await payload.find({
          collection: slugs.ticketMessages as any,
          where: { ticket: { equals: sourceTicketId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })

        for (const msg of messages.docs) {
          await payload.update({
            collection: slugs.ticketMessages as any,
            id: msg.id,
            data: { ticket: targetTicketId },
            overrideAccess: true,
          })
        }

        // Move time entries
        const timeEntries = await payload.find({
          collection: slugs.timeEntries as any,
          where: { ticket: { equals: sourceTicketId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })

        for (const entry of timeEntries.docs) {
          await payload.update({
            collection: slugs.timeEntries as any,
            id: entry.id,
            data: { ticket: targetTicketId },
            overrideAccess: true,
          })
        }

        // Add internal note to target
        const sourceNumber = (source as any).ticketNumber || `#${sourceTicketId}`
        await payload.create({
          collection: slugs.ticketMessages as any,
          data: {
            ticket: targetTicketId,
            body: `Messages fusionnés depuis ${sourceNumber} (${messages.totalDocs} messages, ${timeEntries.totalDocs} entrées de temps)`,
            authorType: 'admin',
            isInternal: true,
            skipNotification: true,
          },
          overrideAccess: true,
        })

        // Delete source ticket
        await payload.delete({
          collection: slugs.tickets as any,
          id: sourceTicketId,
          overrideAccess: true,
        })

        // Recalculate totalTimeMinutes on target
        const allTimeEntries = await payload.find({
          collection: slugs.timeEntries as any,
          where: { ticket: { equals: targetTicketId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })

        const totalMinutes = allTimeEntries.docs.reduce(
          (sum: number, e: any) => sum + (e.duration || 0),
          0,
        )

        await payload.update({
          collection: slugs.tickets as any,
          id: targetTicketId,
          data: { totalTimeMinutes: totalMinutes },
          overrideAccess: true,
        })

        return Response.json({
          success: true,
          messagesMoved: messages.totalDocs,
          timeEntriesMoved: timeEntries.totalDocs,
          sourceTicket: sourceNumber,
          targetTicket: (target as any).ticketNumber || `#${targetTicketId}`,
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[merge-tickets] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
