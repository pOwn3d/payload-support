import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import type { SupportFeatures } from '../types'

import { createAiEndpoint } from './ai'
import { createSearchEndpoint } from './search'
import { createBulkActionEndpoint } from './bulk-action'
import { createMergeTicketsEndpoint } from './merge-tickets'
import { createSplitTicketEndpoint } from './split-ticket'
import { createTypingPostEndpoint, createTypingGetEndpoint } from './typing'
import { createPresencePostEndpoint, createPresenceGetEndpoint } from './presence'
import { createSettingsGetEndpoint, createSettingsPostEndpoint } from './settings'
import { createSignatureGetEndpoint, createSignaturePostEndpoint } from './signature'
import { createRoundRobinConfigGetEndpoint, createRoundRobinConfigPostEndpoint } from './round-robin-config'
import { createSlaCheckEndpoint } from './sla-check'
import { createAutoCloseEndpoint } from './auto-close'
import { createStatusesEndpoint } from './statuses'
import { createApplyMacroEndpoint } from './apply-macro'
import { createPurgeLogsEndpoint } from './purge-logs'
import { createChatbotEndpoint } from './chatbot'
import { createChatGetEndpoint, createChatPostEndpoint } from './chat'
import { createChatStreamEndpoint } from './chat-stream'
import { createAdminChatGetEndpoint, createAdminChatPostEndpoint } from './admin-chat'
import { createAdminChatStreamEndpoint } from './admin-chat-stream'
import { createAdminStatsEndpoint } from './admin-stats'
import { createBillingEndpoint } from './billing'
import { createEmailStatsEndpoint } from './email-stats'
import { createSatisfactionEndpoint } from './satisfaction'
import { createTrackOpenEndpoint } from './track-open'
import { createExportCsvEndpoint } from './export-csv'
import { createExportDataEndpoint } from './export-data'
import { createPendingEmailsProcessEndpoint } from './pending-emails-process'
import { createResendNotificationEndpoint } from './resend-notification'
import { createSeedKbEndpoint } from './seed-kb'
import { createLoginEndpoint } from './login'
import { createAuth2faEndpoint } from './auth-2fa'
import { createOAuthGoogleEndpoint, type OAuthGoogleOptions } from './oauth-google'
import { createDeleteAccountEndpoint } from './delete-account'
import { createMergeClientsEndpoint } from './merge-clients'
import { createImportConversationEndpoint } from './import-conversation'
import { createProcessScheduledEndpoint } from './process-scheduled'
import { createUserPrefsGetEndpoint, createUserPrefsPostEndpoint } from './user-prefs'

// Re-export all individual endpoint creators
export { createAiEndpoint } from './ai'
export { createSearchEndpoint } from './search'
export { createBulkActionEndpoint } from './bulk-action'
export { createMergeTicketsEndpoint } from './merge-tickets'
export { createSplitTicketEndpoint } from './split-ticket'
export { createTypingPostEndpoint, createTypingGetEndpoint } from './typing'
export { createPresencePostEndpoint, createPresenceGetEndpoint } from './presence'
export { createSettingsGetEndpoint, createSettingsPostEndpoint } from './settings'
export { createSignatureGetEndpoint, createSignaturePostEndpoint } from './signature'
export { createRoundRobinConfigGetEndpoint, createRoundRobinConfigPostEndpoint } from './round-robin-config'
export { createSlaCheckEndpoint } from './sla-check'
export { createAutoCloseEndpoint } from './auto-close'
export { createStatusesEndpoint } from './statuses'
export { createApplyMacroEndpoint } from './apply-macro'
export { createPurgeLogsEndpoint } from './purge-logs'
export { createChatbotEndpoint } from './chatbot'
export { createChatGetEndpoint, createChatPostEndpoint } from './chat'
export { createChatStreamEndpoint } from './chat-stream'
export { createAdminChatGetEndpoint, createAdminChatPostEndpoint } from './admin-chat'
export { createAdminChatStreamEndpoint } from './admin-chat-stream'
export { createAdminStatsEndpoint } from './admin-stats'
export { createBillingEndpoint } from './billing'
export { createEmailStatsEndpoint } from './email-stats'
export { createSatisfactionEndpoint } from './satisfaction'
export { createTrackOpenEndpoint } from './track-open'
export { createExportCsvEndpoint } from './export-csv'
export { createExportDataEndpoint } from './export-data'
export { createPendingEmailsProcessEndpoint } from './pending-emails-process'
export { createResendNotificationEndpoint } from './resend-notification'
export { createSeedKbEndpoint } from './seed-kb'
export { createLoginEndpoint } from './login'
export { createAuth2faEndpoint } from './auth-2fa'
export { createOAuthGoogleEndpoint } from './oauth-google'
export { createDeleteAccountEndpoint } from './delete-account'
export { createMergeClientsEndpoint } from './merge-clients'
export { createImportConversationEndpoint } from './import-conversation'
export { createProcessScheduledEndpoint } from './process-scheduled'
export { createUserPrefsGetEndpoint, createUserPrefsPostEndpoint } from './user-prefs'
export type { UserPrefs } from './user-prefs'

