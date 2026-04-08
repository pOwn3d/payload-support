import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

const PREF_KEY_PREFIX = 'support-user-prefs'

export interface UserPrefs {
  locale: 'fr' | 'en'
  signature: string
}

const DEFAULT_USER_PREFS: UserPrefs = {
  locale: 'fr',
  signature: '',
}

/**
 * GET /api/support/user-prefs — Read current user's preferences
 */
export function createUserPrefsGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/user-prefs',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const key = `${PREF_KEY_PREFIX}-${req.user!.id}`

        const prefs = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        let userPrefs = { ...DEFAULT_USER_PREFS }
        if (prefs.docs.length > 0) {
          const stored = prefs.docs[0].value as Partial<UserPrefs>
          userPrefs = {
            locale: stored.locale || DEFAULT_USER_PREFS.locale,
            signature: stored.signature ?? DEFAULT_USER_PREFS.signature,
          }
        }

        return Response.json(userPrefs)
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.warn('[support/user-prefs] GET error:', error)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}

/**
 * POST /api/support/user-prefs — Save current user's preferences
 */
export function createUserPrefsPostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/user-prefs',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const body = (await req.json!()) as Partial<UserPrefs>
        const key = `${PREF_KEY_PREFIX}-${req.user!.id}`

        // Read existing prefs to merge
        const existing = await payload.find({
          collection: 'payload-preferences' as any,
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        let current = { ...DEFAULT_USER_PREFS }
        if (existing.docs.length > 0) {
          const stored = existing.docs[0].value as Partial<UserPrefs>
          current = {
            locale: stored.locale || DEFAULT_USER_PREFS.locale,
            signature: stored.signature ?? DEFAULT_USER_PREFS.signature,
          }
        }

        const merged: UserPrefs = {
          locale: body.locale || current.locale,
          signature: body.signature ?? current.signature,
        }

        await payload.db.upsert({
          collection: 'payload-preferences',
          data: {
            key,
            user: { relationTo: req.user!.collection, value: req.user!.id },
            value: merged as unknown as Record<string, unknown>,
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

        return Response.json(merged)
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[support/user-prefs] POST error:', error)
        return Response.json({ error: 'Error saving user preferences' }, { status: 500 })
      }
    },
  }
}
