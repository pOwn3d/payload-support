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
  /** Live chat integration: chat -> ticket conversion */
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
  /** Auto-close: automatically resolve inactive tickets */
  autoClose: boolean
  /** Auto-close delay in days (used by auto-close cron) */
  autoCloseDays: number
  /** Round-robin: distribute new tickets evenly among agents */
  roundRobin: boolean
}

/** Default features -- all enabled */
export const DEFAULT_FEATURES: TicketingFeatures = {
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

const STORAGE_KEY = 'ticketing_features'

/** Read features from localStorage (falls back to defaults) */
export function getFeatures(): TicketingFeatures {
  if (typeof window === 'undefined') return DEFAULT_FEATURES
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_FEATURES, ...parsed }
    }
  } catch { /* ignore */ }
  return DEFAULT_FEATURES
}

/** Save features to localStorage */
export function saveFeatures(features: TicketingFeatures): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(features))
  } catch { /* ignore */ }
}
