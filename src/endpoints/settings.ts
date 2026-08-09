import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import {
  SUPPORT_SETTINGS_PREF_KEY as PREF_KEY,
  invalidateSupportSettingsCache,
  mergeSupportSettings,
  readSupportSettingsState,
  type SupportSettings,
} from '../utils/readSettings'
import { stripProjectedFeatures } from '../utils/features'

/**
 * GET /api/support/settings — Read support settings
 *
 * `featuresConfigured` tells the admin UI whether the server has ever had
 * feature flags saved; a client still holding pre-2.1 `localStorage` flags uses
 * it to seed the server once instead of losing its configuration.
 */
export function createSettingsGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/settings',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const { settings, featuresConfigured } = await readSupportSettingsState(payload)

        return Response.json({ ...settings, featuresConfigured })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.warn('[support/settings] GET error:', error)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}

/**
 * POST /api/support/settings — Save support settings (admin-only)
 *
 * The body is merged onto the CURRENT settings, not onto the defaults: the
 * feature-flag screen posts `{ features }` alone, and that must not reset the
 * email / AI / SLA blocks.
 */
export function createSettingsPostEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/settings',
    method: 'post',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const body = (await req.json!()) as Partial<SupportSettings>

        const { settings: current } = await readSupportSettingsState(payload)
        const merged = mergeSupportSettings(body, current)

        await payload.db.upsert({
          collection: 'payload-preferences',
          data: {
            key: PREF_KEY,
            user: { relationTo: req.user!.collection, value: req.user!.id },
            value: {
              ...merged,
              // Persist the flags without the two projected ones, so `features`
              // and the `autoClose` block can never drift apart.
              features: stripProjectedFeatures(merged.features),
            } as unknown as Record<string, unknown>,
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

        invalidateSupportSettingsCache()

        return Response.json({ ...merged, featuresConfigured: true })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[support/settings] Error saving settings:', error)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}
