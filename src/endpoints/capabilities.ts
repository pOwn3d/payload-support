import type { Endpoint, Where } from 'payload'
import type { SupportCapabilities } from '../types'
import type { CollectionSlugs } from '../utils/slugs'
import { RateLimiter, type RateLimitStore } from '../utils/rateLimiter'
import {
  validateInboundEmailPayload,
  verifySecret,
  type InboundEmailInput,
} from '../utils/webhookSecurity'

export function createInboundEmailEndpoint(
  capability: NonNullable<SupportCapabilities['inboundEmail']>,
  store?: RateLimitStore,
): Endpoint {
  const limiter = new RateLimiter(60_000, 60, store)
  return {
    path: '/support-webhook/inbound-email',
    method: 'post',
    handler: async (req) => {
      const secretHeader = capability.secretHeader || 'x-webhook-secret'
      if (!verifySecret(req.headers.get(secretHeader), capability.secret)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'unknown'
      if (await limiter.check(ip, req)) {
        return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }

      const declaredLength = Number(req.headers.get('content-length') || 0) || undefined
      let input: Record<string, unknown>
      try {
        input = await req.json!() as Record<string, unknown>
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const measuredLength = new TextEncoder().encode(JSON.stringify(input)).byteLength
      const validation = validateInboundEmailPayload(
        input as InboundEmailInput,
        Math.max(declaredLength || 0, measuredLength),
      )
      if (validation) return Response.json({ error: validation.code }, { status: validation.status })
      return capability.handle(req, input as InboundEmailInput)
    },
  }
}

export function createProjectSuggestionsEndpoint(
  slugs: CollectionSlugs,
  capability: NonNullable<SupportCapabilities['projectSuggestions']>,
  store?: RateLimitStore,
): Endpoint {
  const limiter = new RateLimiter(60_000, 20, store)
  return {
    path: '/support/suggest-projects',
    method: 'post',
    handler: async (req) => {
      if (!req.user || req.user.collection !== slugs.users) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const key = req.user?.id ? String(req.user.id) : 'anonymous'
      if (await limiter.check(key, req)) {
        return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      return capability.suggest(req)
    },
  }
}

export function createTicketTitleEndpoint(
  slugs: CollectionSlugs,
  capability: NonNullable<SupportCapabilities['aiTitles']>,
  store?: RateLimitStore,
): Endpoint {
  const limiter = new RateLimiter(60_000, 20, store)
  return {
    path: '/support/ticket-title',
    method: 'post',
    handler: async (req) => {
      if (!req.user || req.user.collection !== slugs.users) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (await limiter.check(String(req.user.id), req)) {
        return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      const ticketId = Number(new URL(req.url || '', 'http://localhost').searchParams.get('ticketId'))
      if (!Number.isFinite(ticketId) || ticketId <= 0) {
        return Response.json({ error: 'ticketId required' }, { status: 400 })
      }
      const title = await capability.generate(req.payload, ticketId)
      if (!title) return Response.json({ error: 'Generation unavailable' }, { status: 502 })
      return Response.json({ title, status: 'suggested' })
    },
  }
}

export function createGenerateMissingTitlesEndpoint(
  slugs: CollectionSlugs,
  capability: NonNullable<SupportCapabilities['aiTitles']>,
  store?: RateLimitStore,
): Endpoint {
  const limiter = new RateLimiter(60_000, 5, store)
  return {
    path: '/support/generate-missing-titles',
    method: 'post',
    handler: async (req) => {
      if (!req.user || req.user.collection !== slugs.users) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (await limiter.check(String(req.user.id), req)) {
        return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      const limit = Math.min(
        Math.max(Number(new URL(req.url || '', 'http://localhost').searchParams.get('limit')) || 8, 1),
        20,
      )
      const where: Where = {
        and: [
          { displayTitle: { exists: false } },
          { displayTitleStatus: { not_equals: 'error' } },
        ],
      }
      const batch = await req.payload.find({
        collection: slugs.tickets,
        where,
        limit,
        depth: 0,
        overrideAccess: true,
        sort: '-createdAt',
      })
      let generated = 0
      for (const ticket of batch.docs) {
        if (await capability.generate(req.payload, ticket.id)) generated++
      }
      const remaining = await req.payload.count({
        collection: slugs.tickets,
        where,
        overrideAccess: true,
      })
      return Response.json({ generated, remaining: remaining.totalDocs })
    },
  }
}
