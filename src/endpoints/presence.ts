import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

// In-memory presence state: ticketId -> Map<userId, { name, email, timestamp }>
const presenceState = new Map<string, Map<string | number, { name: string; email: string; ts: number }>>()

const PRESENCE_TTL = 30_000 // 30 seconds

function cleanExpired(ticketId: string) {
  const viewers = presenceState.get(ticketId)
  if (!viewers) return
  const now = Date.now()
  for (const [userId, entry] of viewers) {
    if (now - entry.ts > PRESENCE_TTL) {
      viewers.delete(userId)
    }
  }
  if (viewers.size === 0) presenceState.delete(ticketId)
}

/**
 * POST /api/support/presence — Register or remove presence on a ticket
 */
export function createPresencePostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/presence',
    method: 'post',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)

        const { ticketId, action } = (await req.json!()) as { ticketId: number; action: 'join' | 'leave' }
        if (!ticketId || !action) {
          return Response.json({ error: 'ticketId and action required' }, { status: 400 })
        }

        const key = String(ticketId)

        if (action === 'join') {
          if (!presenceState.has(key)) {
            presenceState.set(key, new Map())
          }
          presenceState.get(key)!.set(req.user.id, {
            name: (req.user as any).firstName || req.user.email || 'Admin',
            email: req.user.email || '',
            ts: Date.now(),
          })
        } else if (action === 'leave') {
          presenceState.get(key)?.delete(req.user.id)
          if (presenceState.get(key)?.size === 0) presenceState.delete(key)
        }

        return Response.json({ ok: true })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.warn('[presence] POST error:', error)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}

/**
 * GET /api/support/presence?ticketId=123 — Get list of admins viewing this ticket
 */
export function createPresenceGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/presence',
    method: 'get',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)

        const url = new URL(req.url!)
        const ticketId = url.searchParams.get('ticketId')
        if (!ticketId) {
          return Response.json({ error: 'ticketId required' }, { status: 400 })
        }

        cleanExpired(ticketId)
        const viewers = presenceState.get(ticketId)

        if (!viewers || viewers.size === 0) {
          return Response.json({ viewers: [] })
        }

        const result: { name: string; email: string }[] = []
        for (const [userId, entry] of viewers) {
          if (userId !== req.user.id) {
            result.push({ name: entry.name, email: entry.email })
          }
        }

        return Response.json({ viewers: result })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        return Response.json({ viewers: [] })
      }
    },
  }
}
