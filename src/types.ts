// ─── Feature flags ───────────────────────────────────────

export interface SupportFeatures {
  /** Time tracking: timer, manual entries, billing */
  timeTracking?: boolean
  /** AI features: sentiment, synthesis, suggestion, rewrite */
  ai?: boolean
  /** Satisfaction surveys: CSAT rating after resolution */
  satisfaction?: boolean
  /** Live chat integration: chat → ticket conversion */
  chat?: boolean
  /** Email tracking: pixel tracking, open/sent status per message */
  emailTracking?: boolean
  /** Canned responses: quick reply templates */
  canned?: boolean
  /** Ticket merge: combine two tickets into one */
  merge?: boolean
  /** Snooze: temporarily hide a ticket */
  snooze?: boolean
  /** External messages: add messages received outside the system */
  externalMessages?: boolean
  /** Client history: past tickets, projects, notes sidebar */
  clientHistory?: boolean
  /** Activity log: audit trail of actions on the ticket */
  activityLog?: boolean
  /** Split ticket: extract a message into a new ticket */
  splitTicket?: boolean
  /** Scheduled replies: send a message at a future date */
  scheduledReplies?: boolean
  /** Auto-close: automatically resolve inactive tickets */
  autoClose?: boolean
  /** Auto-close delay in days */
  autoCloseDays?: number
  /** Round-robin: distribute new tickets evenly among agents */
  roundRobin?: boolean
  /** SLA policies: response & resolution time targets */
  sla?: boolean
  /** Webhooks: outbound HTTP hooks on ticket events */
  webhooks?: boolean
  /** Macros: multi-action shortcuts */
  macros?: boolean
  /** Custom statuses: configurable ticket statuses */
  customStatuses?: boolean
  /** Collision detection: warn when multiple agents view same ticket */
  collisionDetection?: boolean
  /** Per-agent email signatures */
  signatures?: boolean
  /** AI chatbot for self-service */
  chatbot?: boolean
  /** Bulk actions on multiple tickets */
  bulkActions?: boolean
  /** Command palette (⌘K) */
  commandPalette?: boolean
  /** Knowledge base / FAQ */
  knowledgeBase?: boolean
  /** Pending email queue */
  pendingEmails?: boolean
  /** Authentication audit logs */
  authLogs?: boolean
}

// ─── AI provider ─────────────────────────────────────────

export interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'ollama' | 'custom'
  apiKey?: string
  model?: string
  baseUrl?: string
}

// ─── Email configuration ─────────────────────────────────

export interface EmailConfig {
  fromAddress?: string
  fromName?: string
  replyTo?: string
}

// ─── Plugin configuration ────────────────────────────────

export interface SupportPluginConfig {
  /** Enable/disable individual features (all enabled by default) */
  features?: SupportFeatures

  /** AI provider configuration */
  ai?: AIProviderConfig

  /** Email configuration for ticket notifications */
  email?: EmailConfig

  /** Locale: 'fr' or 'en' (default: 'fr') */
  locale?: 'fr' | 'en'

  /** Nav group label in Payload admin sidebar */
  navGroup?: string

  /** Base path for admin views (default: '/support') */
  basePath?: string

  /** User collection slug for agent relationships (default: 'users') */
  userCollectionSlug?: string

  /**
   * Restrict Google OAuth auto-registration to specific email domains.
   * When set and non-empty, only emails matching one of these domains can
   * create an account via OAuth. Existing accounts are unaffected.
   * Example: ['acme.com', 'partner.org']
   */
  allowedEmailDomains?: string[]

  /** Collection slug overrides */
  collectionSlugs?: {
    tickets?: string
    ticketMessages?: string
    supportClients?: string
    timeEntries?: string
    cannedResponses?: string
    ticketActivityLog?: string
    satisfactionSurveys?: string
    knowledgeBase?: string
    chatMessages?: string
    pendingEmails?: string
    emailLogs?: string
    authLogs?: string
    webhookEndpoints?: string
    slaPolicies?: string
    macros?: string
    ticketStatuses?: string
  }
}

// ─── Ticket data types ───────────────────────────────────

export interface TicketData {
  id: number | string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  category?: string
  client?: number | string
  assignedTo?: number | string
  totalTimeMinutes?: number
  createdAt: string
  updatedAt: string
}

export interface MessageData {
  id: number | string
  ticket: number | string
  body: string
  bodyHtml?: string
  authorType: 'admin' | 'client' | 'email'
  isInternal?: boolean
  attachments?: Array<{ file: number | string }>
  createdAt: string
}

export interface TimeEntryData {
  id: number | string
  ticket: number | string
  minutes: number
  description?: string
  date: string
}

export interface ClientData {
  id: number | string
  email: string
  firstName: string
  lastName: string
  company?: string
  phone?: string
}

export interface CannedResponseData {
  id: number | string
  title: string
  body: string
  category?: string
}

export interface ActivityEntryData {
  id: number | string
  ticket: number | string
  action: string
  field?: string
  oldValue?: string
  newValue?: string
  actorType: 'admin' | 'client' | 'system'
  actorEmail?: string
  createdAt: string
}

export interface SatisfactionSurveyData {
  id: number | string
  ticket: number | string
  client: number | string
  rating: number
  comment?: string
}

// ─── Default feature values ──────────────────────────────

export const DEFAULT_FEATURES: Required<SupportFeatures> = {
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
  sla: true,
  webhooks: true,
  macros: true,
  customStatuses: false,
  collisionDetection: true,
  signatures: true,
  chatbot: true,
  bulkActions: true,
  commandPalette: true,
  knowledgeBase: true,
  pendingEmails: true,
  authLogs: true,
}
