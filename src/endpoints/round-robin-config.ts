import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

const PREF_KEY = 'support-round-robin'

/**
 * GET /api/support/round-robin-config — Get round-robin enabled status
 */
export function createRoundRobinConfigGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/round-robin-config',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const prefs = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: PREF_KEY } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        const enabled = prefs.docs.length > 0
          ? (prefs.docs[0].value as { enabled?: boolean })?.enabled === true
          : false

        return Response.json({ enabled })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.warn('[round-robin-config] GET error:', error)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}

/**
 * POST /api/support/round-robin-config — Enable/disable round-robin
 */
export function createRoundRobinConfigPostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/round-robin-config',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const { enabled } = (await req.json!()) as { enabled: boolean }

        const existing = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: PREF_KEY } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        await payload.db.upsert({
          collection: 'payload-preferences',
          data: {
            key: PREF_KEY,
            user: { relationTo: req.user!.collection, value: req.user!.id },
            value: { enabled: !!enabled },
          },
          req: { payload, user: req.user } as any,
          where: {
            and: [
              { key: { equals: PREF_KEY } },
              { 'user.value': { equals: req.user!.id } },
              { 'user.relationTo': { equals: req.user!.collection } },
            ],
          },
        })

        return Response.json({ enabled: !!enabled })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[round-robin-config] POST error:', error)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}
