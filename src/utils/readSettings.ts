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

/**
 * Key under which `plugin.ts` publishes the resolved staff collection slug on
 * `config.custom`. It is the ONE source of truth shared by the read path (here)
 * and the write path (`requireAdmin` → `slugs.users`).
 */
export const SUPPORT_STAFF_SLUG_CONFIG_KEY = 'supportStaffCollection'

/**
 * Owner scope for every `payload-preferences` row this plugin reads back.
 *
 * `payload-preferences` is writable by ANY authenticated principal, whatever its
 * auth collection: Payload's `POST /api/payload-preferences/:key` handler only
 * checks `!!req.user` before upserting the row. Reading a plugin-wide row by key
 * alone therefore lets a front-office user (or a support-client) plant their own
 * row and have the whole plugin read it — replyTo addresses, SLA escalation
 * address, AI provider, feature flags.
 *
 * Every read below is constrained to `user.relationTo = <staff collection>`, the
 * same scope the WRITE path already uses (endpoints/settings.ts, signature.ts,
 * user-prefs.ts all upsert with `req.user.collection`, and all three are guarded
 * by `requireAdmin`, which compares against `slugs.users`).
 *
 * TWO SOURCES OF TRUTH WERE THE BUG: this used to resolve the scope from
 * `config.admin.user`, which Payload defaults to the FIRST auth collection of
 * the app when the integrator did not declare it (config/sanitize.js). On a host
 * whose first auth collection is the front office and whose staff collection is
 * declared through `collectionSlugs.users`, the read scope named the front
 * office while the write scope named the staff — and the poisoning this scope
 * was added to defeat was open again. So the plugin now PUBLISHES the resolved
 * `slugs.users` on `config.custom` (see plugin.ts) and reads it back here.
 * `config.admin.user` remains a last-resort fallback for callers using these
 * helpers outside of a plugin-built config; there is no plugin deployment in
 * which it is consulted.
 */
export function resolveStaffPrefSlug(payload: Payload, staffSlug?: string): string {
  if (staffSlug) return staffSlug
  const config = (payload as unknown as {
    config?: { admin?: { user?: string }; custom?: Record<string, unknown> }
  }).config
  const registered = config?.custom?.[SUPPORT_STAFF_SLUG_CONFIG_KEY]
  if (typeof registered === 'string' && registered) return registered
  return config?.admin?.user || 'users'
}

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
// Keyed by the STAFF SLUG the read was scoped to: a single shared slot would
// serve one install's (or one test's) settings to another whose scope differs.
// Bounded — the key comes from config, never from a request — but capped anyway
// so an integrator calling the exported helper with arbitrary slugs cannot grow
// it without limit.
const settingsCache = new Map<string, { value: SupportSettingsState; ts: number }>()
const SETTINGS_TTL_MS = 60_000
const SETTINGS_CACHE_MAX = 8

/** Rate-limits the "settings row exists but is not staff-owned" warning, per scope. */
const warnedForeignSettingsRow = new Set<string>()

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
  settingsCache.clear()
  warnedForeignSettingsRow.clear()
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

export async function readSupportSettingsState(
  payload: Payload,
  staffSlug?: string,
): Promise<SupportSettingsState> {
  const staff = resolveStaffPrefSlug(payload, staffSlug)
  const cached = settingsCache.get(staff)
  if (cached && Date.now() - cached.ts < SETTINGS_TTL_MS) {
    return cached.value
  }
  let value: SupportSettingsState = {
    settings: mergeSupportSettings(null),
    featuresConfigured: false,
  }
  try {
    const prefs = await dbFind(payload, 'payload-preferences', {
      // Sibling keys are AND-ed by Payload. The `user.relationTo` clause is the
      // security boundary: without it any authenticated principal can plant a
      // `support-settings` row and own the plugin's server settings.
      where: { key: { equals: PREF_KEY }, 'user.relationTo': { equals: staff } },
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
        settings.features.roundRobin = await readLegacyRoundRobin(payload, staff)
      }

      value = { settings, featuresConfigured }
    } else {
      await warnOnForeignSettingsRow(payload, staff)
    }
  } catch { /* fallback to defaults */ }
  if (settingsCache.size >= SETTINGS_CACHE_MAX && !settingsCache.has(staff)) settingsCache.clear()
  settingsCache.set(staff, { value, ts: Date.now() })
  return value
}

/**
 * The scoped read came back empty. That is normal on a fresh install, but it is
 * also what an operator sees when the settings row was written under another
 * owner than the resolved staff collection: the row exists, is ignored,
 * and the whole plugin silently runs on the defaults — a `try/catch` away from
 * any signal. So: if a row with this key exists under ANOTHER owner, say so.
 *
 * Same message covers the other case, deliberately: a `support-settings` row
 * owned by a non-staff principal is exactly the poisoning attempt this scope was
 * added to defeat, and the operator should hear about it. Once per cache window
 * at most (the extra query only runs when nothing was found).
 */
async function warnOnForeignSettingsRow(payload: Payload, staff: string): Promise<void> {
  if (warnedForeignSettingsRow.has(staff)) return
  try {
    const any = await dbFind(payload, 'payload-preferences', {
      where: { key: { equals: PREF_KEY } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (any.docs.length === 0) return // fresh install — nothing to report
    if (warnedForeignSettingsRow.size >= SETTINGS_CACHE_MAX) warnedForeignSettingsRow.clear()
    warnedForeignSettingsRow.add(staff)
    console.warn(
      `[support] A "${PREF_KEY}" preference row exists but none is owned by the "${staff}" collection: ` +
        'the plugin is running on its DEFAULT settings. Either the staff auth collection differs from ' +
        '`admin.user`, or the row was written by a principal that is not staff — in which case it is ' +
        'ignored on purpose.',
    )
  } catch {
    /* diagnostic only — never let it change the outcome */
  }
}

export async function readSupportSettings(
  payload: Payload,
  staffSlug?: string,
): Promise<SupportSettings> {
  return (await readSupportSettingsState(payload, staffSlug)).settings
}

async function readLegacyRoundRobin(payload: Payload, staff: string): Promise<boolean> {
  try {
    const prefs = await dbFind(payload, 'payload-preferences', {
      where: { key: { equals: LEGACY_ROUND_ROBIN_KEY }, 'user.relationTo': { equals: staff } },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (prefs.docs.length > 0) {
      return (prefs.docs[0].value as { enabled?: boolean })?.enabled === true
    }
  } catch { /* ignore — defaults to disabled */ }
  return DEFAULT_TICKETING_FEATURES.roundRobin
}

export async function readUserPrefs(
  payload: Payload,
  userId: string | number,
  staffSlug?: string,
): Promise<UserPrefs> {
  try {
    const key = `${USER_PREFS_KEY_PREFIX}-${userId}`
    // Ids collide across auth collections: a support-client with id 7 would
    // otherwise own `support-user-prefs-7`, the row read back for agent 7.
    const prefs = await dbFind(payload, 'payload-preferences', {
      where: {
        key: { equals: key },
        'user.relationTo': { equals: resolveStaffPrefSlug(payload, staffSlug) },
      },
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
