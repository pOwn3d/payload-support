import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireClient, handleAuthError } from '../utils/auth'

/**
 * POST /api/support/delete-account
 * RGPD — Right to erasure (Article 17).
 * Allows a support client to request permanent deletion of their account.
 * Uses batch deletes via `where` clauses instead of sequential per-document deletion.
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

        const clientId = req.user.id

        // 1. Find all ticket IDs for this client
        const tickets = await payload.find({
          collection: slugs.tickets as any,
          where: { client: { equals: clientId } },
          limit: 10000,
          depth: 0,
          overrideAccess: true,
          select: { id: true },
        })

        const ticketIds = tickets.docs.map((t) => t.id)

        // 2. Batch delete related data using where clauses
        if (ticketIds.length > 0) {
          await payload.delete({
            collection: slugs.ticketMessages as any,
            where: { ticket: { in: ticketIds } },
            overrideAccess: true,
          })

          await payload.delete({
            collection: slugs.ticketActivityLog as any,
            where: { ticket: { in: ticketIds } },
            overrideAccess: true,
          })

          await payload.delete({
            collection: slugs.timeEntries as any,
            where: { ticket: { in: ticketIds } },
            overrideAccess: true,
          })

          // Delete all tickets
          await payload.delete({
            collection: slugs.tickets as any,
            where: { client: { equals: clientId } },
            overrideAccess: true,
          })
        }

        // 3. Batch delete satisfaction surveys
        await payload.delete({
          collection: slugs.satisfactionSurveys as any,
          where: { client: { equals: clientId } },
          overrideAccess: true,
        })

        // 4. Batch delete chat messages
        await payload.delete({
          collection: slugs.chatMessages as any,
          where: { client: { equals: clientId } },
          overrideAccess: true,
        })

        // 5. Delete the client account
        await payload.delete({
          collection: slugs.supportClients as any,
          id: clientId,
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
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[delete-account] Error:', err)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
