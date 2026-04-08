import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

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

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { sourceId, targetId } = await req.json!()

        if (!sourceId || !targetId || sourceId === targetId) {
          return Response.json({ error: 'sourceId and targetId are required and must be different' }, { status: 400 })
        }

        const [source, target] = await Promise.all([
          payload.findByID({ collection: slugs.supportClients as any, id: sourceId, depth: 0, overrideAccess: true }),
          payload.findByID({ collection: slugs.supportClients as any, id: targetId, depth: 0, overrideAccess: true }),
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
        const tickets = await payload.find({
          collection: slugs.tickets as any,
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const ticket of tickets.docs) {
          await payload.update({ collection: slugs.tickets as any, id: ticket.id, data: { client: targetId }, overrideAccess: true })
          results.tickets++
        }

        // 2. Transfer ticket messages (authorClient)
        const messages = await payload.find({
          collection: slugs.ticketMessages as any,
          where: { authorClient: { equals: sourceId } },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const msg of messages.docs) {
          await payload.update({ collection: slugs.ticketMessages as any, id: msg.id, data: { authorClient: targetId }, overrideAccess: true })
          results.ticketMessages++
        }

        // 3. Transfer chat messages
        const chats = await payload.find({
          collection: slugs.chatMessages as any,
          where: { client: { equals: sourceId } },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const chat of chats.docs) {
          await payload.update({ collection: slugs.chatMessages as any, id: chat.id, data: { client: targetId }, overrideAccess: true })
          results.chatMessages++
        }

        // 4. Transfer pending emails
        const pendingEmails = await payload.find({
          collection: slugs.pendingEmails as any,
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const pe of pendingEmails.docs) {
          await payload.update({ collection: slugs.pendingEmails as any, id: pe.id, data: { client: targetId }, overrideAccess: true })
          results.pendingEmails++
        }

        // 5. Transfer satisfaction surveys
        const surveys = await payload.find({
          collection: slugs.satisfactionSurveys as any,
          where: { client: { equals: sourceId } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const survey of surveys.docs) {
          await payload.update({ collection: slugs.satisfactionSurveys as any, id: survey.id, data: { client: targetId }, overrideAccess: true })
          results.satisfactionSurveys++
        }

        // 6. Delete source client
        await payload.delete({
          collection: slugs.supportClients as any,
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
        console.error('[merge-clients] Error:', error)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
