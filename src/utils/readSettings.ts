import type { Payload } from 'payload'
import { dbFind } from './db'
import {
  DEFAULT_TICKETING_FEATURES,
  normalizeFeatures,
  projectAutoClose,
  type TicketingFeatures,
} from './features'

export const SUPPORT_SETTINGS_PREF_KEY = 'support-settings'
const PREF_KEY = SUPPORT_SETTINGS_PREF_KEY
const USER_PREFS_KEY_PREFIX = 'support-user-prefs'
/** Pre-2.1 standalone round-robin row — read as a fallback, then folded into `features`. */
const LEGACY_ROUND_ROBIN_KEY = 'support-round-robin'

export interface SupportSettings {
  email: { fromAddress: string; fromName: string; replyToAddress: string }
  ai: { provider: string; model: string; enableSentiment: boolean; enableSynthesis: boolean; enableSuggestion: boolean; enableRewrite: boolean }
  sla: { firstResponseMinutes: number; resolutionMinutes: number; businessHoursOnly: boolean; escalationEmail: string }
  autoClose: { enabled: boolean; daysBeforeClose: number; reminderDaysBefore: number }
  /** Ticketing feature flags — server-authoritative since 2.1 (used to be per-browser localStorage). */
  features: TicketingFeatures
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
  features: { ...DEFAULT_TICKETING_FEATURES },
}

export const DEFAULT_USER_PREFS: UserPrefs = {
  locale: 'fr',
  signature: '',
}

// In-process cache: readSupportSettings is hit many times per ticket mutation
// (the afterChange hook chain). The settings doc changes rarely, so a short TTL
// + explicit invalidation on save (endpoints/settings.ts) avoids redundant DB
// reads of the same `payload-preferences` row.
let settingsCache: { value: SupportSettingsState; ts: number } | null = null
const SETTINGS_TTL_MS = 60_000

export interface SupportSettingsState {
  settings: SupportSettings
  /**
   * False when the preference row carries no `features` object yet — a
   * pre-2.1 install, or a fresh one. Clients use it to decide whether their
   * legacy `localStorage` flags should seed the server.
   */
  featuresConfigured: boolean
}

/** Invalidate the settings cache — call right after writing support settings. */
export function invalidateSupportSettingsCache(): void {
  settingsCache = null
}

/**
 * Merge a stored preference value onto the defaults.
 * Exported for the settings endpoint, which must not re-implement the merge.
 */
export function mergeSupportSettings(
  stored: Partial<SupportSettings> | undefined | null,
  base: SupportSettings = DEFAULT_SETTINGS,
): SupportSettings {
  const autoClose = { ...base.autoClose, ...stored?.autoClose }
  return {
    email: { ...base.email, ...stored?.email },
    ai: { ...base.ai, ...stored?.ai },
    sla: { ...base.sla, ...stored?.sla },
    autoClose,
    // `autoClose` / `autoCloseDays` are projections of the block above, so they
    // are recomputed here rather than trusted from whatever was persisted.
    features: projectAutoClose(
      normalizeFeatures({ ...base.features, ...(stored?.features as object | undefined) }),
      autoClose,
    ),
  }
}

export async function readSupportSettingsState(payload: Payload): Promise<SupportSettingsState> {
  if (settingsCache && Date.now() - settingsCache.ts < SETTINGS_TTL_MS) {
    return settingsCache.value
  }
  let value: SupportSettingsState = {
    settings: mergeSupportSettings(null),
    featuresConfigured: false,
  }
  try {
    const prefs = await dbFind(payload, 'payload-preferences', {
      where: { key: { equals: PREF_KEY } },
      // The upsert is scoped per admin user, so several rows can share the key.
      // Sorting makes "last write wins" deterministic instead of arbitrary.
      sort: '-updatedAt',
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (prefs.docs.length > 0) {
      const stored = prefs.docs[0].value as Partial<SupportSettings>
      const featuresConfigured = !!stored.features && typeof stored.features === 'object'
      const settings = mergeSupportSettings(stored)

      // Pre-2.1 installs enabled round-robin through its own preference row.
      // Honour it until the first save writes `features` — after that the
      // legacy row is ignored, and both write paths land in `features`.
      if (!featuresConfigured) {
        settings.features.roundRobin = await readLegacyRoundRobin(payload)
      }

      value = { settings, featuresConfigured }
    }
  } catch { /* fallback to defaults */ }
  settingsCache = { value, ts: Date.now() }
  return value
}

export async function readSupportSettings(payload: Payload): Promise<SupportSettings> {
  return (await readSupportSettingsState(payload)).settings
}

async function readLegacyRoundRobin(payload: Payload): Promise<boolean> {
  try {
    const prefs = await dbFind(payload, 'payload-preferences', {
      where: { key: { equals: LEGACY_ROUND_ROBIN_KEY } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (prefs.docs.length > 0) {
      return (prefs.docs[0].value as { enabled?: boolean })?.enabled === true
    }
  } catch { /* ignore — defaults to disabled */ }
  return DEFAULT_TICKETING_FEATURES.roundRobin
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
