import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { handleAuthError, AuthError } from '../utils/auth'
import { escapeHtml, emailWrapper, emailButton, emailParagraph } from '../utils/emailTemplate'
import { readSupportSettings } from '../utils/readSettings'
import { RateLimiter } from '../utils/rateLimiter'
import { dbFindByID, dbFind, dbCreate, dbCount } from '../utils/db'

// Simple RFC-5322 style sanity check — same level of strictness as the
// portal forms used elsewhere in the plugin. Server-side validation only;
// the client is expected to validate too.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX_TRANSFERS_PER_DAY = 5

// In-memory fail-closed rate limiter — enforced even when the persistent
// emailLogs-based check is unavailable (collection disabled). Prevents the
// endpoint from becoming an unbounded outbound mailer.
const transferLimiter = new RateLimiter(24 * 60 * 60 * 1000, MAX_TRANSFERS_PER_DAY)

/**
 * POST /api/support/tickets/:id/transfer
 *
 * Authenticated endpoint — accepts admin OR the ticket's owner (support-clients).
 * Sends a recap of the ticket conversation to an external email address.
 *
 * Body: { email: string, includeAttachments?: boolean, message?: string }
 *
 * Behaviour:
 *  - Verifies access (ownership or admin)
 *  - Renders an HTML recap : subject, status, timeline (no internal notes), attachments as links
 *  - Sends via payload.sendEmail
 *  - Logs the action in `email-logs` (action='transfer') when that collection exists
 *  - Rate-limited to 5 transfers per ticket per 24h
 */
