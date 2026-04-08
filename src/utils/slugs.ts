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
  users: 'users',
  media: 'media',
}

/**
 * Resolve collection slugs merging user overrides with defaults.
 */
export function resolveSlugs(
  overrides?: Partial<CollectionSlugs>,
): CollectionSlugs {
  return { ...DEFAULT_SLUGS, ...overrides }
}
