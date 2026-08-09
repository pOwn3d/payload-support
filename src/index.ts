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
export { readSupportSettings, readSupportSettingsState, readUserPrefs, DEFAULT_SETTINGS, DEFAULT_USER_PREFS } from './utils/readSettings'
export type { SupportSettings, SupportSettingsState, UserPrefs } from './utils/readSettings'
// Runtime feature flags (server-authoritative, see utils/features.ts). Distinct
// from the build-time `SupportFeatures` passed to `supportPlugin()`.
export { DEFAULT_TICKETING_FEATURES, normalizeFeatures, projectAutoClose, stripProjectedFeatures } from './utils/features'
export type { TicketingFeatures } from './utils/features'
export { MemoryRateLimitStore, PayloadRateLimitStore, RateLimiter } from './utils/rateLimiter'
export type { RateLimitEntry, RateLimitStore } from './utils/rateLimiter'
export { DEFAULT_INBOUND_EMAIL_LIMITS, validateInboundEmailPayload, verifySecret } from './utils/webhookSecurity'
export type { InboundEmailInput, InboundEmailLimits, InboundEmailValidationError } from './utils/webhookSecurity'

// Endpoint factories for framework adapters (for example Next route handlers).
export { createLoginEndpoint, createOAuthGoogleEndpoint, createTrackOpenEndpoint } from './endpoints'
export { createAdminNotification } from './utils/adminNotification'
export { dispatchWebhook } from './utils/webhookDispatcher'
export { generateTicketSynthesis } from './utils/generateTicketSynthesis'
export type { TicketSynthesisResult } from './utils/generateTicketSynthesis'

// Hooks
export { createAssignSlaDeadlines, createCheckSlaOnResolve, createCheckSlaOnReply, calculateBusinessHoursDeadline } from './hooks/checkSLA'
export { createTicketStatusEmail } from './hooks/ticketStatusEmail'

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
  createTicketCollaboratorsCollection,
} from './collections'
