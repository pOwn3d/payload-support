import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireClient, handleAuthError } from '../utils/auth'

/**
 * GET /api/support/chat-stream?session=xxx
 * Server-Sent Events endpoint for real-time chat messages (client-side).
 * Replaces polling on GET /api/support/chat for connected clients.
 * The existing polling endpoint is kept as fallback.
 */
export function createChatStreamEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/chat-stream',
    method: 'get',
    handler: async (req) => {
      try {
        requireClient(req, slugs)
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url!)
      const sessionId = url.searchParams.get('session')
      const userId = req.user!.id

      if (!sessionId) {
        return Response.json({ error: 'Missing session parameter' }, { status: 400 })
      }

      // Verify session belongs to user
      const existing = await req.payload.find({
        collection: slugs.chatMessages as any,
        where: {
          session: { equals: sessionId },
          client: { equals: userId },
        },
        limit: 1,
        overrideAccess: true,
      })

      if (existing.docs.length === 0) {
        return Response.json({ error: 'Session invalide' }, { status: 403 })
      }

      let lastCheck = new Date().toISOString()
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        start(controller) {
          // Send initial connection event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'connected', session: sessionId })}\n\n`),
          )

          // Poll DB every 2 seconds for new messages
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
              console.warn('[support] chat-stream SSE poll error:', error)
            }
          }, 2000)

          // Heartbeat every 30s to keep connection alive
          const heartbeat = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`))
            } catch {
              // Stream already closed
            }
          }, 30000)

          // Cleanup on client disconnect
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
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
      })
    },
  }
}
