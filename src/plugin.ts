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
  const pkg = '@consilioweb/payload-support/views'
  const slugs = resolveSlugs({
    ...config?.collectionSlugs,
    users: config?.userCollectionSlug || 'users',
  })

  return (incomingConfig: Config): Config => {
    const existingCollections = incomingConfig.collections || []

    // ─── Collections ─────────────────────────────────────

    const supportCollections = [
      createTicketsCollection(slugs),
      createTicketMessagesCollection(slugs),
      createSupportClientsCollection(slugs),
      createTimeEntriesCollection(slugs),
      createCannedResponsesCollection(slugs),
      createTicketActivityLogCollection(slugs),
      createSatisfactionSurveysCollection(slugs),
      createKnowledgeBaseCollection(slugs),
      createEmailLogsCollection(slugs),
      createAuthLogsCollection(slugs),
      createWebhookEndpointsCollection(slugs),
      createSlaPoliciesCollection(slugs),
      createMacrosCollection(slugs),
      createTicketStatusesCollection(slugs),
    ]

    // Conditional collections based on features
    if (features.chat) {
      supportCollections.push(createChatMessagesCollection(slugs))
    }
    if (features.pendingEmails) {
      supportCollections.push(createPendingEmailsCollection(slugs))
    }

    // ─── Admin Views ─────────────────────────────────────

    const existingViews =
      (incomingConfig.admin?.components?.views as Record<string, AdminViewConfig>) || {}

    const supportViews: Record<string, AdminViewConfig> = {
      'support-inbox': viewConfig(`${pkg}#TicketInboxView`, `${bp}/inbox`),
      'support-dashboard': viewConfig(`${pkg}#SupportDashboardView`, `${bp}/dashboard`),
      'support-ticket': viewConfig(`${pkg}#TicketDetailView`, `${bp}/ticket`),
      'support-new-ticket': viewConfig(`${pkg}#NewTicketView`, `${bp}/new-ticket`),
      'support-settings': viewConfig(`${pkg}#TicketingSettingsView`, `${bp}/settings`),
      'support-logs': viewConfig(`${pkg}#LogsView`, `${bp}/logs`),
      'support-crm': viewConfig(`${pkg}#CrmView`, `${bp}/crm`),
    }

    if (features.chat) {
      supportViews['support-chat'] = viewConfig(`${pkg}#ChatView`, `${bp}/chat`)
    }
    if (features.pendingEmails) {
      supportViews['support-emails'] = viewConfig(`${pkg}#PendingEmailsView`, `${bp}/emails`)
    }
    if (features.emailTracking) {
      supportViews['support-tracking'] = viewConfig(`${pkg}#EmailTrackingView`, `${bp}/tracking`)
    }
    if (features.timeTracking) {
      supportViews['support-time'] = viewConfig(`${pkg}#TimeDashboardView`, `${bp}/time`)
    }

    // ─── Endpoints ───────────────────────────────────────

    const existingEndpoints = incomingConfig.endpoints || []
    const supportEndpoints = createSupportEndpoints(slugs)

    return {
      ...incomingConfig,
      collections: [
        ...existingCollections,
        ...supportCollections,
      ],
      endpoints: [
        ...existingEndpoints,
        ...supportEndpoints,
      ],
      admin: {
        ...incomingConfig.admin,
        components: {
          ...incomingConfig.admin?.components,
          views: {
            ...existingViews,
            ...supportViews,
          },
        },
      },
    }
  }
}
