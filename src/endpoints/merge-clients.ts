import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { dbFind, dbFindByID, dbUpdate, dbDelete } from '../utils/db'

/**
 * POST /api/support/merge-clients
 * Merge client B (source) into client A (target). Admin-only.
 */
export function createMergeClientsEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/merge-clients',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const { sourceId, targetId } = await req.json!()

        if (!sourceId || !targetId || sourceId === targetId) {
          return Response.json({ error: 'sourceId and targetId are required and must be different' }, { status: 400 })
        }

        const [source, target] = await Promise.all([
          dbFindByID(payload, slugs.supportClients, { id: sourceId, depth: 0, overrideAccess: true }),
          dbFindByID(payload, slugs.supportClients, { id: targetId, depth: 0, overrideAccess: true }),
        ]) as [any, any]

        if (!source || !target) {
          return Response.json({ error: 'Source or target client not found' }, { status: 404 })
        }

        const results = {
          tickets: 0,
          ticketMessages: 0,
          chatMessages: 0,
          pendingEmails: 0,
          satisfactionSurveys: 0,
        }

        // 1. Transfer tickets
        const tickets = await dbFind(payload, slugs.tickets, {
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const ticket of tickets.docs) {
          await dbUpdate(payload, slugs.tickets, { id: ticket.id, data: { client: targetId }, overrideAccess: true })
          results.tickets++
        }

        // 2. Transfer ticket messages (authorClient)
        const messages = await dbFind(payload, slugs.ticketMessages, {
          where: { authorClient: { equals: sourceId } },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const msg of messages.docs) {
          await dbUpdate(payload, slugs.ticketMessages, { id: msg.id, data: { authorClient: targetId }, overrideAccess: true })
          results.ticketMessages++
        }

        // 3. Transfer chat messages
        const chats = await dbFind(payload, slugs.chatMessages, {
          where: { client: { equals: sourceId } },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const chat of chats.docs) {
          await dbUpdate(payload, slugs.chatMessages, { id: chat.id, data: { client: targetId }, overrideAccess: true })
          results.chatMessages++
        }

        // 4. Transfer pending emails
        const pendingEmails = await dbFind(payload, slugs.pendingEmails, {
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const pe of pendingEmails.docs) {
          await dbUpdate(payload, slugs.pendingEmails, { id: pe.id, data: { client: targetId }, overrideAccess: true })
          results.pendingEmails++
        }

        // 5. Transfer satisfaction surveys
        const surveys = await dbFind(payload, slugs.satisfactionSurveys, {
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const survey of surveys.docs) {
          await dbUpdate(payload, slugs.satisfactionSurveys, { id: survey.id, data: { client: targetId }, overrideAccess: true })
          results.satisfactionSurveys++
        }

        // 6. Delete source client
        await dbDelete(payload, slugs.supportClients, {
          id: sourceId,
          overrideAccess: true,
        })

        const sourceLabel = `${source.firstName} ${source.lastName} (${source.email})`
        const targetLabel = `${target.firstName} ${target.lastName} (${target.email})`

        return Response.json({
          success: true,
          message: `Client "${sourceLabel}" fusionné dans "${targetLabel}"`,
          merged: results,
          deletedClientId: sourceId,
          targetClientId: targetId,
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[merge-clients] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
