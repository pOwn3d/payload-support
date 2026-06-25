import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { RateLimiter } from '../utils/rateLimiter'
import { escapeHtml, emailWrapper, emailParagraph, emailButton } from '../utils/emailTemplate'
import { readSupportSettings } from '../utils/readSettings'
import { dbFindByID, dbFind, dbCreate, dbUpdate } from '../utils/db'

// Manual reminders are a deliberate admin action, so the cap is generous —
// it only exists to stop a runaway script, not normal usage.
const reminderLimiter = new RateLimiter(60 * 60 * 1000, 30) // 30 per hour per admin

const MIN_HOURS = 1
const MAX_HOURS = 24 * 30 // 30 days

function formatFr(date: Date, withTime: boolean): string {
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Europe/Paris',
  })
}

/**
 * POST /api/support/send-reminder
 *
 * Manually nudge a client whose ticket is awaiting their reply: sends a generic
 * "your ticket will be closed if you don't respond" email, drops an internal
 * note in the thread, and arms the ticket for automatic closure.
 *
 * Arming = set `status: waiting_client`, `autoCloseRemindedAt: now` (so the
 * day-based cron reminder skips it) and `autoCloseScheduledAt: now + hours`.
 * The existing `/api/support/auto-close` cron then resolves the ticket once the
 * deadline passes — UNLESS the client replies first, which flips the status back
 * to `open` and clears `autoCloseScheduledAt` (see TicketMessages auto-update hook).
 *
 * Admin-only, rate-limited.
 */
export function createSendReminderEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/send-reminder',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        if (reminderLimiter.check(String(req.user.id))) {
          return Response.json(
            { error: 'Trop de relances. Réessayez dans une heure.' },
            { status: 429 },
          )
        }

        let body: { ticketId?: string | number; hours?: number }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { ticketId } = body
        if (!ticketId) {
          return Response.json({ error: 'ticketId requis' }, { status: 400 })
        }

        const rawHours = Number(body.hours)
        const hours = Number.isFinite(rawHours)
          ? Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(rawHours)))
          : 24

        const ticket = await dbFindByID(payload, slugs.tickets, {
          id: ticketId,
          depth: 1,
          overrideAccess: true,
        })

        if (!ticket) {
          return Response.json({ error: 'Ticket introuvable' }, { status: 404 })
        }

        const client = typeof ticket.client === 'object' ? ticket.client : null
        if (!client?.email) {
          return Response.json({ error: 'Client sans email' }, { status: 400 })
        }

        const now = new Date()
        const deadline = new Date(now.getTime() + hours * 60 * 60 * 1000)

        const settings = await readSupportSettings(payload)
        const ticketNumber = ticket.ticketNumber || 'TK-????'
        const subject = ticket.subject || 'Support'
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
        const portalUrl = `${baseUrl}/support/tickets/${ticketId}`
        const replyTo = settings.email.replyToAddress || process.env.SUPPORT_REPLY_TO || ''

        // "En attente depuis le …" — anchored on our last public reply (that's
        // what the client owes a response to), falling back to the first
        // response then to ticket creation.
        let waitingSince: string | undefined = ticket.firstResponseAt || ticket.createdAt
        try {
          const lastAdminMsg = await dbFind(payload, slugs.ticketMessages, {
            where: {
              and: [
                { ticket: { equals: ticketId } },
                { authorType: { equals: 'admin' } },
                { isInternal: { equals: false } },
              ],
            },
            sort: '-createdAt',
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          if (lastAdminMsg.docs.length > 0 && lastAdminMsg.docs[0].createdAt) {
            waitingSince = lastAdminMsg.docs[0].createdAt as string
          }
        } catch { /* fallback already set */ }

        const sinceLabel = waitingSince ? formatFr(new Date(waitingSince), false) : null
        const deadlineLabel = formatFr(deadline, true)

        await payload.sendEmail({
          to: client.email,
          ...(replyTo ? { replyTo } : {}),
          subject: `Rappel : [${ticketNumber}] ${subject} — votre réponse est attendue`,
          html: emailWrapper(`Votre ticket attend votre réponse`, [
            emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,`),
            emailParagraph(
              `Votre ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(String(subject))}</em> — est en attente de votre réponse${sinceLabel ? ` depuis le ${escapeHtml(sinceLabel)}` : ''}.`,
            ),
            emailParagraph(
              `<strong>Sans retour de votre part, ce ticket sera automatiquement clôturé le ${escapeHtml(deadlineLabel)}.</strong>`,
            ),
            emailParagraph(
              `Si vous avez encore besoin d'assistance, il vous suffit de répondre à ce message — votre réponse maintiendra le ticket ouvert.`,
            ),
            emailButton('Répondre au ticket', portalUrl, 'primary'),
          ].join(''), {
            kind: 'alert',
            preheader: `Sans réponse de votre part, votre ticket ${ticketNumber} sera clôturé le ${deadlineLabel}.`,
          }),
        })

        // Internal note for the conversation timeline (never sent to the client).
        await dbCreate(payload, slugs.ticketMessages, {
          data: {
            ticket: ticketId,
            body: `Relance envoyée à ${client.email}. Fermeture automatique programmée le ${deadlineLabel} sans réponse du client.`,
            authorType: 'admin',
            isInternal: true,
            skipNotification: true,
          },
          overrideAccess: true,
        })

        // Arm the ticket. `autoCloseRemindedAt: now` keeps the day-based cron
        // reminder from firing a second time; `autoCloseScheduledAt` is the hard
        // 24h-style deadline the cron close step honours.
        await dbUpdate(payload, slugs.tickets, {
          id: ticketId,
          data: {
            status: 'waiting_client',
            autoCloseRemindedAt: now.toISOString(),
            autoCloseScheduledAt: deadline.toISOString(),
          },
          overrideAccess: true,
        })

        return Response.json({
          success: true,
          sentTo: client.email,
          scheduledCloseAt: deadline.toISOString(),
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[send-reminder] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
