import type { Config, Plugin, AdminViewConfig, PayloadRequest } from 'payload'
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
  createClientSummariesCollection,
  createTicketFeedbackCollection,
  createTicketCollaboratorsCollection,
  createNotificationQueueCollection,
  createAutomationRulesCollection,
  createSupportTeamCollection,
  createPushSubscriptionCollection,
  createSupportRateLimitsCollection,
  createSupportCountersCollection,
} from './collections'
import { PayloadRateLimitStore } from './utils/rateLimiter'
import { DEFAULT_RETENTION, PURGE_LOGS_TASK_SLUG, runScheduledPurge } from './utils/retention'
import { SUPPORT_STAFF_SLUG_CONFIG_KEY } from './utils/readSettings'

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
  const rateLimitStore = config?.rateLimitStore === 'payload'
    ? new PayloadRateLimitStore(slugs.rateLimits)
    : config?.rateLimitStore

  return (incomingConfig: Config): Config => {
    const existingCollections = incomingConfig.collections || []

    // ─── Collections ─────────────────────────────────────

    // Core collections (always present)
    const ticketOptions = {
      conversationComponent: config?.conversationComponent,
      projectCollectionSlug: config?.projectCollectionSlug,
      documentsCollectionSlug: config?.documentsCollectionSlug,
      notificationSlug: config?.notificationSlug,
      ticketNumber: config?.ticketNumber,
      capabilities: config?.capabilities,
    }
    const messageOptions = {
      notificationSlug: config?.notificationSlug,
      capabilities: config?.capabilities,
    }
    const supportCollections = [
      createTicketsCollection(slugs, ticketOptions),
      createTicketMessagesCollection(slugs, messageOptions),
      createSupportClientsCollection(slugs, { capabilities: config?.capabilities }),
      createCannedResponsesCollection(slugs),
      createTicketActivityLogCollection(slugs),
      createSatisfactionSurveysCollection(slugs),
      createKnowledgeBaseCollection(slugs),
      createTicketFeedbackCollection(slugs, { notificationSlug: config?.notificationSlug }),
      createTicketCollaboratorsCollection(slugs),
      createNotificationQueueCollection(slugs),
      createAutomationRulesCollection(slugs),
      createSupportTeamCollection(slugs),
      createPushSubscriptionCollection(slugs),
      createSupportCountersCollection(slugs.counters),
    ]
    if (config?.rateLimitStore === 'payload') {
      supportCollections.push(createSupportRateLimitsCollection(slugs.rateLimits))
    }

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
    if (features.ai !== false) supportCollections.push(createClientSummariesCollection(slugs))

    // ─── Admin Views ─────────────────────────────────────

    const existingViews =
      (incomingConfig.admin?.components?.views as Record<string, AdminViewConfig>) || {}

    const supportViews: Record<string, AdminViewConfig> = {
      'support-inbox': viewConfig(`${viewsBase}#TicketInboxView`, `${bp}/inbox`),
      'support-dashboard': viewConfig(`${viewsBase}#SupportDashboardView`, `${bp}/dashboard`),
      'support-ticket': viewConfig(`${viewsBase}#TicketDetailView`, `${bp}/ticket`),
      'support-new-ticket': viewConfig(`${viewsBase}#NewTicketView`, `${bp}/new-ticket`),
      'support-settings': viewConfig(`${viewsBase}#TicketingSettingsView`, `${bp}/settings`),
      'support-logs': viewConfig(`${viewsBase}#LogsView`, `${bp}/logs`),
      'support-crm': viewConfig(`${viewsBase}#CrmView`, `${bp}/crm`),
      'support-billing': viewConfig(`${viewsBase}#BillingView`, `${bp}/billing`),
      'support-import': viewConfig(`${viewsBase}#ImportConversationView`, `/import-conversation`),
    }

    if (features.chat) {
      supportViews['support-chat'] = viewConfig(`${viewsBase}#ChatView`, `${bp}/chat`)
    }
    if (features.pendingEmails) {
      supportViews['support-emails'] = viewConfig(`${viewsBase}#PendingEmailsView`, `${bp}/emails`)
    }
    if (features.emailTracking) {
      supportViews['support-tracking'] = viewConfig(`${viewsBase}#EmailTrackingView`, `${bp}/tracking`)
    }
    if (features.timeTracking) {
      supportViews['support-time'] = viewConfig(`${viewsBase}#TimeDashboardView`, `${bp}/time`)
    }

    // ─── Endpoints ───────────────────────────────────────

    const existingEndpoints = incomingConfig.endpoints || []
    const supportEndpoints = createSupportEndpoints(slugs, {
      oauth: { allowedEmailDomains: config?.allowedEmailDomains },
      features,
      rateLimitStore,
      capabilities: config?.capabilities,
    })

    // ─── Retention job ───────────────────────────────────
    //
    // `DELETE /api/support/purge-logs` existed but nothing ever called it, so
    // the two journals grew forever — a retention policy nobody applies is not
    // a retention policy. This registers a daily Payload Jobs task instead of
    // a setInterval: an interval does not survive a serverless deploy and runs
    // N times in parallel behind N instances.
    // The task is OPT-IN: nothing is registered unless `retention` is set.
    //
    // Registering it by default was tempting — a retention policy nobody opts
    // into is how the manual purge endpoint ended up never being called. But
    // declaring a task turns Payload's job queue on, which adds `payload-jobs`
    // and `payload-jobs-stats` to an app that had none: two tables, i.e. a
    // schema change imposed on every consumer of a *support* plugin, by a minor
    // release. And it would buy them nothing, because a scheduled task only
    // fires when the host also runs a job runner (`payload jobs:run`, a cron,
    // or `jobs.autoRun`). Defaulting it on therefore costs two tables and
    // delivers no purge until the integrator does the other half of the work
    // anyway — at which point they can just as well pass `retention`.
    //
    // The README states the trade-off where the option is documented, so the
    // choice is visible rather than silent. `admin-ui-pro` made the same call
    // for the same reason.
    const retention = config?.retention === false ? undefined : config?.retention
    const retentionEnabled = Boolean(retention)
    const purgeTask = {
      slug: PURGE_LOGS_TASK_SLUG,
      label: 'Support — purge des journaux',
      schedule: [
        {
          cron: retention?.cron ?? DEFAULT_RETENTION.cron,
          queue: retention?.queue ?? DEFAULT_RETENTION.queue,
        },
      ],
      handler: async ({ req }: { req: PayloadRequest }) => {
        const result = await runScheduledPurge(req.payload, slugs, retention, req)
        return { output: result }
      },
    }

    const existingJobs = incomingConfig.jobs
    const jobs = retentionEnabled
      ? ({
        ...existingJobs,
        tasks: [...(existingJobs?.tasks ?? []), purgeTask],
      } as Config['jobs'])
      : existingJobs

    return {
      ...incomingConfig,
      jobs,
      // Publish the resolved staff collection so the server-side readers share
      // ONE source of truth with the writers. `requireAdmin` compares against
      // `slugs.users`; the `payload-preferences` reads used to scope themselves
      // on `config.admin.user`, which Payload silently defaults to the first
      // auth collection of the host app — a different collection on any app
      // that declares `collectionSlugs.users`, and the settings-poisoning hole
      // reopened right there.
      custom: {
        ...incomingConfig.custom,
        [SUPPORT_STAFF_SLUG_CONFIG_KEY]: slugs.users,
      },
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
