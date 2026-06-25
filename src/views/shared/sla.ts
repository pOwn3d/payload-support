// SLA helpers — derive remaining time + visual state from ticket's
// slaFirstResponseDue / slaFirstResponseBreached fields (already on Tickets).

export type SlaState = 'ok' | 'warn' | 'breach' | 'none' | 'met'

export interface SlaInput {
  slaFirstResponseDue?: string | null
  slaFirstResponseBreached?: boolean | null
  firstResponseAt?: string | null
  slaResolutionDue?: string | null
  slaResolutionBreached?: boolean | null
}

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

export function computeSlaState(t: SlaInput, now: Date = new Date()): {
  state: SlaState
  remainingMs: number | null
  due: string | null
} {
  // Once first-response is met, fall back to resolution SLA.
  const hasFirstResponse = !!t.firstResponseAt
  const dueRaw = hasFirstResponse ? t.slaResolutionDue : t.slaFirstResponseDue
  const breached = hasFirstResponse ? !!t.slaResolutionBreached : !!t.slaFirstResponseBreached

  if (!dueRaw) return { state: 'none', remainingMs: null, due: null }

  const dueDate = new Date(dueRaw)
  if (Number.isNaN(dueDate.getTime())) return { state: 'none', remainingMs: null, due: null }

  const remaining = dueDate.getTime() - now.getTime()

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
