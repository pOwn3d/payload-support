import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * POST /api/support/delete-account
 * RGPD — Right to erasure (Article 17).
 * Allows a support client to request permanent deletion of their account.
 */
export function createDeleteAccountEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/delete-account',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || req.user.collection !== slugs.supportClients) {
          return Response.json({ error: 'Non autorisé' }, { status: 401 })
        }

        const body = await req.json!()
        const { confirmPassword } = body

        if (!confirmPassword) {
          return Response.json(
            { error: 'Mot de passe requis pour confirmer la suppression.' },
            { status: 400 },
          )
        }

        // Verify password
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

        // 1. Find all tickets
        const tickets = await payload.find({
          collection: slugs.tickets as any,
          where: { client: { equals: req.user.id } },
          limit: 10000,
          depth: 0,
          overrideAccess: true,
        })

        const ticketIds = tickets.docs.map((t) => t.id)

        // 2. Delete ticket messages
        if (ticketIds.length > 0) {
          const messages = await payload.find({
            collection: slugs.ticketMessages as any,
            where: { ticket: { in: ticketIds } },
            limit: 50000,
            depth: 0,
            overrideAccess: true,
          })
          for (const msg of messages.docs) {
            await payload.delete({ collection: slugs.ticketMessages as any, id: msg.id, overrideAccess: true })
          }

          // 3. Delete activity logs
          const logs = await payload.find({
            collection: slugs.ticketActivityLog as any,
            where: { ticket: { in: ticketIds } },
            limit: 50000,
            depth: 0,
            overrideAccess: true,
          })
          for (const log of logs.docs) {
            await payload.delete({ collection: slugs.ticketActivityLog as any, id: log.id, overrideAccess: true })
          }

          // 4. Delete time entries
          const timeEntries = await payload.find({
            collection: slugs.timeEntries as any,
            where: { ticket: { in: ticketIds } },
            limit: 50000,
            depth: 0,
            overrideAccess: true,
          })
          for (const entry of timeEntries.docs) {
            await payload.delete({ collection: slugs.timeEntries as any, id: entry.id, overrideAccess: true })
          }

          // 5. Delete satisfaction surveys
          const surveys = await payload.find({
            collection: slugs.satisfactionSurveys as any,
            where: { client: { equals: req.user.id } },
            limit: 10000,
            depth: 0,
            overrideAccess: true,
          })
          for (const survey of surveys.docs) {
            await payload.delete({ collection: slugs.satisfactionSurveys as any, id: survey.id, overrideAccess: true })
          }

          // 6. Delete all tickets
          for (const ticketId of ticketIds) {
            await payload.delete({ collection: slugs.tickets as any, id: ticketId, overrideAccess: true })
          }
        }

        // 7. Delete chat messages
        const chatMessages = await payload.find({
          collection: slugs.chatMessages as any,
          where: { client: { equals: req.user.id } },
          limit: 50000,
          depth: 0,
          overrideAccess: true,
        })
        for (const msg of chatMessages.docs) {
          await payload.delete({ collection: slugs.chatMessages as any, id: msg.id, overrideAccess: true })
        }

        // 8. Delete the client account
        await payload.delete({
          collection: slugs.supportClients as any,
          id: req.user.id,
          overrideAccess: true,
        })

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
        console.error('[delete-account] Error:', err)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
