// SLA helpers — derive remaining time + visual state from ticket's
// slaFirstResponseDue / slaFirstResponseBreached fields (already on Tickets).

export type SlaState = 'ok' | 'warn' | 'breach' | 'none' | 'met' | 'paused'

export interface SlaInput {
  slaFirstResponseDue?: string | null
  slaFirstResponseBreached?: boolean | null
  firstResponseAt?: string | null
  slaResolutionDue?: string | null
  slaResolutionBreached?: boolean | null
  /** Set while the ticket sits in `waiting_client`; the resolution clock is stopped. */
  slaPausedAt?: string | null
}

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

/**
 * How long the resolution clock has been stopped, in milliseconds, or 0.
 *
 * `createPauseSlaOnHold` only stamps `slaPausedAt` when the ticket enters
 * `waiting_client`; it pushes `slaResolutionDue` forward *on the way out*, once
 * it knows how long the pause lasted. So for the whole duration of the pause the
 * stored deadline is stale by exactly this much, and anything comparing it to
 * `now` — this function's callers included — reads a breach that the server does
 * not consider one.
 *
 * Rather than wait for the resume hook, we add the elapsed pause back here. The
 * arithmetic is the same the hook performs later, so the badge during the pause
 * and the stored deadline after it agree.
 */
export function pausedForMs(t: SlaInput, now: Date = new Date()): number {
  if (!t.slaPausedAt) return 0
  const pausedAt = new Date(t.slaPausedAt)
  if (Number.isNaN(pausedAt.getTime())) return 0
  return Math.max(0, now.getTime() - pausedAt.getTime())
}

export function computeSlaState(t: SlaInput, now: Date = new Date()): {
  state: SlaState
  remainingMs: number | null
  due: string | null
  /** Only set while paused: how long the clock has been stopped. */
  pausedMs?: number
} {
  // Once first-response is met, fall back to resolution SLA.
  const hasFirstResponse = !!t.firstResponseAt
  const dueRaw = hasFirstResponse ? t.slaResolutionDue : t.slaFirstResponseDue
  const breached = hasFirstResponse ? !!t.slaResolutionBreached : !!t.slaFirstResponseBreached

  if (!dueRaw) return { state: 'none', remainingMs: null, due: null }

  const dueDate = new Date(dueRaw)
  if (Number.isNaN(dueDate.getTime())) return { state: 'none', remainingMs: null, due: null }

  // The pause only stops the RESOLUTION clock. A first-response SLA keeps
  // running while the client is being waited on — the agent has still not
  // answered, which is precisely what that target measures.
  const pausedMs = hasFirstResponse ? pausedForMs(t, now) : 0
  const remaining = dueDate.getTime() + pausedMs - now.getTime()

  if (pausedMs > 0) {
    // A stored breach flag is not overridden: if the clock had already run out
    // before the client was asked, the ticket really did breach.
    if (breached) return { state: 'breach', remainingMs: remaining, due: dueRaw, pausedMs }
    return { state: 'paused', remainingMs: remaining, due: dueRaw, pausedMs }
  }

  if (breached || remaining < 0) {
    return { state: 'breach', remainingMs: remaining, due: dueRaw }
  }
  if (remaining < HOUR_MS) {
    return { state: 'warn', remainingMs: remaining, due: dueRaw }
  }
  return { state: 'ok', remainingMs: remaining, due: dueRaw }
}

export function formatSlaRemaining(remainingMs: number | null): string {
  if (remainingMs == null) return '—'
  const abs = Math.abs(remainingMs)
  const sign = remainingMs < 0 ? '−' : ''
  if (abs < HOUR_MS) {
    const m = Math.floor(abs / MINUTE_MS)
    return `${sign}${m}m`
  }
  const h = Math.floor(abs / HOUR_MS)
  const m = Math.floor((abs % HOUR_MS) / MINUTE_MS)
  if (h < 24) return `${sign}${h}h${m > 0 ? ` ${String(m).padStart(2, '0')}` : ''}`
  const d = Math.floor(h / 24)
  return `${sign}${d}j`
}
