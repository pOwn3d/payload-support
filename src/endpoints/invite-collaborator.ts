import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { handleAuthError, AuthError } from '../utils/auth'
import { escapeHtml, emailWrapper, emailButton, emailParagraph } from '../utils/emailTemplate'
import { readSupportSettings } from '../utils/readSettings'
import { randomBytes } from 'crypto'
import { RateLimiter } from '../utils/rateLimiter'
import { dbFindByID, dbFind, dbCreate, dbUpdate, dbCount } from '../utils/db'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Anti-abuse limits: an invite can create a placeholder account AND send an
// email, so cap both the volume per user and the collaborators per ticket.
const MAX_COLLABORATORS_PER_TICKET = 20
const inviteLimiter = new RateLimiter(60 * 60 * 1000, 10)

/**
 * POST /api/support/tickets/:id/invite
 *
 * Authenticated endpoint — admin OR ticket owner can invite an additional
 * `support-clients` to view or collaborate on the ticket.
 *
 * Body: { email: string, role?: 'viewer' | 'collaborator' }
 *
 * Behaviour:
 *  - Verifies access (ownership or admin)
 *  - Looks up an existing `support-clients` with this email; creates one if missing.
 *    Newly-created clients are minimal (firstName="Invité", lastName="", company="—")
 *    so they can be enriched later via the standard portal flow.
 *  - Upserts a row into `ticket-collaborators` (one per (ticket, client)).
 *  - Sends an invitation email with a magic link `/support/tickets/:id?inviteToken=...`.
 *  - Returns { ok, invitedTo, role }.
 */
