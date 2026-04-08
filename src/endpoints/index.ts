import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

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
import { createAdminChatGetEndpoint, createAdminChatPostEndpoint } from './admin-chat'
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
export { createAdminChatGetEndpoint, createAdminChatPostEndpoint } from './admin-chat'
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

export interface SupportEndpointOptions {
  oauth?: OAuthGoogleOptions
}

/**
 * Create all support endpoints for the Payload plugin.
 * Returns an array of Endpoint objects to be registered via `endpoints` in the plugin config.
 */
export function createSupportEndpoints(slugs: CollectionSlugs, options?: SupportEndpointOptions): Endpoint[] {
  return [
    createAiEndpoint(slugs),
    createSearchEndpoint(slugs),
    createBulkActionEndpoint(slugs),
    createMergeTicketsEndpoint(slugs),
    createSplitTicketEndpoint(slugs),
    createTypingPostEndpoint(slugs),
    createTypingGetEndpoint(slugs),
    createPresencePostEndpoint(slugs),
    createPresenceGetEndpoint(slugs),
    createSettingsGetEndpoint(slugs),
    createSettingsPostEndpoint(slugs),
    createSignatureGetEndpoint(slugs),
    createSignaturePostEndpoint(slugs),
    createSlaCheckEndpoint(slugs),
    createAutoCloseEndpoint(slugs),
    createStatusesEndpoint(slugs),
    createApplyMacroEndpoint(slugs),
    createRoundRobinConfigGetEndpoint(slugs),
    createRoundRobinConfigPostEndpoint(slugs),
    createPurgeLogsEndpoint(slugs),
    createChatbotEndpoint(slugs),
    createChatGetEndpoint(slugs),
    createChatPostEndpoint(slugs),
    createAdminChatGetEndpoint(slugs),
    createAdminChatPostEndpoint(slugs),
    createAdminStatsEndpoint(slugs),
    createBillingEndpoint(slugs),
    createSatisfactionEndpoint(slugs),
    createEmailStatsEndpoint(slugs),
    createTrackOpenEndpoint(slugs),
    createExportCsvEndpoint(slugs),
    createExportDataEndpoint(slugs),
    createPendingEmailsProcessEndpoint(slugs),
    createResendNotificationEndpoint(slugs),
    createSeedKbEndpoint(slugs),
    createLoginEndpoint(slugs),
    createAuth2faEndpoint(slugs),
    createOAuthGoogleEndpoint(slugs, options?.oauth),
    createDeleteAccountEndpoint(slugs),
    createMergeClientsEndpoint(slugs),
    createImportConversationEndpoint(slugs),
  ]
}