export interface SupportEndpointOptions {
  oauth?: OAuthGoogleOptions
  features?: Required<SupportFeatures>
}

/**
 * Create all support endpoints for the Payload plugin.
 * Returns an array of Endpoint objects to be registered via `endpoints` in the plugin config.
 * Endpoints are conditionally included based on feature flags.
 */
export function createSupportEndpoints(slugs: CollectionSlugs, options?: SupportEndpointOptions): Endpoint[] {
  const f = options?.features

  // Core endpoints (always present)
  const endpoints: Endpoint[] = [
    createSearchEndpoint(slugs),
    createSettingsGetEndpoint(slugs),
    createSettingsPostEndpoint(slugs),
    createAdminStatsEndpoint(slugs),
    createExportCsvEndpoint(slugs),
    createExportDataEndpoint(slugs),
    createSeedKbEndpoint(slugs),
    createLoginEndpoint(slugs),
    createAuth2faEndpoint(slugs),
    createOAuthGoogleEndpoint(slugs, options?.oauth),
    createDeleteAccountEndpoint(slugs),
    createMergeClientsEndpoint(slugs),
    createImportConversationEndpoint(slugs),
    createPurgeLogsEndpoint(slugs),
    createResendNotificationEndpoint(slugs),
    createUserPrefsGetEndpoint(slugs),
    createUserPrefsPostEndpoint(slugs),
  ]

  // Conditional endpoints based on feature flags
  if (!f || f.ai !== false) endpoints.push(createAiEndpoint(slugs))
  if (!f || f.bulkActions !== false) endpoints.push(createBulkActionEndpoint(slugs))
  if (!f || f.merge !== false) endpoints.push(createMergeTicketsEndpoint(slugs))
  if (!f || f.splitTicket !== false) endpoints.push(createSplitTicketEndpoint(slugs))
  if (!f || f.collisionDetection !== false) {
    endpoints.push(createTypingPostEndpoint(slugs), createTypingGetEndpoint(slugs))
    endpoints.push(createPresencePostEndpoint(slugs), createPresenceGetEndpoint(slugs))
  }
  if (!f || f.signatures !== false) {
    endpoints.push(createSignatureGetEndpoint(slugs), createSignaturePostEndpoint(slugs))
  }
  if (!f || f.sla !== false) endpoints.push(createSlaCheckEndpoint(slugs))
  if (!f || f.autoClose !== false) endpoints.push(createAutoCloseEndpoint(slugs))
  if (!f || f.customStatuses !== false) endpoints.push(createStatusesEndpoint(slugs))
  if (!f || f.macros !== false) endpoints.push(createApplyMacroEndpoint(slugs))
  if (!f || f.roundRobin !== false) {
    endpoints.push(createRoundRobinConfigGetEndpoint(slugs), createRoundRobinConfigPostEndpoint(slugs))
  }
  if (!f || f.chatbot !== false) endpoints.push(createChatbotEndpoint(slugs))
  if (!f || f.chat !== false) {
    endpoints.push(createChatGetEndpoint(slugs), createChatPostEndpoint(slugs))
    endpoints.push(createChatStreamEndpoint(slugs))
    endpoints.push(createAdminChatGetEndpoint(slugs), createAdminChatPostEndpoint(slugs))
    endpoints.push(createAdminChatStreamEndpoint(slugs))
  }
  if (!f || f.timeTracking !== false) endpoints.push(createBillingEndpoint(slugs))
  if (!f || f.satisfaction !== false) endpoints.push(createSatisfactionEndpoint(slugs))
  if (!f || f.emailTracking !== false) {
    endpoints.push(createEmailStatsEndpoint(slugs), createTrackOpenEndpoint(slugs))
  }
  if (!f || f.pendingEmails !== false) endpoints.push(createPendingEmailsProcessEndpoint(slugs))
  if (!f || f.scheduledReplies !== false) endpoints.push(createProcessScheduledEndpoint(slugs))

  return endpoints
}
