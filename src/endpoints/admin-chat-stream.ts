import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

/**
 * GET /api/support/admin-chat-stream?session=xxx
 * Server-Sent Events endpoint for real-time chat messages (admin-side).
 * Streams new messages + typing indicators for a specific session.
 *
 * Without ?session parameter, streams session list updates (new sessions, status changes).
 */
export function createAdminChatStreamEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/admin-chat-stream',
    method: 'get',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url!)
      const sessionId = url.searchParams.get('session')

      // Session-specific stream: messages for one chat session
      if (sessionId) {
        return createSessionStream(req, slugs, sessionId)
      }

      // Session list stream: updates on all active sessions
      return createSessionListStream(req, slugs)
    },
  }
}

/**
 * Stream messages for a specific chat session (admin view).
 */
function createSessionStream(
  req: any,
  slugs: CollectionSlugs,
  sessionId: string,
): Response {
  let lastCheck = new Date().toISOString()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', session: sessionId })}\n\n`,
        ),
      )

      // Poll DB every 2 seconds for new messages in this session
      const interval = setInterval(async () => {
        try {
          const messages = await req.payload.find({
            collection: slugs.chatMessages as any,
            where: {
              session: { equals: sessionId },
              createdAt: { greater_than: lastCheck },
            },
            sort: 'createdAt',
            limit: 50,
            depth: 1,
            overrideAccess: true,
          })

          if (messages.docs.length > 0) {
            const data = JSON.stringify({
              type: 'messages',
              data: messages.docs,
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            lastCheck = (messages.docs[messages.docs.length - 1] as any).createdAt

            // Check if session was closed
            const lastMsg = messages.docs[messages.docs.length - 1] as any
            if (lastMsg.status === 'closed') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'closed', session: sessionId })}\n\n`,
                ),
              )
            }
          }
        } catch (error) {
          console.warn('[support] admin-chat-stream SSE poll error:', error)
        }
      }, 2000)

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // Stream already closed
        }
      }, 30000)

      req.signal?.addEventListener('abort', () => {
        clearInterval(interval)
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

/**
 * Stream session list updates (admin overview of all chat sessions).
 * Emits a snapshot of active/closed sessions every 5 seconds.
 */
function createSessionListStream(req: any, slugs: CollectionSlugs): Response {
  const encoder = new TextEncoder()
  let lastSessionHash = ''

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', mode: 'sessions' })}\n\n`),
      )

      const interval = setInterval(async () => {
        try {
          const recentMessages = await req.payload.find({
            collection: slugs.chatMessages as any,
            sort: '-createdAt',
            limit: 50,
            depth: 1,
            overrideAccess: true,
          })

          const sessionsMap = new Map<
            string,
            {
              session: string
              client: unknown
              lastMessage: string
              lastMessageAt: string
              senderType: string
              status: string
              messageCount: number
              unreadCount: number
            }
          >()

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

          const sessions = Array.from(sessionsMap.values()).sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
          )

          const active = sessions.filter((s) => s.status === 'active')
          const closed = sessions.filter((s) => s.status === 'closed')

          // Only emit if data changed (simple hash comparison)
          const hash = JSON.stringify({ active: active.length, closed: closed.length, lastMsg: active[0]?.lastMessageAt })
          if (hash !== lastSessionHash) {
            lastSessionHash = hash

            const data = JSON.stringify({
              type: 'sessions',
              data: { active, closed, totalActive: active.length },
            })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        } catch (error) {
          console.warn('[support] admin-chat-stream sessions SSE error:', error)
        }
      }, 5000)

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          // Stream already closed
        }
      }, 30000)

      req.signal?.addEventListener('abort', () => {
        clearInterval(interval)
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
