import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { escapeHtml } from '../utils/emailTemplate'
import { fireWebhooks } from '../utils/fireWebhooks'

/**
 * POST /api/support/process-scheduled
 * Process all scheduled replies whose scheduledAt has passed and scheduledSent is false.
 * Protected by x-cron-secret header (same as auto-close).
 */
export function createProcessScheduledEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/process-scheduled',
    method: 'post',
    handler: async (req) => {
      const secret = req.headers.get('x-cron-secret')
      const expectedSecret = process.env.CRON_SECRET

      if (!expectedSecret || secret !== expectedSecret) {
        return Response.json({ error: 'Non autorisé' }, { status: 401 })
      }

      try {
        const payload = req.payload
        const now = new Date()
        const results = { processed: 0, errors: 0 }

        // Find all messages where scheduledAt is in the past and scheduledSent is not true
        const scheduled = await payload.find({
          collection: slugs.ticketMessages as any,
          where: {
            and: [
              { scheduledAt: { less_than_equal: now.toISOString() } },
              {
                or: [
                  { scheduledSent: { equals: false } },
                  { scheduledSent: { exists: false } },
                ],
              },
            ],
          },
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })

        for (const message of scheduled.docs) {
          try {
            const msg = message as any
            const ticketId = typeof msg.ticket === 'object' ? msg.ticket.id : msg.ticket

            // Fetch the ticket with client data
            const ticket = await payload.findByID({
              collection: slugs.tickets as any,
              id: ticketId,
              depth: 1,
              overrideAccess: true,
            })

            if (!ticket) {
              console.warn(`[process-scheduled] Ticket ${ticketId} not found for message ${msg.id}`)
              results.errors++
              continue
            }

            const t = ticket as any
            const client = typeof t.client === 'object' ? t.client : null

            // Send email notification to client (same logic as createNotifyClient hook)
            if (client?.email && msg.authorType === 'admin' && !msg.isInternal) {
              const ticketNumber = t.ticketNumber || 'TK-????'
              const subject = t.subject || 'Support'
              const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
              const preview = msg.body?.length > 500 ? msg.body.slice(0, 500) + '...' : msg.body

              await payload.sendEmail({
                to: client.email,
                subject: `Re: [${ticketNumber}] ${subject}`,
                html: `<p>Bonjour ${escapeHtml(client.firstName || '')},</p><p>Notre équipe a répondu à votre ticket <strong>${escapeHtml(ticketNumber)}</strong>.</p><blockquote style="border-left:4px solid #2563eb;padding:12px;margin:16px 0;background:#f8fafc;">${escapeHtml(preview)}</blockquote><p><a href="${baseUrl}/support/tickets/${ticketId}">Consulter le ticket</a></p>`,
              })

              // Record email delivery info
              await payload.update({
                collection: slugs.ticketMessages as any,
                id: msg.id,
                data: {
                  scheduledSent: true,
                  emailSentAt: now.toISOString(),
                  emailSentTo: client.email,
                },
                overrideAccess: true,
              })
            } else {
              // No email needed (internal note or no client email), just mark as sent
              await payload.update({
                collection: slugs.ticketMessages as any,
                id: msg.id,
                data: { scheduledSent: true },
                overrideAccess: true,
              })
            }

            // Update ticket status if this is an admin reply
            if (msg.authorType === 'admin' && !msg.isInternal) {
              await payload.update({
                collection: slugs.tickets as any,
                id: ticketId,
                data: { status: 'waiting_client' },
                overrideAccess: true,
              })
            }

            // Fire webhook for the now-sent reply
            fireWebhooks(payload, slugs, 'ticket_replied', {
              ticketId,
              messageId: msg.id,
              authorType: msg.authorType,
              scheduled: true,
              body: msg.body?.length > 500 ? msg.body.slice(0, 500) + '...' : msg.body,
            })

            results.processed++
          } catch (err) {
            console.error(`[process-scheduled] Error processing message ${(message as any).id}:`, err)
            results.errors++
          }
        }

        return Response.json({
          success: true,
          ...results,
          timestamp: now.toISOString(),
        })
      } catch (error) {
        console.error('[process-scheduled] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
