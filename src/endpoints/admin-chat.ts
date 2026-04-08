import type { Endpoint } from 'payload'
import type { Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { RateLimiter } from '../utils/rateLimiter'
import { requireAdmin, handleAuthError } from '../utils/auth'

const adminChatLimiter = new RateLimiter(60_000, 30) // 30 per minute

/**
 * GET /api/support/admin-chat?session=xxx&after=timestamp
 * GET /api/support/admin-chat (no session = list active sessions)
 */
export function createAdminChatGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/admin-chat',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const url = new URL(req.url!)
        const session = url.searchParams.get('session')
        const after = url.searchParams.get('after')

        if (session) {
          const where: Where = { session: { equals: session } }
          if (after) where.createdAt = { greater_than: after }

          const messages = await payload.find({
            collection: slugs.chatMessages as any,
            where,
            sort: 'createdAt',
            limit: 200,
            depth: 1,
            overrideAccess: true,
          })

          return new Response(JSON.stringify({ messages: messages.docs, session }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
            },
          })
        }

        // List recent sessions: fetch only recent messages, limit to 50
        const recentMessages = await payload.find({
          collection: slugs.chatMessages as any,
          sort: '-createdAt',
          limit: 50,
          depth: 1,
          overrideAccess: true,
        })

        const sessionsMap = new Map<string, {
          session: string
          client: unknown
          lastMessage: string
          lastMessageAt: string
          senderType: string
          status: string
          messageCount: number
          unreadCount: number
        }>()

        for (const msg of recentMessages.docs) {
          const m = msg as any
          const sid = m.session
          if (!sessionsMap.has(sid)) {
            sessionsMap.set(sid, {
              session: sid,
              client: m.client,
              lastMessage: m.message,
              lastMessageAt: m.createdAt,
              senderType: m.senderType,
              status: m.status || 'active',
              messageCount: 0,
              unreadCount: 0,
            })
          }
          const s = sessionsMap.get(sid)!
          s.messageCount++
          if (m.senderType === 'client') s.unreadCount++
          else if (m.senderType === 'agent') s.unreadCount = 0
        }

        const sessions = Array.from(sessionsMap.values())
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

        const activeSessions = sessions.filter((s) => s.status === 'active')
        const closedSessions = sessions.filter((s) => s.status === 'closed')

        return new Response(JSON.stringify({ active: activeSessions, closed: closedSessions, totalActive: activeSessions.length }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          },
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[admin-chat] GET Error:', error)
        return Response.json({ error: 'Erreur interne du serveur' }, { status: 500 })
      }
    },
  }
}

/**
 * POST /api/support/admin-chat
 * Admin sends a message or closes a session.
 */
export function createAdminChatPostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/admin-chat',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        let body: { action?: string; session?: string; message?: string }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { action, session, message } = body

        if (!session) {
          return Response.json({ error: 'Session requise' }, { status: 400 })
        }

        const sessionMsg = await payload.find({
          collection: slugs.chatMessages as any,
          where: { session: { equals: session } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (sessionMsg.docs.length === 0) {
          return Response.json({ error: 'Session introuvable' }, { status: 404 })
        }

        const clientId = typeof (sessionMsg.docs[0] as any).client === 'object'
          ? (sessionMsg.docs[0] as any).client.id
          : (sessionMsg.docs[0] as any).client

        // Agent sends a message
        if (action === 'send' && message) {
          if (adminChatLimiter.check(String(req.user.id))) {
            return Response.json({ error: 'Rate limit atteint.' }, { status: 429 })
          }

          const trimmedMessage = String(message).trim()
          if (!trimmedMessage || trimmedMessage.length > 2000) {
            return Response.json({ error: 'Message invalide (1-2000 caractères).' }, { status: 400 })
          }

          const newMsg = await payload.create({
            collection: slugs.chatMessages as any,
            data: {
              session,
              client: clientId,
              senderType: 'agent',
              agent: req.user.id,
              message: trimmedMessage,
              status: 'active',
            },
            overrideAccess: true,
          })

          // Try to link to ticket
          try {
            const linkedTicket = await payload.find({
              collection: slugs.tickets as any,
              where: { chatSession: { equals: session } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            if (linkedTicket.docs.length > 0) {
              const ticketId = linkedTicket.docs[0].id
              await payload.create({
                collection: slugs.ticketMessages as any,
                data: {
                  ticket: ticketId,
                  body: trimmedMessage,
                  authorType: 'admin',
                  skipNotification: true,
                },
                overrideAccess: true,
              })
              await payload.update({
                collection: slugs.chatMessages as any,
                id: newMsg.id,
                data: { ticket: ticketId },
                overrideAccess: true,
              })
            }
          } catch (err) {
            console.error('[admin-chat] Failed to link message to ticket:', err)
          }

          return Response.json({ message: newMsg })
        }

        // Admin closes session
        if (action === 'close') {
          await payload.create({
            collection: slugs.chatMessages as any,
            data: {
              session,
              client: clientId,
              senderType: 'system',
              message: 'Chat terminé par un agent.',
              status: 'closed',
            },
            overrideAccess: true,
          })

          try {
            const linkedTicket = await payload.find({
              collection: slugs.tickets as any,
              where: { chatSession: { equals: session } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            if (linkedTicket.docs.length > 0) {
              await payload.create({
                collection: slugs.ticketMessages as any,
                data: {
                  ticket: linkedTicket.docs[0].id,
                  body: 'Session de chat terminée par un agent.',
                  authorType: 'admin',
                  isInternal: true,
                  skipNotification: true,
                },
                overrideAccess: true,
              })
            }
          } catch (err) {
            console.error('[admin-chat] Failed to update ticket on close:', err)
          }

          return Response.json({ closed: true })
        }

        return Response.json({ error: 'Action invalide' }, { status: 400 })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[admin-chat] POST Error:', error)
        return Response.json({ error: 'Erreur interne du serveur' }, { status: 500 })
      }
    },
  }
}
