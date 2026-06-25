import type { Payload } from 'payload'
import { dbFind } from './db'

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

// In-process cache: readSupportSettings is hit many times per ticket mutation
// (the afterChange hook chain). The settings doc changes rarely, so a short TTL
// + explicit invalidation on save (endpoints/settings.ts) avoids redundant DB
// reads of the same `payload-preferences` row.
let settingsCache: { value: SupportSettings; ts: number } | null = null
const SETTINGS_TTL_MS = 60_000

/** Invalidate the settings cache — call right after writing support settings. */
export function invalidateSupportSettingsCache(): void {
  settingsCache = null
}

export async function readSupportSettings(payload: Payload): Promise<SupportSettings> {
  if (settingsCache && Date.now() - settingsCache.ts < SETTINGS_TTL_MS) {
    return settingsCache.value
  }
  let value: SupportSettings = { ...DEFAULT_SETTINGS }
  try {
    const prefs = await dbFind(payload, 'payload-preferences', {
      where: { key: { equals: PREF_KEY } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (prefs.docs.length > 0) {
      const stored = prefs.docs[0].value as Partial<SupportSettings>
      value = {
        email: { ...DEFAULT_SETTINGS.email, ...stored.email },
        ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
        sla: { ...DEFAULT_SETTINGS.sla, ...stored.sla },
        autoClose: { ...DEFAULT_SETTINGS.autoClose, ...stored.autoClose },
      }
    }
  } catch { /* fallback to defaults */ }
  settingsCache = { value, ts: Date.now() }
  return value
}

export async function readUserPrefs(payload: Payload, userId: string | number): Promise<UserPrefs> {
  try {
    const key = `${USER_PREFS_KEY_PREFIX}-${userId}`
    const prefs = await dbFind(payload, 'payload-preferences', {
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
