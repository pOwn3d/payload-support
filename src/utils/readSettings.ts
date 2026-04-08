import type { Payload } from 'payload'

const PREF_KEY = 'support-settings'
const USER_PREFS_KEY_PREFIX = 'support-user-prefs'

export interface SupportSettings {
  email: { fromAddress: string; fromName: string; replyToAddress: string }
  ai: { provider: string; model: string; enableSentiment: boolean; enableSynthesis: boolean; enableSuggestion: boolean; enableRewrite: boolean }
  sla: { firstResponseMinutes: number; resolutionMinutes: number; businessHoursOnly: boolean; escalationEmail: string }
  autoClose: { enabled: boolean; daysBeforeClose: number; reminderDaysBefore: number }
}

export interface UserPrefs {
  locale: 'fr' | 'en'
  signature: string
}

export const DEFAULT_SETTINGS: SupportSettings = {
  email: { fromAddress: '', fromName: 'Support', replyToAddress: '' },
  ai: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', enableSentiment: true, enableSynthesis: true, enableSuggestion: true, enableRewrite: true },
  sla: { firstResponseMinutes: 120, resolutionMinutes: 1440, businessHoursOnly: true, escalationEmail: '' },
  autoClose: { enabled: true, daysBeforeClose: 7, reminderDaysBefore: 2 },
}

export const DEFAULT_USER_PREFS: UserPrefs = {
  locale: 'fr',
  signature: '',
}

export async function readSupportSettings(payload: Payload): Promise<SupportSettings> {
  try {
    const prefs = await payload.find({
      collection: 'payload-preferences' as any,
      where: { key: { equals: PREF_KEY } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (prefs.docs.length > 0) {
      const stored = prefs.docs[0].value as Partial<SupportSettings>
      return {
        email: { ...DEFAULT_SETTINGS.email, ...stored.email },
        ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
        sla: { ...DEFAULT_SETTINGS.sla, ...stored.sla },
        autoClose: { ...DEFAULT_SETTINGS.autoClose, ...stored.autoClose },
      }
    }
  } catch { /* fallback to defaults */ }
  return { ...DEFAULT_SETTINGS }
}

export async function readUserPrefs(payload: Payload, userId: string | number): Promise<UserPrefs> {
  try {
    const key = `${USER_PREFS_KEY_PREFIX}-${userId}`
    const prefs = await payload.find({
      collection: 'payload-preferences' as any,
      where: { key: { equals: key } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (prefs.docs.length > 0) {
      const stored = prefs.docs[0].value as Partial<UserPrefs>
      return {
        locale: stored.locale || DEFAULT_USER_PREFS.locale,
        signature: stored.signature ?? DEFAULT_USER_PREFS.signature,
      }
    }
  } catch { /* fallback to defaults */ }
  return { ...DEFAULT_USER_PREFS }
}