export function createInviteCollaboratorEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/tickets/:id/invite',
    method: 'post',
    handler: async (req) => {
      try {
        if (!req.user) throw new AuthError('Authentication required', 401)

        const idRaw = req.routeParams?.id as string | undefined
        if (!idRaw) return Response.json({ error: 'missing-id' }, { status: 400 })
        const ticketId = Number(idRaw)
        if (Number.isNaN(ticketId)) return Response.json({ error: 'invalid-id' }, { status: 400 })

        let body: { email?: string; role?: 'viewer' | 'collaborator' }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const email = (body.email || '').trim().toLowerCase()
        if (!email || !EMAIL_RE.test(email) || email.length > 254) {
          return Response.json({ error: 'Email invalide' }, { status: 400 })
        }
        const role = body.role === 'collaborator' ? 'collaborator' : 'viewer'

        const payload = req.payload

        const ticket = await dbFindByID(payload, slugs.tickets, {
          id: ticketId,
          depth: 1,
          overrideAccess: true,
        })
        if (!ticket) return Response.json({ error: 'Ticket introuvable' }, { status: 404 })

        const isAdmin = req.user.collection === slugs.users
        const ownerId = typeof ticket.client === 'object' ? ticket.client?.id : ticket.client
        const isOwner =
          req.user.collection === slugs.supportClients && ownerId === req.user.id
        if (!isAdmin && !isOwner) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Anti-abuse: cap invite volume per user (in-memory, fail-closed).
        if (inviteLimiter.check(String(req.user.id))) {
          return Response.json({ error: 'Trop d\'invitations. Réessayez plus tard.' }, { status: 429 })
        }

        // Cap collaborators per ticket to prevent mass placeholder-account creation.
        const collabCount = await dbCount(payload, 'ticket-collaborators', { where: { ticket: { equals: ticketId } }, overrideAccess: true })
          .catch(() => ({ totalDocs: 0 }))
        if (collabCount.totalDocs >= MAX_COLLABORATORS_PER_TICKET) {
          return Response.json(
            { error: `Limite de ${MAX_COLLABORATORS_PER_TICKET} collaborateurs atteinte sur ce ticket` },
            { status: 429 },
          )
        }

        // Prevent inviting the primary owner (no-op)
        const ownerEmail =
          typeof ticket.client === 'object' ? (ticket.client?.email as string | undefined) : undefined
        if (ownerEmail && ownerEmail.toLowerCase() === email) {
          return Response.json({ error: 'Ce client est déjà propriétaire du ticket' }, { status: 400 })
        }

        // Find-or-create the invited support-client
        let inviteeId: number | string | null = null
        const existing = await dbFind(payload, slugs.supportClients, {
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          inviteeId = (existing.docs[0] as any).id
        } else {
          // Create a placeholder client; password is random — the invitee will reset
          // via the forgotPassword flow triggered by the SupportClients afterChange hook.
          const tempPassword = randomBytes(16).toString('hex')
          const created = await dbCreate(payload, slugs.supportClients, {
            data: {
              email,
              firstName: 'Invité',
              lastName: email.split('@')[0]?.slice(0, 40) || '',
              company: '—',
              password: tempPassword,
            } as any,
            overrideAccess: true,
            // Skip the "welcome" hook firing — let invitation email do the welcome instead
            context: { skipInviteEmail: true } as any,
          })
          inviteeId = (created as any).id
        }

        if (!inviteeId) {
          return Response.json({ error: 'Impossible de créer le client invité' }, { status: 500 })
        }

        // Upsert ticket-collaborator row (one per (ticket, client))
        const dupe = await dbFind(payload, 'ticket-collaborators', {
          where: {
            and: [
              { ticket: { equals: ticketId } },
              { client: { equals: inviteeId } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        const invitationToken = randomBytes(24).toString('hex')

        if (dupe.docs.length > 0) {
          await dbUpdate(payload, 'ticket-collaborators', {
            id: (dupe.docs[0] as any).id,
            data: { role, invitationToken },
            overrideAccess: true,
          })
        } else {
          await dbCreate(payload, 'ticket-collaborators', {
            data: {
              ticket: ticketId,
              client: inviteeId,
              email,
              role,
              invitedBy: {
                relationTo: req.user.collection,
                value: req.user.id,
              },
              invitationToken,
            } as any,
            overrideAccess: true,
          })
        }

        // Send invitation email
        const settings = await readSupportSettings(payload).catch(() => null)
        const replyTo = settings?.email?.replyToAddress || process.env.SUPPORT_REPLY_TO || ''
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''
        const ticketNumber = (ticket.ticketNumber as string) || `#${ticketId}`
        const subject = (ticket.subject as string) || 'Ticket'
        const inviteUrl = `${baseUrl}/support/tickets/${ticketId}?inviteToken=${invitationToken}`
        const inviterLabel =
          req.user.collection === slugs.users
            ? 'L\'équipe support'
            : `${(req.user as any).firstName || ''} ${(req.user as any).lastName || ''}`.trim() || 'Un collègue'

        const roleLabel = role === 'collaborator' ? 'collaborateur (peut répondre)' : 'lecteur (consultation)'

        await payload.sendEmail({
          to: email,
          ...(replyTo ? { replyTo } : {}),
          subject: `Invitation au ticket ${ticketNumber}`,
          html: emailWrapper(
            `Invitation à un ticket support`,
            [
              emailParagraph(`Bonjour,`),
              emailParagraph(
                `<strong>${escapeHtml(inviterLabel)}</strong> vous invite à consulter le ticket <strong>${escapeHtml(ticketNumber)}</strong> — <em>${escapeHtml(subject)}</em>.`,
              ),
              emailParagraph(`Rôle attribué : <strong>${escapeHtml(roleLabel)}</strong>.`),
              baseUrl ? emailButton('Accéder au ticket', inviteUrl) : '',
              emailParagraph(
                `<span style="font-size: 12px; color: #94a3b8;">Si vous n'avez pas encore de compte support, vous serez invité à définir un mot de passe pour activer votre accès.</span>`,
              ),
            ].join(''),
          ),
        })

        // Best-effort email log
        try {
          await dbCreate(payload, slugs.emailLogs, {
            data: {
              status: 'success',
              action: 'invite',
              senderEmail: (req.user as any).email,
              recipientEmail: email,
              subject: `Invitation ${ticketNumber}`,
              ticketNumber,
            },
            overrideAccess: true,
          })
        } catch {
          // emailLogs not enabled — skip
        }

        return Response.json({ ok: true, invitedTo: email, role })
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[support/invite-collaborator] Error:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
