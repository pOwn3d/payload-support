import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { runAiAgent } from '../utils/aiAgent'
import { RateLimiter, type RateLimitStore } from '../utils/rateLimiter'

/**
 * POST /api/support/ai-agent   body: { ticketId, confidenceThreshold? }
 *
 * Runs the autonomous AI agent on a ticket: it either posts a KB-grounded answer
 * (when confident) or escalates to a human with an internal note. Admin-only.
 */
export function createAiAgentEndpoint(slugs: CollectionSlugs, store?: RateLimitStore): Endpoint {
  const limiter = new RateLimiter(60_000, 10, store)
  return {
    path: '/support/ai-agent',
    method: 'post',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)
        if (await limiter.check(String(req.user!.id), req)) {
          return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
        }
        let body: { ticketId?: number | string; confidenceThreshold?: number } = {}
        try { body = (await req.json!()) as typeof body } catch { /* no body */ }
        if (!body.ticketId) {
          return Response.json({ error: 'ticketId requis.' }, { status: 400 })
        }
        const result = await runAiAgent(req.payload, slugs, body.ticketId, {
          confidenceThreshold: body.confidenceThreshold,
        })
        return Response.json({ ok: true, ...result })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[ai-agent] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
