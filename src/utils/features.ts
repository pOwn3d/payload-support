/**
 * Ticketing feature flags — single source of truth (client + server).
 *
 * Flags are stored SERVER-side, in the `support-settings` row of
 * `payload-preferences` (see `readSettings.ts` and `endpoints/settings.ts`).
 * A flag toggled on one machine therefore applies to every browser and to
 * server-side code (hooks, cron endpoints) alike.
 *
 * `localStorage` is still used, but demoted to a plain CACHE: it lets admin
 * views paint synchronously on first render and keeps them usable when the
 * settings endpoint is unreachable. It is never authoritative.
 *
 * Two flags are *projections* of settings that already lived server-side long
 * before this module, and are deliberately NOT stored twice:
 *   - `autoClose`     ← `settings.autoClose.enabled`
 *   - `autoCloseDays` ← `settings.autoClose.daysBeforeClose`
 * The `autoClose` block stays authoritative; the flags are recomputed on read
 * and dropped on write. See `projectAutoClose` / `stripProjectedFeatures`.
 */

/**
 * Feature flags for the ticketing module.
 * Each feature can be enabled/disabled by the admin.
 * When disabled, the corresponding UI section is hidden entirely.
 */
export interface TicketingFeatures {
  /** Time tracking: timer, manual entries, billing */
  timeTracking: boolean
  /** AI features: sentiment, synthesis, suggestion, rewrite */
  ai: boolean
  /** Satisfaction surveys: CSAT rating after resolution */
  satisfaction: boolean
  /** Live chat integration: chat → ticket conversion */
  chat: boolean
  /** Email tracking: pixel tracking, open/sent status per message */
  emailTracking: boolean
  /** Canned responses: quick reply templates */
  canned: boolean
  /** Ticket merge: combine two tickets into one */
  merge: boolean
  /** Snooze: temporarily hide a ticket */
  snooze: boolean
  /** External messages: add messages received outside the system */
  externalMessages: boolean
  /** Client history: past tickets, projects, notes sidebar */
  clientHistory: boolean
  /** Activity log: audit trail of actions on the ticket */
  activityLog: boolean
  /** Split ticket: extract a message into a new ticket */
  splitTicket: boolean
  /** Scheduled replies: send a message at a future date */
  scheduledReplies: boolean
  /** Auto-close: automatically resolve inactive tickets (projection of settings.autoClose.enabled) */
  autoClose: boolean
  /** Auto-close delay in days (projection of settings.autoClose.daysBeforeClose) */
  autoCloseDays: number
  /** Round-robin: distribute new tickets evenly among agents */
  roundRobin: boolean
}

/** Default features — all enabled except round-robin */
export const DEFAULT_TICKETING_FEATURES: TicketingFeatures = {
  timeTracking: true,
  ai: true,
  satisfaction: true,
  chat: true,
  emailTracking: true,
  canned: true,
  merge: true,
  snooze: true,
  externalMessages: true,
  clientHistory: true,
  activityLog: true,
  splitTicket: true,
  scheduledReplies: true,
  autoClose: true,
  autoCloseDays: 7,
  roundRobin: false,
}

type BooleanFeatureKey = Exclude<keyof TicketingFeatures, 'autoCloseDays'>

const BOOLEAN_FEATURE_KEYS: readonly BooleanFeatureKey[] = [
  'timeTracking',
  'ai',
  'satisfaction',
  'chat',
  'emailTracking',
  'canned',
  'merge',
  'snooze',
  'externalMessages',
  'clientHistory',
  'activityLog',
  'splitTicket',
  'scheduledReplies',
  'autoClose',
  'roundRobin',
]

/** Flags derived from another settings block — never persisted inside `features`. */
const PROJECTED_FEATURE_KEYS = ['autoClose', 'autoCloseDays'] as const

/**
 * Coerce arbitrary input (stale localStorage, hand-edited preference row, older
 * plugin version) into a complete, well-typed feature set. Unknown keys are
 * dropped and wrongly-typed values fall back to their default.
 */
export function normalizeFeatures(raw: unknown): TicketingFeatures {
  const out = { ...DEFAULT_TICKETING_FEATURES }
  if (!raw || typeof raw !== 'object') return out

  const src = raw as Record<string, unknown>
  for (const key of BOOLEAN_FEATURE_KEYS) {
    if (typeof src[key] === 'boolean') out[key] = src[key] as boolean
  }

  const days = src.autoCloseDays
  if (typeof days === 'number' && Number.isFinite(days) && days >= 1) {
    out.autoCloseDays = Math.floor(days)
  }

  return out
}

/** Shape of the `autoClose` settings block the two projected flags mirror. */
export interface AutoCloseProjectionSource {
  enabled?: boolean
  daysBeforeClose?: number
}

