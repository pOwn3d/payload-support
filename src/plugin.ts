import type { Config, Plugin, AdminViewConfig } from 'payload'
import type { SupportPluginConfig, SupportFeatures } from './types'
import { DEFAULT_FEATURES } from './types'
import { resolveSlugs } from './utils/slugs'
import { createSupportEndpoints } from './endpoints'
import {
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

function viewConfig(component: string, path: string): AdminViewConfig {
  return { Component: component, path: path as `/${string}` }
}

/**
 * Payload CMS Support & Ticketing Plugin.
 *
 * Adds a complete support module with tickets, conversations, SLA,
 * time tracking, AI features, live chat, and much more.
 *
 * @example
 * ```ts
 * import { supportPlugin } from '@consilioweb/payload-support'
 *
 * export default buildConfig({
 *   plugins: [
 *     supportPlugin({
 *       features: { ai: true, timeTracking: true, sla: true },
 *       ai: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
 *       locale: 'fr',
 *     }),
 *   ],
 * })
 * ```
 */
export function supportPlugin(config?: SupportPluginConfig): Plugin {
  const features: Required<SupportFeatures> = {
    ...DEFAULT_FEATURES,
    ...config?.features,
  }

  const bp = config?.basePath || '/support'
  // Use compiled subpath exports (one file per view) — avoids webpack
  // issues with bundled 'use client' files from node_modules.
  const viewsBase = '@consilioweb/payload-support/views'
  const slugs = resolveSlugs({
    ...config?.collectionSlugs,
    users: config?.userCollectionSlug || 'users',
  })

  return (incomingConfig: Config): Config => {
    const existingCollections = incomingConfig.collections || []

    // ─── Collections ─────────────────────────────────────

    // Core collections (always present)
    const ticketOptions = {
      conversationComponent: config?.conversationComponent,
      projectCollectionSlug: config?.projectCollectionSlug,
      documentsCollectionSlug: config?.documentsCollectionSlug,
      notificationSlug: config?.notificationSlug,
    }
    const messageOptions = {
      notificationSlug: config?.notificationSlug,
    }
    const supportCollections = [
      createTicketsCollection(slugs, ticketOptions),
      createTicketMessagesCollection(slugs, messageOptions),
      createSupportClientsCollection(slugs),
      createCannedResponsesCollection(slugs),
      createTicketActivityLogCollection(slugs),
      createSatisfactionSurveysCollection(slugs),
      createKnowledgeBaseCollection(slugs),
    ]

    // Auth logs (conditional)
    if (features.authLogs !== false) supportCollections.push(createAuthLogsCollection(slugs))

    // Conditional collections based on feature flags
    if (features.timeTracking !== false) supportCollections.push(createTimeEntriesCollection(slugs))
    if (features.emailTracking !== false) supportCollections.push(createEmailLogsCollection(slugs))
    if (features.webhooks !== false) supportCollections.push(createWebhookEndpointsCollection(slugs))
    if (features.sla !== false) supportCollections.push(createSlaPoliciesCollection(slugs))
    if (features.macros !== false) supportCollections.push(createMacrosCollection(slugs))
    if (features.customStatuses !== false) supportCollections.push(createTicketStatusesCollection(slugs))
    if (features.chat) supportCollections.push(createChatMessagesCollection(slugs))
    if (features.pendingEmails) supportCollections.push(createPendingEmailsCollection(slugs))

    // ─── Admin Views ─────────────────────────────────────

    const existingViews =
      (incomingConfig.admin?.components?.views as Record<string, AdminViewConfig>) || {}

    const supportViews: Record<string, AdminViewConfig> = {
      'support-inbox': viewConfig(`${viewsBase}/TicketInboxView`, `${bp}/inbox`),
      'support-dashboard': viewConfig(`${viewsBase}/SupportDashboardView`, `${bp}/dashboard`),
      'support-ticket': viewConfig(`${viewsBase}/TicketDetailView`, `${bp}/ticket`),
      'support-new-ticket': viewConfig(`${viewsBase}/NewTicketView`, `${bp}/new-ticket`),
      'support-settings': viewConfig(`${viewsBase}/TicketingSettingsView`, `${bp}/settings`),
      'support-logs': viewConfig(`${viewsBase}/LogsView`, `${bp}/logs`),
      'support-crm': viewConfig(`${viewsBase}/CrmView`, `${bp}/crm`),
    }

    if (features.chat) {
      supportViews['support-chat'] = viewConfig(`${viewsBase}/ChatView`, `${bp}/chat`)
    }
    if (features.pendingEmails) {
      supportViews['support-emails'] = viewConfig(`${viewsBase}/PendingEmailsView`, `${bp}/emails`)
    }
    if (features.emailTracking) {
      supportViews['support-tracking'] = viewConfig(`${viewsBase}/EmailTrackingView`, `${bp}/tracking`)
    }
    if (features.timeTracking) {
      supportViews['support-time'] = viewConfig(`${viewsBase}/TimeDashboardView`, `${bp}/time`)
    }

    // ─── Endpoints ───────────────────────────────────────

    const existingEndpoints = incomingConfig.endpoints || []
    const supportEndpoints = createSupportEndpoints(slugs, {
      oauth: { allowedEmailDomains: config?.allowedEmailDomains },
      features,
    })

    return {
      ...incomingConfig,
      collections: config?.skipCollections
        ? existingCollections
        : [...existingCollections, ...supportCollections],
      endpoints: config?.skipEndpoints
        ? existingEndpoints
        : [...existingEndpoints, ...supportEndpoints],
      admin: {
        ...incomingConfig.admin,
        components: {
          ...incomingConfig.admin?.components,
          views: config?.skipViews
            ? existingViews
            : { ...existingViews, ...supportViews },
        },
      },
    }
  }
}
