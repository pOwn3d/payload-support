import type { Endpoint } from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { FIXED_SLUGS } from '../utils/slugs'
import { requireClient, handleAuthError } from '../utils/auth'
import { dbFind, dbDelete } from '../utils/db'

interface AttachmentRow {
  file?: number | string | { id?: number | string } | null
}

/** Collect the media ids referenced by an `attachments` array field. */
function collectAttachmentIds(
  docs: Array<{ attachments?: AttachmentRow[] | null }>,
  into: Set<number | string>,
): void {
  for (const doc of docs) {
    for (const attachment of doc.attachments ?? []) {
      const file = attachment?.file
      const id = file != null && typeof file === 'object' ? file.id : file
      if (id != null) into.add(id)
    }
  }
}

/**
 * POST /api/support/delete-account
 * RGPD — Right to erasure (Article 17).
 *
 * Erases every row the plugin holds about the caller, and the uploaded files
 * those rows point at. The whole sequence runs inside a single Payload
 * transaction: a failure halfway through must not leave a half-deleted
 * account, which would be worse than not deleting at all — the person would
 * believe their data is gone while some of it is still readable.
 */
export function createDeleteAccountEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/delete-account',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireClient(req, slugs)

        const body = await req.json!()
        const { confirmPassword } = body

        if (!confirmPassword) {
          return Response.json(
            { error: 'Mot de passe requis pour confirmer la suppression.' },
            { status: 400 },
          )
        }

        // Verify password. Deliberately outside the transaction: it is a read,
        // and `payload.login` writes nothing we would want to roll back.
        try {
          await payload.login({
            collection: slugs.supportClients as any,
            data: { email: req.user.email!, password: confirmPassword },
          })
        } catch {
          return Response.json(
            { error: 'Mot de passe incorrect.' },
            { status: 403 },
          )
        }

        const clientId = req.user.id
        const clientEmail = req.user.email

        // Several of the collections below only exist when the matching
        // feature flag is on (chat, pendingEmails, ai, timeTracking,
        // authLogs, emailTracking). Addressing one that was never registered
        // throws, and inside a transaction that would roll the whole erasure
        // back — so an install with chat disabled could never delete an
        // account at all.
        const isRegistered = (slug: string): boolean =>
          Boolean((payload.collections as Record<string, unknown> | undefined)?.[slug])

        // No-op on adapters that do not expose `beginTransaction` — the SQLite
        // adapter only does when the host passes `transactionOptions`. The
        // sequence then runs unwrapped, exactly as it did before.
        const startedTransaction = await initTransaction(req)

        try {
          // 1. Tickets owned by the client.
          const tickets = await dbFind(payload, slugs.tickets, {
            where: { client: { equals: clientId } },
            limit: 10000,
            depth: 0,
            overrideAccess: true,
            select: { id: true },
            req,
          })

          const ticketIds = tickets.docs.map((t) => t.id)

          // 2. Uploaded files. They live in the HOST's media collection, so
          // their ids have to be gathered before the rows that reference them
          // are gone.
          const attachmentIds = new Set<number | string>()

          if (ticketIds.length > 0) {
            const messages = await dbFind<{ attachments?: AttachmentRow[] | null }>(
              payload,
              slugs.ticketMessages,
              {
                where: { ticket: { in: ticketIds } },
                limit: 10000,
                depth: 0,
                overrideAccess: true,
                req,
              },
            )
            collectAttachmentIds(messages.docs, attachmentIds)
          }

          if (isRegistered(slugs.pendingEmails)) {
            const pendingEmails = await dbFind<{ attachments?: AttachmentRow[] | null }>(
              payload,
              slugs.pendingEmails,
              {
                where: { client: { equals: clientId } },
                limit: 10000,
                depth: 0,
                overrideAccess: true,
                req,
              },
            )
            collectAttachmentIds(pendingEmails.docs, attachmentIds)
          }

          // 3. Rows that point at one of those tickets. They must go BEFORE
          // the tickets themselves: their `ticket` relationship is required,
          // so the FK would fail on the ticket delete — and Payload's
          // delete-many collects per-document errors instead of throwing, so
          // the failure would be silent and the account would survive.
          if (ticketIds.length > 0) {
            for (const slug of [FIXED_SLUGS.ticketFeedback, FIXED_SLUGS.ticketCollaborators]) {
              if (!isRegistered(slug)) continue
              await dbDelete(payload, slug, {
                where: {
                  or: [
                    { ticket: { in: ticketIds } },
                    { client: { equals: clientId } },
                  ],
                },
                overrideAccess: true,
                req,
              })
            }
          }

          // 4. The tickets. Their own beforeDelete cascade takes the messages,
          // the activity log, the time entries and the surveys with them.
          if (ticketIds.length > 0) {
            await dbDelete(payload, slugs.tickets, {
              where: { client: { equals: clientId } },
              overrideAccess: true,
              req,
            })
          }

          // 5. Rows keyed on the client id, whatever ticket they belong to.
          for (const slug of [
            slugs.satisfactionSurveys,
            slugs.chatMessages,
            slugs.notificationQueue,
            slugs.pendingEmails,
            FIXED_SLUGS.clientSummaries,
            FIXED_SLUGS.ticketFeedback,
          ]) {
            if (!isRegistered(slug)) continue
            await dbDelete(payload, slug, {
              where: { client: { equals: clientId } },
              overrideAccess: true,
              req,
            })
          }

          // Collaborator invitations can predate the account they point at, so
          // they are also matched on the address alone.
          if (isRegistered(FIXED_SLUGS.ticketCollaborators)) {
            await dbDelete(payload, FIXED_SLUGS.ticketCollaborators, {
              where: {
                or: [
                  { client: { equals: clientId } },
                  ...(clientEmail ? [{ email: { equals: clientEmail } }] : []),
                ],
              },
              overrideAccess: true,
              req,
            })
          }

          // 6. Journals, keyed on the address only.
          if (clientEmail) {
            if (isRegistered(slugs.authLogs)) {
              await dbDelete(payload, slugs.authLogs, {
                where: { email: { equals: clientEmail } },
                overrideAccess: true,
                req,
              })
            }

            if (isRegistered(slugs.emailLogs)) {
              await dbDelete(payload, slugs.emailLogs, {
                where: {
                  or: [
                    { senderEmail: { equals: clientEmail } },
                    { recipientEmail: { equals: clientEmail } },
                  ],
                },
                overrideAccess: true,
                req,
              })
            }
          }

          // 7. The uploaded files themselves.
          for (const id of isRegistered(slugs.media) ? attachmentIds : []) {
            await dbDelete(payload, slugs.media, {
              id,
              overrideAccess: true,
              req,
            })
          }

          // 8. The account.
          await dbDelete(payload, slugs.supportClients, {
            id: clientId,
            overrideAccess: true,
            req,
          })

          if (startedTransaction) await commitTransaction(req)
        } catch (err) {
          if (startedTransaction) await killTransaction(req)
          throw err
        }

        const headers = new Headers({ 'Content-Type': 'application/json' })
        const secure = process.env.NODE_ENV === 'production'
        headers.append(
          'Set-Cookie',
          `payload-token=; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`,
        )

        return new Response(
          JSON.stringify({
            deleted: true,
            message: 'Votre compte et toutes vos données ont été supprimés définitivement.',
          }),
          { status: 200, headers },
        )
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[delete-account] Error:', err)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
