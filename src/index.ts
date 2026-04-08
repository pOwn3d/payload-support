// Plugin
export { supportPlugin } from './plugin'

// Types
export type {
  SupportPluginConfig,
  SupportFeatures,
  AIProviderConfig,
  EmailConfig,
  TicketData,
  MessageData,
  TimeEntryData,
  ClientData,
  CannedResponseData,
  ActivityEntryData,
  SatisfactionSurveyData,
} from './types'

export { DEFAULT_FEATURES } from './types'

// Utils
export { resolveSlugs, DEFAULT_SLUGS } from './utils/slugs'
export type { CollectionSlugs } from './utils/slugs'

// Collection factories (for advanced usage — standalone collection creation)
export {
  createTicketsCollection,
  createTicketMessagesCollection,
  createSupportClientsCollection,
  createTimeEntriesCollection,
  createCannedResponsesCollection,
  createTicketActivityLogCollection,
  createSatisfactionSurveysCollection,
  createKnowledgeBaseCollection,
  createChatMessagesCollection,
  createPendingEmailsCollection,
  createEmailLogsCollection,
  createAuthLogsCollection,
  createWebhookEndpointsCollection,
  createSlaPoliciesCollection,
  createMacrosCollection,
  createTicketStatusesCollection,
} from './collections'
