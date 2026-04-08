import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

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

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

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
      } catch (err) {
        console.error('[signature] GET error:', err)
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

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { signature } = (await req.json!()) as { signature: string }
        const key = `${PREF_KEY}-${req.user.id}`

        const existing = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (existing.docs.length > 0) {
          await payload.update({
            collection: 'payload-preferences' as any,
            id: existing.docs[0].id,
            data: { value: { signature: signature || '' } },
            overrideAccess: true,
          })
        } else {
          await (payload as any).create({
            collection: 'payload-preferences',
            data: {
              key,
              user: { relationTo: slugs.users, value: req.user.id },
              value: { signature: signature || '' },
            },
            overrideAccess: true,
          })
        }

        return Response.json({ signature: signature || '' })
      } catch (err) {
        console.error('[signature] POST error:', err)
        return Response.json({ error: 'Error saving signature' }, { status: 500 })
      }
    },
  }
}
