/**
 * Default collection slugs used by the support plugin.
 * All slugs can be overridden via SupportPluginConfig.collectionSlugs.
 */
export interface CollectionSlugs {
  tickets: string
  ticketMessages: string
  supportClients: string
  timeEntries: string
  cannedResponses: string
  ticketActivityLog: string
  satisfactionSurveys: string
  knowledgeBase: string
  chatMessages: string
  pendingEmails: string
  emailLogs: string
  authLogs: string
  webhookEndpoints: string
  slaPolicies: string
  macros: string
  ticketStatuses: string
  ticketFeedback: string
  notificationQueue: string
  automationRules: string
  supportTeams: string
  pushSubscriptions: string
  rateLimits: string
  counters: string
  users: string
  media: string
}

export const DEFAULT_SLUGS: CollectionSlugs = {
  tickets: 'tickets',
  ticketMessages: 'ticket-messages',
  supportClients: 'support-clients',
  timeEntries: 'time-entries',
  cannedResponses: 'canned-responses',
  ticketActivityLog: 'ticket-activity-log',
  satisfactionSurveys: 'satisfaction-surveys',
  knowledgeBase: 'knowledge-base',
  chatMessages: 'chat-messages',
  pendingEmails: 'pending-emails',
  emailLogs: 'email-logs',
  authLogs: 'auth-logs',
  webhookEndpoints: 'webhook-endpoints',
  slaPolicies: 'sla-policies',
  macros: 'macros',
  ticketStatuses: 'ticket-statuses',
  ticketFeedback: 'ticket-feedback',
  notificationQueue: 'notification-queue',
  automationRules: 'automation-rules',
  supportTeams: 'support-teams',
  pushSubscriptions: 'push-subscriptions',
  rateLimits: 'support-rate-limits',
  counters: 'support-counters',
  users: 'users',
  media: 'media',
}

/**
 * Collections the plugin registers under a FIXED slug.
 *
 * Unlike everything in `CollectionSlugs`, these three hardcode their `slug`
 * (ClientSummaries.ts, TicketCollaborators.ts, TicketFeedback.ts), so any code
 * that reads or deletes their rows must use these literals rather than a
 * configurable slug — otherwise an app that overrides `collectionSlugs` would
 * address a collection that does not exist.
 */
export const FIXED_SLUGS = {
  clientSummaries: 'client-summaries',
  ticketCollaborators: 'ticket-collaborators',
  ticketFeedback: 'ticket-feedback',
} as const

/**
 * Resolve collection slugs merging user overrides with defaults.
 */
export function resolveSlugs(
  overrides?: Partial<CollectionSlugs>,
): CollectionSlugs {
  return { ...DEFAULT_SLUGS, ...overrides }
}
