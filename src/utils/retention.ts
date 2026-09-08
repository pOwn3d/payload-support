import type { Payload, PayloadRequest } from 'payload'
import type { CollectionSlugs } from './slugs'
import { dbDelete } from './db'

/**
 * How long the two journals are kept, in days.
 *
 * Defaults follow the CNIL guidance the README documents: six months would be
 * the floor for connection logs, a year is the ceiling usually accepted, and
 * these two values sit inside that range while staying long enough to
 * investigate an intrusion. Set a value to 0 to disable the automatic purge of
 * that journal — never to mean "delete everything", which is what `days=0`
 * means on the manual endpoint.
 */
export interface RetentionConfig {
  /** Retention of `auth-logs` in days. `0` disables the scheduled purge. */
  authLogsDays?: number
  /** Retention of `email-logs` in days. `0` disables the scheduled purge. */
  emailLogsDays?: number
  /**
   * Cron for the scheduled purge. Payload's cron takes an optional leading
   * seconds field. Default: every day at 03:30.
   */
  cron?: string
  /** Queue the scheduled job is pushed to. Default: `default`. */
  queue?: string
}

export const DEFAULT_RETENTION = {
  authLogsDays: 180,
  emailLogsDays: 365,
  cron: '0 30 3 * * *',
  queue: 'default',
} as const

export const PURGE_LOGS_TASK_SLUG = 'support-purge-logs'

/** Journals the purge is allowed to touch, keyed by their public name. */
export function purgeableCollections(slugs: CollectionSlugs): Record<string, string> {
  return {
    'email-logs': slugs.emailLogs,
    'auth-logs': slugs.authLogs,
  }
}

/**
 * Delete rows of `slug` created more than `days` days ago.
 *
 * `days <= 0` means "everything" and is only reachable from the manual
 * admin-only endpoint. The scheduled task refuses it: a misconfigured cron
 * that wipes the whole security journal every night is a far worse outcome
 * than a journal that grows.
 */
export async function purgeOlderThan(
  payload: Payload,
  slug: string,
  days: number,
  req?: PayloadRequest,
): Promise<number> {
  const cutoff = days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null

  const result = await dbDelete(payload, slug, {
    where: cutoff
      ? { createdAt: { less_than: cutoff } }
      : { id: { exists: true } },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  return Array.isArray(result?.docs) ? result.docs.length : 0
}

export interface ScheduledPurgeResult {
  purged: Record<string, number>
  skipped: string[]
}

/**
 * The scheduled half of the purge. Never accepts `days <= 0`, and silently
 * skips a journal whose collection is not registered (its feature flag is off).
 */
export async function runScheduledPurge(
  payload: Payload,
  slugs: CollectionSlugs,
  retention: RetentionConfig | false | undefined,
  req?: PayloadRequest,
): Promise<ScheduledPurgeResult> {
  if (retention === false) return { purged: {}, skipped: ['auth-logs', 'email-logs'] }

  const plan: Array<[string, string, number]> = [
    ['auth-logs', slugs.authLogs, retention?.authLogsDays ?? DEFAULT_RETENTION.authLogsDays],
    ['email-logs', slugs.emailLogs, retention?.emailLogsDays ?? DEFAULT_RETENTION.emailLogsDays],
  ]

  const purged: Record<string, number> = {}
  const skipped: string[] = []

  for (const [name, slug, days] of plan) {
    if (!Number.isFinite(days) || days <= 0) {
      skipped.push(name)
      continue
    }
    if (!(payload.collections as Record<string, unknown> | undefined)?.[slug]) {
      skipped.push(name)
      continue
    }
    purged[name] = await purgeOlderThan(payload, slug, days, req)
  }

  return { purged, skipped }
}
