import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// In-memory typing state (ticketId -> { admin?: timestamp, client?: timestamp })
const typingState = new Map<string, { admin?: number; client?: number; adminName?: string; clientName?: string }>()

const TYPING_TTL = 5000 // 5 seconds

function cleanExpired(ticketId: string) {
  const state = typingState.get(ticketId)
  if (!state) return
  const now = Date.now()
  if (state.admin && now - state.admin > TYPING_TTL) {
    state.admin = undefined
    state.adminName = undefined
  }
  if (state.client && now - state.client > TYPING_TTL) {
    state.client = undefined
    state.clientName = undefined
  }
  if (!state.admin && !state.client) typingState.delete(ticketId)
}

/**
 * POST /api/support/typing — Signal that user is typing
 */
export function createTypingPostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/typing',
    method: 'post',
    handler: async (req) => {
      try {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { ticketId } = (await req.json!()) as { ticketId: number }
        if (!ticketId) {
          return Response.json({ error: 'ticketId required' }, { status: 400 })
        }

        const key = String(ticketId)
        const state = typingState.get(key) || {}

        if (req.user.collection === slugs.users) {
          state.admin = Date.now()
          state.adminName = (req.user as any).firstName || 'Support'
        } else {
          state.client = Date.now()
          state.clientName = (req.user as any).firstName || 'Client'
        }

        typingState.set(key, state)
        return Response.json({ ok: true })
      } catch {
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}

/**
 * GET /api/support/typing?ticketId=123 — Check who is typing
 */
export function createTypingGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/typing',
    method: 'get',
    handler: async (req) => {
      try {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url!)
        const ticketId = url.searchParams.get('ticketId')
        if (!ticketId) {
          return Response.json({ error: 'ticketId required' }, { status: 400 })
        }

        cleanExpired(ticketId)
        const state = typingState.get(ticketId)

        // Admin sees client typing, client sees admin typing
        if (req.user.collection === slugs.users) {
          return Response.json({
            typing: !!state?.client,
            name: state?.clientName || null,
          })
        } else {
          return Response.json({
            typing: !!state?.admin,
            name: state?.adminName || null,
          })
        }
      } catch {
        return Response.json({ typing: false, name: null })
      }
    },
  }
}
