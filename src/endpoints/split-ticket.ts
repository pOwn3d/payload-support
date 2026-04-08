import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

/**
 * POST /api/support/split-ticket
 * Extract a message into a new ticket. Admin-only.
 */
export function createSplitTicketEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/split-ticket',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const { messageId, subject } = (await req.json!()) as { messageId: number; subject?: string }
        if (!messageId) {
          return Response.json({ error: 'messageId required' }, { status: 400 })
        }

        const message = await payload.findByID({
          collection: slugs.ticketMessages as any,
          id: messageId,
          depth: 1,
          overrideAccess: true,
        }) as any

        if (!message) {
          return Response.json({ error: 'Message not found' }, { status: 404 })
        }

        const sourceTicket = typeof message.ticket === 'object' ? message.ticket : null
        if (!sourceTicket) {
          return Response.json({ error: 'Cannot resolve source ticket' }, { status: 400 })
        }

        const clientId = typeof sourceTicket.client === 'object'
          ? sourceTicket.client.id
          : sourceTicket.client

        // Create new ticket
        const newTicket = await payload.create({
          collection: slugs.tickets as any,
          data: {
            subject: subject || `Split: ${sourceTicket.subject}`,
            client: clientId,
            status: 'open',
            priority: sourceTicket.priority || 'normal',
            category: sourceTicket.category || 'question',
            source: sourceTicket.source || 'portal',
            relatedTickets: [sourceTicket.id],
          },
          overrideAccess: true,
        }) as any

        // Copy message to new ticket
        const attachments = (message.attachments as Array<{ file: { id: number } | number }> | undefined)?.map((a: any) => ({
          file: typeof a.file === 'object' ? a.file.id : a.file,
        })) || []

        await payload.create({
          collection: slugs.ticketMessages as any,
          data: {
            ticket: newTicket.id,
            body: message.body,
            bodyHtml: message.bodyHtml || undefined,
            authorType: message.authorType,
            authorClient: typeof message.authorClient === 'object' ? message.authorClient?.id : message.authorClient,
            isInternal: false,
            skipNotification: true,
            ...(attachments.length > 0 && { attachments }),
          },
          overrideAccess: true,
        })

        // Add system note on source ticket
        await payload.create({
          collection: slugs.ticketMessages as any,
          data: {
            ticket: sourceTicket.id,
            body: `Message extrait vers le ticket ${newTicket.ticketNumber}`,
            authorType: 'admin',
            isInternal: true,
            skipNotification: true,
          },
          overrideAccess: true,
        })

        // Link source ticket to new ticket (bidirectional)
        const existingRelated = Array.isArray(sourceTicket.relatedTickets)
          ? sourceTicket.relatedTickets.map((t: any) => typeof t === 'object' ? t.id : t)
          : []

        if (!existingRelated.includes(newTicket.id)) {
          await payload.update({
            collection: slugs.tickets as any,
            id: sourceTicket.id,
            data: { relatedTickets: [...existingRelated, newTicket.id] },
            overrideAccess: true,
          })
        }

        // Log activity
        await payload.create({
          collection: slugs.ticketActivityLog as any,
          data: {
            ticket: sourceTicket.id,
            action: 'split',
            detail: `Message extrait vers ${newTicket.ticketNumber}`,
            actorType: 'admin',
            actorEmail: req.user.email,
          },
          overrideAccess: true,
        })

        return Response.json({
          ticketId: newTicket.id,
          ticketNumber: newTicket.ticketNumber,
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[split-ticket] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
