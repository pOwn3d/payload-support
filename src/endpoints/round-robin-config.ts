import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

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

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

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
      } catch {
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

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { enabled } = (await req.json!()) as { enabled: boolean }

        const existing = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: PREF_KEY } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.docs.length > 0) {
          await payload.update({
            collection: 'payload-preferences' as any,
            id: existing.docs[0].id,
            data: { value: { enabled: !!enabled } },
            overrideAccess: true,
          })
        } else {
          await (payload as any).create({
            collection: 'payload-preferences',
            data: {
              key: PREF_KEY,
              user: req.user.id,
              value: { enabled: !!enabled },
            },
            overrideAccess: true,
          })
        }

        return Response.json({ enabled: !!enabled })
      } catch (err) {
        console.error('[round-robin-config] Error:', err)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}
