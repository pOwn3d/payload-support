import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import {
  SUPPORT_SETTINGS_PREF_KEY as PREF_KEY,
  invalidateSupportSettingsCache,
  mergeSupportSettings,
  readSupportSettingsState,
} from '../utils/readSettings'
import { stripProjectedFeatures } from '../utils/features'

/**
 * Round-robin used to live in its own `support-round-robin` preference row,
 * while the admin UI toggled a `roundRobin` flag in `localStorage` — the two
 * never met, so the toggle had no effect on assignment.
 *
 * Both endpoints below now read and write `settings.features.roundRobin`, the
 * same value `/api/support/settings` exposes and `Tickets`' auto-assign hook
 * reads. The legacy row is still honoured on read until the first save (see
 * `readSupportSettingsState`), so an install that had it enabled keeps it.
 */

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

        const { settings } = await readSupportSettingsState(payload)

        return Response.json({ enabled: settings.features.roundRobin })
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

        const { settings: current } = await readSupportSettingsState(payload)
        const merged = mergeSupportSettings(
          { features: { ...current.features, roundRobin: !!enabled } },
          current,
        )

        await payload.db.upsert({
          collection: 'payload-preferences',
          data: {
            key: PREF_KEY,
            user: { relationTo: req.user!.collection, value: req.user!.id },
            value: {
              ...merged,
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
