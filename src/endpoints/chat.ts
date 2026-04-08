import type { Endpoint } from 'payload'
import type { Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import crypto from 'crypto'
import { RateLimiter } from '../utils/rateLimiter'

const chatSessionLimiter = new RateLimiter(3_600_000, 5) // 5 sessions per hour
const chatMessageLimiter = new RateLimiter(60_000, 15) // 15 messages per minute

/**
 * GET /api/support/chat?session=xxx&after=timestamp
 * Fetch chat messages for a session (polling). Client-only.
 */
export function createChatGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/chat',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || !('company' in req.user)) {
          return Response.json({ error: 'Non autorisé' }, { status: 401 })
        }

        const url = new URL(req.url!)
        const session = url.searchParams.get('session')
        const after = url.searchParams.get('after')

        if (!session) {
          return Response.json({ error: 'Session requise' }, { status: 400 })
        }

        const where: Where = {
          session: { equals: session },
          client: { equals: req.user.id },
        }

        if (after) {
          where.createdAt = { greater_than: after }
        }

        const messages = await payload.find({
          collection: slugs.chatMessages as any,
          where,
          sort: 'createdAt',
          limit: 100,
          depth: 1,
          overrideAccess: true,
        })

        return new Response(JSON.stringify({ messages: messages.docs, session }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          },
        })
      } catch (error) {
        console.error('[support/chat] GET Error:', error)
        return Response.json({ error: 'Erreur interne du serveur' }, { status: 500 })
      }
    },
  }
}

/**
 * POST /api/support/chat
 * Send a message or start a new chat session. Client-only.
 */
export function createChatPostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/chat',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || !('company' in req.user)) {
          return Response.json({ error: 'Non autorisé' }, { status: 401 })
        }

        let body: { action?: string; session?: string; message?: string }
        try {
          body = await req.json!()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const { action, session, message } = body
        const userId = String(req.user.id)

        // Start a new session
        if (action === 'start') {
          if (chatSessionLimiter.check(userId)) {
            return Response.json({ error: 'Trop de sessions créées. Réessayez plus tard.' }, { status: 429 })
          }

          const sessionId = `chat_${crypto.randomBytes(16).toString('hex')}`

          const systemMsg = await payload.create({
            collection: slugs.chatMessages as any,
            data: {
              session: sessionId,
              client: req.user.id,
              senderType: 'system',
              message: 'Chat démarré. Un agent vous répondra sous peu.',
              status: 'active',
            },
            overrideAccess: true,
          })

          return Response.json({ session: sessionId, messages: [systemMsg] })
        }

        // Send a message
        if (action === 'send' && session && message) {
          if (chatMessageLimiter.check(userId)) {
            return Response.json({ error: 'Trop de messages. Attendez un moment.' }, { status: 429 })
          }

          const trimmedMessage = String(message).trim()
          if (!trimmedMessage || trimmedMessage.length > 2000) {
            return Response.json({ error: 'Message invalide (1-2000 caractères).' }, { status: 400 })
          }

          // Verify session belongs to user
          const existing = await payload.find({
            collection: slugs.chatMessages as any,
            where: { session: { equals: session }, client: { equals: req.user.id } },
            limit: 1,
            overrideAccess: true,
          })

          if (existing.docs.length === 0) {
            return Response.json({ error: 'Session invalide' }, { status: 403 })
          }

          const newMsg = await payload.create({
            collection: slugs.chatMessages as any,
            data: {
              session,
              client: req.user.id,
              senderType: 'client',
              message: trimmedMessage,
              status: 'active',
            },
            overrideAccess: true,
          })

          return Response.json({ message: newMsg })
        }

        // Close session
        if (action === 'close' && session) {
          const existing = await payload.find({
            collection: slugs.chatMessages as any,
            where: { session: { equals: session }, client: { equals: req.user.id } },
            limit: 1,
            overrideAccess: true,
          })

          if (existing.docs.length === 0) {
            return Response.json({ error: 'Session invalide' }, { status: 403 })
          }

          await payload.create({
            collection: slugs.chatMessages as any,
            data: {
              session,
              client: req.user.id,
              senderType: 'system',
              message: 'Chat terminé par le client.',
              status: 'closed',
            },
            overrideAccess: true,
          })

          return Response.json({ closed: true })
        }

        return Response.json({ error: 'Action invalide' }, { status: 400 })
      } catch (error) {
        console.error('[support/chat] POST Error:', error)
        return Response.json({ error: 'Erreur interne du serveur' }, { status: 500 })
      }
    },
  }
}
