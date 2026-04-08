import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { RateLimiter } from '../utils/rateLimiter'
import { escapeHtml } from '../utils/emailTemplate'

const resendLimiter = new RateLimiter(60 * 60 * 1000, 10) // 10 per hour

/**
 * POST /api/support/resend-notification
 * Resend the email notification for a specific ticket message. Admin-only.
 */
export function createResendNotificationEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/resend-notification',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (resendLimiter.check(String(req.user.id))) {
          return Response.json(
            { error: 'Trop de renvois. Réessayez dans une heure.' },
            { status: 429 },
          )
        }

        let body: { messageId?: string | number }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { messageId } = body

        if (!messageId) {
          return Response.json({ error: 'messageId requis' }, { status: 400 })
        }

        const message = await payload.findByID({
          collection: slugs.ticketMessages as any,
          id: messageId,
          depth: 0,
          overrideAccess: true,
        }) as any

        if (!message) {
          return Response.json({ error: 'Message introuvable' }, { status: 404 })
        }

        const ticketId = typeof message.ticket === 'object' ? message.ticket.id : message.ticket
        const ticket = await payload.findByID({
          collection: slugs.tickets as any,
          id: ticketId,
          depth: 1,
          overrideAccess: true,
        }) as any

        if (!ticket) {
          return Response.json({ error: 'Ticket introuvable' }, { status: 404 })
        }

        const client = typeof ticket.client === 'object' ? ticket.client : null
        if (!client?.email) {
          return Response.json({ error: 'Client sans email' }, { status: 400 })
        }

        const ticketNumber = ticket.ticketNumber || 'TK-????'
        const subject = ticket.subject || 'Support'
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
        const portalUrl = `${baseUrl}/support/tickets/${ticketId}`
        const preview = message.body?.length > 500 ? message.body.slice(0, 500) + '...' : message.body

        await payload.sendEmail({
          to: client.email,
          replyTo: process.env.SUPPORT_REPLY_TO || '',
          subject: `Re: [${ticketNumber}] ${subject}`,
          html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <p>Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,</p>
            <p>Notre équipe a apporté une réponse à votre ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em>.</p>
            <blockquote style="border-left: 4px solid #ccc; padding: 8px 16px; margin: 16px 0; color: #555;">${escapeHtml(preview)}</blockquote>
            <p><a href="${portalUrl}">Consulter le ticket</a></p>
          </div>`,
        })

        return Response.json({ success: true })
      } catch (error) {
        console.error('[resend-notification] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
