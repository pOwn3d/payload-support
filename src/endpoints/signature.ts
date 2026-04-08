import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

const PREF_KEY = 'email-signature'

/**
 * GET /api/support/signature — Get current admin's email signature
 */
export function createSignatureGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/signature',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const prefs = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: `${PREF_KEY}-${req.user.id}` } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        const signature = prefs.docs.length > 0
          ? (prefs.docs[0].value as { signature?: string })?.signature || ''
          : ''

        return Response.json({ signature })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[signature] GET error:', error)
        return Response.json({ signature: '' })
      }
    },
  }
}

/**
 * POST /api/support/signature — Save current admin's email signature
 */
export function createSignaturePostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/signature',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const { signature } = (await req.json!()) as { signature: string }
        const key = `${PREF_KEY}-${req.user.id}`

        const existing = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        await payload.db.upsert({
          collection: 'payload-preferences',
          data: {
            key,
            user: { relationTo: req.user!.collection, value: req.user!.id },
            value: { signature: signature || '' },
          },
          req: { payload, user: req.user } as any,
          where: {
            and: [
              { key: { equals: key } },
              { 'user.value': { equals: req.user!.id } },
              { 'user.relationTo': { equals: req.user!.collection } },
            ],
          },
        })

        return Response.json({ signature: signature || '' })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[signature] POST error:', error)
        return Response.json({ error: 'Error saving signature' }, { status: 500 })
      }
    },
  }
}