/** Recompute the projected flags from the authoritative `autoClose` block. */
export function projectAutoClose(
  features: TicketingFeatures,
  autoClose: AutoCloseProjectionSource | undefined,
): TicketingFeatures {
  if (!autoClose) return features
  return {
    ...features,
    autoClose: typeof autoClose.enabled === 'boolean' ? autoClose.enabled : features.autoClose,
    autoCloseDays:
      typeof autoClose.daysBeforeClose === 'number' && autoClose.daysBeforeClose >= 1
        ? Math.floor(autoClose.daysBeforeClose)
        : features.autoCloseDays,
  }
}

/**
 * Drop the projected flags before persisting, so `features` and the `autoClose`
 * block can never disagree.
 */
export function stripProjectedFeatures(
  features: TicketingFeatures,
): Omit<TicketingFeatures, (typeof PROJECTED_FEATURE_KEYS)[number]> {
  const out = { ...features } as Record<string, unknown>
  for (const key of PROJECTED_FEATURE_KEYS) delete out[key]
  return out as Omit<TicketingFeatures, (typeof PROJECTED_FEATURE_KEYS)[number]>
}

// ─── Client-side cache ───────────────────────────────────

/** localStorage key. Was the source of truth before 2.1 — now only a cache. */
export const FEATURES_CACHE_KEY = 'ticketing_features'
/** Set once the pre-2.1 localStorage values have been pushed to the server. */
export const FEATURES_ADOPTED_KEY = 'ticketing_features_adopted'
/** Admin-only settings endpoint backing the flags. */
export const FEATURES_ENDPOINT = '/api/support/settings'

/** localStorage can throw (Safari private mode, disabled storage) — never let it bubble. */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Read the cached flags, or `null` when nothing usable is cached. */
export function readFeaturesCache(): TicketingFeatures | null {
  const store = storage()
  if (!store) return null
  try {
    const stored = store.getItem(FEATURES_CACHE_KEY)
    if (!stored) return null
    return normalizeFeatures(JSON.parse(stored))
  } catch {
    return null
  }
}

/** Refresh the cache with the values the server just confirmed. */
export function writeFeaturesCache(features: TicketingFeatures): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(FEATURES_CACHE_KEY, JSON.stringify(features))
  } catch {
    /* quota exceeded / storage disabled — the server copy still stands */
  }
}

/**
 * Synchronous read used for first paint. Returns the cache when present, the
 * defaults otherwise. Callers must still refresh from the server — see
 * `useFeatures`.
 */
export function getFeatures(): TicketingFeatures {
  return readFeaturesCache() ?? { ...DEFAULT_TICKETING_FEATURES }
}

// ─── One-shot migration of pre-2.1 localStorage ──────────

/** True once this browser's legacy flags have been handed over to the server. */
export function hasAdoptedLegacyFeatures(): boolean {
  const store = storage()
  if (!store) return true // nothing to migrate without storage
  try {
    return store.getItem(FEATURES_ADOPTED_KEY) === '1'
  } catch {
    return true
  }
}

export function markLegacyFeaturesAdopted(): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(FEATURES_ADOPTED_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Flags this browser configured before the server became authoritative, or
 * `null` when there is nothing to migrate (no local values, or already done).
 */
export function readLegacyFeatures(): TicketingFeatures | null {
  if (hasAdoptedLegacyFeatures()) return null
  return readFeaturesCache()
}

// ─── Server round-trips ──────────────────────────────────

export interface FetchedFeatures {
  features: TicketingFeatures
  /** False when the server has never had feature flags saved (fresh install). */
  configured: boolean
  /** True when the values come from the cache/defaults because the call failed. */
  offline: boolean
}

/**
 * Read the flags from the server. Falls back to the local cache, then to the
 * defaults: a failed settings call must never leave a ticket screen unusable.
 */
export async function fetchFeatures(signal?: AbortSignal): Promise<FetchedFeatures> {
  try {
    const res = await fetch(FEATURES_ENDPOINT, { credentials: 'include', signal })
    if (res.ok) {
      const data = (await res.json()) as {
        features?: unknown
        featuresConfigured?: boolean
        autoClose?: AutoCloseProjectionSource
      }
      const features = projectAutoClose(normalizeFeatures(data.features), data.autoClose)
      writeFeaturesCache(features)
      return { features, configured: data.featuresConfigured === true, offline: false }
    }
  } catch {
    /* network error / aborted — fall through to the cache */
  }
  return { features: getFeatures(), configured: false, offline: true }
}

/**
 * Persist the flags server-side, then refresh the local cache.
 *
 * @returns true when the server accepted the write.
 */
export async function saveFeatures(features: TicketingFeatures): Promise<boolean> {
  const normalized = normalizeFeatures(features)
  try {
    const res = await fetch(FEATURES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ features: normalized }),
    })
    if (!res.ok) return false
    writeFeaturesCache(normalized)
    return true
  } catch {
    return false
  }
}
