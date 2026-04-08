import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

const PREF_KEY = 'support-settings'

interface SupportSettings {
  email: {
    fromAddress: string
    fromName: string
    replyToAddress: string
  }
  ai: {
    provider: 'anthropic' | 'openai' | 'gemini' | 'ollama'
    model: string
    enableSentiment: boolean
    enableSynthesis: boolean
    enableSuggestion: boolean
    enableRewrite: boolean
  }
  sla: {
    firstResponseMinutes: number
    resolutionMinutes: number
    businessHoursOnly: boolean
    escalationEmail: string
  }
  autoClose: {
    enabled: boolean
    daysBeforeClose: number
    reminderDaysBefore: number
  }
  locale: {
    language: 'fr' | 'en'
  }
}

const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  email: { fromAddress: '', fromName: 'Support', replyToAddress: '' },
  ai: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    enableSentiment: true,
    enableSynthesis: true,
    enableSuggestion: true,
    enableRewrite: true,
  },
  sla: {
    firstResponseMinutes: 120,
    resolutionMinutes: 1440,
    businessHoursOnly: true,
    escalationEmail: '',
  },
  autoClose: { enabled: true, daysBeforeClose: 7, reminderDaysBefore: 2 },
  locale: { language: 'fr' },
}

/**
 * GET /api/support/settings — Read support settings
 */
export function createSettingsGetEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/settings',
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

        let settings = { ...DEFAULT_SUPPORT_SETTINGS }
        if (prefs.docs.length > 0) {
          const stored = prefs.docs[0].value as Partial<SupportSettings>
          settings = {
            email: { ...DEFAULT_SUPPORT_SETTINGS.email, ...stored.email },
            ai: { ...DEFAULT_SUPPORT_SETTINGS.ai, ...stored.ai },
            sla: { ...DEFAULT_SUPPORT_SETTINGS.sla, ...stored.sla },
            autoClose: { ...DEFAULT_SUPPORT_SETTINGS.autoClose, ...stored.autoClose },
            locale: { ...DEFAULT_SUPPORT_SETTINGS.locale, ...stored.locale },
          }
        }

        return Response.json(settings)
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
 * POST /api/support/settings — Save all support settings (admin-only)
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

        const merged: SupportSettings = {
          email: { ...DEFAULT_SUPPORT_SETTINGS.email, ...body.email },
          ai: { ...DEFAULT_SUPPORT_SETTINGS.ai, ...body.ai },
          sla: { ...DEFAULT_SUPPORT_SETTINGS.sla, ...body.sla },
          autoClose: { ...DEFAULT_SUPPORT_SETTINGS.autoClose, ...body.autoClose },
          locale: { ...DEFAULT_SUPPORT_SETTINGS.locale, ...body.locale },
        }

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
            data: { value: merged as unknown as Record<string, unknown> },
            overrideAccess: true,
          })
        } else {
          await (payload as any).create({
            collection: 'payload-preferences',
            data: {
              key: PREF_KEY,
              value: merged as unknown as Record<string, unknown>,
            },
            overrideAccess: true,
            req,
          })
        }

        return Response.json(merged)
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[support/settings] Error saving settings:', error)
        return Response.json({ error: 'Error' }, { status: 500 })
      }
    },
  }
}
