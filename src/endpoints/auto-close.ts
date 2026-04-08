import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

const DEFAULT_CLOSE_AFTER_REMIND_DAYS = 2

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * GET /api/support/auto-close
 * Auto-close inactive tickets. Protected by x-cron-secret header.
 */
export function createAutoCloseEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/auto-close',
    method: 'get',
    handler: async (req) => {
      const secret = req.headers.get('x-cron-secret')
      const expectedSecret = process.env.CRON_SECRET

      if (!expectedSecret || secret !== expectedSecret) {
        return Response.json({ error: 'Non autorisé' }, { status: 401 })
      }

      try {
        const payload = req.payload
        const now = new Date()
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

        const url = new URL(req.url!)
        const totalDaysParam = url.searchParams.get('days')
        const totalDays = totalDaysParam ? parseInt(totalDaysParam, 10) : 7
        const REMIND_AFTER_DAYS = Math.max(1, totalDays - DEFAULT_CLOSE_AFTER_REMIND_DAYS)
        const CLOSE_AFTER_REMIND_DAYS = DEFAULT_CLOSE_AFTER_REMIND_DAYS

        const results = { reminded: 0, closed: 0, errors: 0 }

        // Step 1: Find tickets needing a reminder
        const remindCutoff = new Date(now.getTime() - REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000)

        const ticketsToRemind = await payload.find({
          collection: slugs.tickets as any,
          where: {
            and: [
              { status: { equals: 'waiting_client' } },
              { autoCloseRemindedAt: { exists: false } },
              { updatedAt: { less_than: remindCutoff.toISOString() } },
            ],
          },
          limit: 50,
          depth: 1,
          overrideAccess: true,
        })

        for (const ticket of ticketsToRemind.docs) {
          try {
            const t = ticket as any
            const client = typeof t.client === 'object' ? t.client : null
            if (!client?.email) continue

            const ticketNumber = t.ticketNumber || 'TK-????'
            const subject = t.subject || 'Support'
            const portalUrl = `${baseUrl}/support/tickets/${t.id}`

            await payload.sendEmail({
              to: client.email,
              replyTo: process.env.SUPPORT_REPLY_TO || '',
              subject: `Rappel : [${ticketNumber}] ${subject} — En attente de votre réponse`,
              html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,</p>
                <p>Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em> — est en attente de votre réponse depuis ${REMIND_AFTER_DAYS} jours.</p>
                <p>Si le problème est résolu ou si vous n'avez plus besoin d'assistance, ce ticket sera automatiquement marqué comme résolu dans 2 jours.</p>
                <p><a href="${portalUrl}">Répondre au ticket</a></p>
              </div>`,
            })

            await payload.update({
              collection: slugs.tickets as any,
              id: t.id,
              data: { autoCloseRemindedAt: now.toISOString() },
              overrideAccess: true,
            })

            results.reminded++
          } catch (err) {
            console.error(`[auto-close] Error reminding ticket ${(ticket as any).id}:`, err)
            results.errors++
          }
        }

        // Step 2: Close tickets that were reminded > CLOSE_AFTER_REMIND_DAYS ago
        const closeCutoff = new Date(now.getTime() - CLOSE_AFTER_REMIND_DAYS * 24 * 60 * 60 * 1000)

        const ticketsToClose = await payload.find({
          collection: slugs.tickets as any,
          where: {
            and: [
              { status: { equals: 'waiting_client' } },
              { autoCloseRemindedAt: { less_than: closeCutoff.toISOString() } },
              {
                or: [
                  { lastClientMessageAt: { exists: false } },
                  { lastClientMessageAt: { less_than_equal: closeCutoff.toISOString() } },
                ],
              },
            ],
          },
          limit: 50,
          depth: 1,
          overrideAccess: true,
        })

        for (const ticket of ticketsToClose.docs) {
          try {
            const t = ticket as any
            const client = typeof t.client === 'object' ? t.client : null
            const ticketNumber = t.ticketNumber || 'TK-????'
            const subject = t.subject || 'Support'
            const closeTotalDays = REMIND_AFTER_DAYS + CLOSE_AFTER_REMIND_DAYS

            await payload.create({
              collection: slugs.ticketMessages as any,
              data: {
                ticket: t.id,
                body: `Ticket résolu automatiquement — sans réponse client depuis ${closeTotalDays} jours`,
                authorType: 'admin',
                isInternal: true,
                skipNotification: true,
              },
              overrideAccess: true,
            })

            await payload.update({
              collection: slugs.tickets as any,
              id: t.id,
              data: { status: 'resolved' },
              overrideAccess: true,
            })

            if (client?.email) {
              const portalUrl = `${baseUrl}/support/tickets/${t.id}`
              await payload.sendEmail({
                to: client.email,
                replyTo: process.env.SUPPORT_REPLY_TO || '',
                subject: `[${ticketNumber}] Ticket résolu — ${subject}`,
                html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <p>Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,</p>
                  <p>Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em> — a été résolu automatiquement après ${closeTotalDays} jours sans réponse.</p>
                  <p>Si vous avez encore besoin d'aide, n'hésitez pas à rouvrir ce ticket ou à en créer un nouveau.</p>
                  <p><a href="${portalUrl}">Consulter le ticket</a></p>
                </div>`,
              })
            }

            results.closed++
          } catch (err) {
            console.error(`[auto-close] Error closing ticket ${(ticket as any).id}:`, err)
            results.errors++
          }
        }

        return Response.json({
          success: true,
          ...results,
          timestamp: now.toISOString(),
        })
      } catch (error) {
        console.error('[auto-close] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