export function createTransferTicketEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/tickets/:id/transfer',
    method: 'post',
    handler: async (req) => {
      try {
        if (!req.user) throw new AuthError('Authentication required', 401)

        const idRaw = req.routeParams?.id as string | undefined
        if (!idRaw) return Response.json({ error: 'missing-id' }, { status: 400 })
        const ticketId = Number(idRaw)
        if (Number.isNaN(ticketId)) return Response.json({ error: 'invalid-id' }, { status: 400 })

        let body: { email?: string; includeAttachments?: boolean; message?: string }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const email = (body.email || '').trim().toLowerCase()
        if (!email || !EMAIL_RE.test(email) || email.length > 254) {
          return Response.json({ error: 'Email invalide' }, { status: 400 })
        }
        const includeAttachments = body.includeAttachments !== false
        const customMessage = typeof body.message === 'string' ? body.message.slice(0, 1000) : ''

        const payload = req.payload

        // Load ticket (ownership check happens here too)
        const ticket = await dbFindByID(payload, slugs.tickets, {
          id: ticketId,
          depth: 1,
          overrideAccess: true,
        })
        if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 })

        const isAdmin = req.user.collection === slugs.users
        const isOwner =
          req.user.collection === slugs.supportClients &&
          (typeof ticket.client === 'object'
            ? ticket.client?.id === req.user.id
            : ticket.client === req.user.id)
        if (!isAdmin && !isOwner) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Fail-closed in-memory rate limit (per user + ticket): enforced even
        // when the persistent emailLogs check below cannot run.
        if (transferLimiter.check(`${req.user.id}:${ticketId}`)) {
          return Response.json(
            { error: `Limite atteinte (${MAX_TRANSFERS_PER_DAY} transferts par 24h sur ce ticket)` },
            { status: 429 },
          )
        }

        // Rate limit: count transfers in last 24h for this ticket
        try {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          const existing = await dbCount(payload, slugs.emailLogs, {
            where: {
              and: [
                { action: { equals: 'transfer' } },
                { ticketNumber: { equals: ticket.ticketNumber || `#${ticketId}` } },
                { createdAt: { greater_than: since } },
              ],
            },
            overrideAccess: true,
          })
          if (existing.totalDocs >= MAX_TRANSFERS_PER_DAY) {
            return Response.json(
              { error: `Limite atteinte (${MAX_TRANSFERS_PER_DAY} transferts par 24h sur ce ticket)` },
              { status: 429 },
            )
          }
        } catch {
          // emailLogs collection may not exist (feature disabled). Skip silently.
        }

        // Fetch non-internal messages, ordered chronologically
        const messages = await dbFind(payload, slugs.ticketMessages, {
          where: {
            and: [
              { ticket: { equals: ticketId } },
              { isInternal: { equals: false } },
            ],
          },
          sort: 'createdAt',
          limit: 200,
          depth: 1,
          overrideAccess: true,
        })

        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
        const ticketNumber = (ticket.ticketNumber as string) || `#${ticketId}`
        const subject = (ticket.subject as string) || 'Ticket'
        const statusLabel = statusToLabel(ticket.status)

        // Build timeline HTML
        const timelineHtml = messages.docs.map((m: any) => {
          const date = m.createdAt
            ? new Date(m.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
            : ''
          const authorLabel = m.authorType === 'admin'
            ? 'Équipe support'
            : (m.authorClient && typeof m.authorClient === 'object'
                ? `${m.authorClient.firstName || ''} ${m.authorClient.lastName || ''}`.trim() || 'Client'
                : 'Client')

          // Plain-text body; we escape HTML for safety in external recaps
          const bodyText = (m.body as string) || ''
          const bodyHtml = escapeHtml(bodyText).replace(/\n/g, '<br/>')

          let attachmentsHtml = ''
          if (includeAttachments && Array.isArray(m.attachments) && m.attachments.length > 0) {
            const items = m.attachments
              .map((a: any) => {
                const f = a?.file
                if (!f || typeof f !== 'object') return ''
                const url = f.url ? (f.url.startsWith('http') ? f.url : `${baseUrl}${f.url}`) : ''
                const name = f.filename || f.title || 'pièce jointe'
                if (!url) return `<li>${escapeHtml(name)} (lien indisponible)</li>`
                return `<li><a href="${escapeHtml(url)}">${escapeHtml(name)}</a></li>`
              })
              .filter(Boolean)
              .join('')
            if (items) {
              attachmentsHtml = `<ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569;">${items}</ul>`
            }
          }

          return `
            <div style="margin: 0 0 16px 0; padding: 14px 16px; border-left: 3px solid #e2e8f0; background: #f8fafc; border-radius: 0 8px 8px 0;">
              <div style="margin-bottom: 8px; font-size: 12px; color: #64748b;">
                <strong style="color: #0f172a;">${escapeHtml(authorLabel)}</strong>
                ${date ? ` &middot; ${escapeHtml(date)}` : ''}
              </div>
              <div style="font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${bodyHtml || '<em>(message vide)</em>'}</div>
              ${attachmentsHtml}
            </div>
          `
        }).join('')

        const customMessageHtml = customMessage
          ? `<div style="margin: 0 0 24px 0; padding: 16px; background: #fef9c3; border: 1px solid #fde047; border-radius: 8px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #854d0e; margin-bottom: 6px;">Message du transmetteur</div>
              <div style="font-size: 14px; color: #422006; white-space: pre-wrap;">${escapeHtml(customMessage)}</div>
            </div>`
          : ''

        const settings = await readSupportSettings(payload).catch(() => null)
        const replyTo = settings?.email?.replyToAddress || process.env.SUPPORT_REPLY_TO || ''

        const html = emailWrapper(
          `Récapitulatif ticket ${ticketNumber}`,
          [
            emailParagraph(`Bonjour,`),
            emailParagraph(
              `Voici le récapitulatif du ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em>.`,
            ),
            customMessageHtml,
            `<table cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
              <tr><td style="padding: 4px 12px 4px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Sujet</td><td style="padding: 4px 0; font-size: 14px; color: #0f172a;">${escapeHtml(subject)}</td></tr>
              <tr><td style="padding: 4px 12px 4px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Statut</td><td style="padding: 4px 0; font-size: 14px; color: #0f172a;">${escapeHtml(statusLabel)}</td></tr>
              <tr><td style="padding: 4px 12px 4px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Numéro</td><td style="padding: 4px 0; font-size: 14px; color: #0f172a;">${escapeHtml(ticketNumber)}</td></tr>
            </table>`,
            `<h2 style="margin: 24px 0 12px 0; font-size: 16px; color: #0f172a;">Conversation</h2>`,
            timelineHtml || emailParagraph('<em>Aucun échange à afficher.</em>'),
            baseUrl
              ? emailButton('Voir le ticket', `${baseUrl}/support/tickets/${ticketId}`)
              : '',
            emailParagraph(
              `<span style="font-size: 12px; color: #94a3b8;">Ce récapitulatif a été transmis depuis l'espace support. Ne répondez pas à cet email — utilisez le lien ci-dessus pour échanger.</span>`,
            ),
          ].join(''),
        )

        await payload.sendEmail({
          to: email,
          ...(replyTo ? { replyTo } : {}),
          subject: `Récapitulatif support — ${ticketNumber} ${subject}`,
          html,
        })

        // Log the transfer (best-effort)
        try {
          await dbCreate(payload, slugs.emailLogs, {
            data: {
              status: 'success',
              action: 'transfer',
              senderEmail:
                req.user.collection === slugs.supportClients
                  ? (req.user as any).email
                  : (req.user as any).email,
              recipientEmail: email,
              subject: `Transfert ${ticketNumber}`,
              ticketNumber,
            },
            overrideAccess: true,
          })
        } catch {
          // emailLogs may not be enabled — silently skip
        }

        return Response.json({ ok: true, sentTo: email })
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[support/transfer-ticket] Error:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}

function statusToLabel(status: unknown): string {
  switch (status) {
    case 'open': return 'Ouvert'
    case 'waiting_client': return 'En attente du client'
    case 'resolved': return 'Résolu'
    case 'closed': return 'Clôturé'
    case 'escalated': return 'Escaladé'
    default: return String(status || '—')
  }
}
