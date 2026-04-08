import type { Endpoint } from 'payload'
import type { Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import crypto from 'crypto'

// Simple in-memory rate limiters
const rateLimitStores = new Map<string, Map<string, { count: number; resetAt: number }>>()

function isLimited(storeName: string, key: string, maxRequests: number, windowMs: number): boolean {
  if (!rateLimitStores.has(storeName)) rateLimitStores.set(storeName, new Map())
  const store = rateLimitStores.get(storeName)!
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > maxRequests
}

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

        const body = await req.json!()
        const { action, session, message } = body
        const userId = String(req.user.id)

        // Start a new session
        if (action === 'start') {
          if (isLimited('chat-session', userId, 5, 3_600_000)) {
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
          if (isLimited('chat-message', userId, 15, 60_000)) {
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
