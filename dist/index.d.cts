import { Plugin, Payload, BasePayload, CollectionAfterChangeHook, CollectionConfig } from 'payload';

interface SupportFeatures {
    /** Time tracking: timer, manual entries, billing */
    timeTracking?: boolean;
    /** AI features: sentiment, synthesis, suggestion, rewrite */
    ai?: boolean;
    /** Satisfaction surveys: CSAT rating after resolution */
    satisfaction?: boolean;
    /** Live chat integration: chat → ticket conversion */
    chat?: boolean;
    /** Email tracking: pixel tracking, open/sent status per message */
    emailTracking?: boolean;
    /** Canned responses: quick reply templates */
    canned?: boolean;
    /** Ticket merge: combine two tickets into one */
    merge?: boolean;
    /** Snooze: temporarily hide a ticket */
    snooze?: boolean;
    /** External messages: add messages received outside the system */
    externalMessages?: boolean;
    /** Client history: past tickets, projects, notes sidebar */
    clientHistory?: boolean;
    /** Activity log: audit trail of actions on the ticket */
    activityLog?: boolean;
    /** Split ticket: extract a message into a new ticket */
    splitTicket?: boolean;
    /** Scheduled replies: send a message at a future date */
    scheduledReplies?: boolean;
    /** Auto-close: automatically resolve inactive tickets */
    autoClose?: boolean;
    /** Auto-close delay in days */
    autoCloseDays?: number;
    /** Round-robin: distribute new tickets evenly among agents */
    roundRobin?: boolean;
    /** SLA policies: response & resolution time targets */
    sla?: boolean;
    /** Webhooks: outbound HTTP hooks on ticket events */
    webhooks?: boolean;
    /** Macros: multi-action shortcuts */
    macros?: boolean;
    /** Custom statuses: configurable ticket statuses */
    customStatuses?: boolean;
    /** Collision detection: warn when multiple agents view same ticket */
    collisionDetection?: boolean;
    /** Per-agent email signatures */
    signatures?: boolean;
    /** AI chatbot for self-service */
    chatbot?: boolean;
    /** Bulk actions on multiple tickets */
    bulkActions?: boolean;
    /** Command palette (⌘K) */
    commandPalette?: boolean;
    /** Knowledge base / FAQ */
    knowledgeBase?: boolean;
    /** Pending email queue */
    pendingEmails?: boolean;
    /** Authentication audit logs */
    authLogs?: boolean;
}
interface AIProviderConfig {
    provider: 'anthropic' | 'openai' | 'ollama' | 'custom';
    apiKey?: string;
    model?: string;
    baseUrl?: string;
}
interface EmailConfig {
    fromAddress?: string;
    fromName?: string;
    replyTo?: string;
}
interface SupportPluginConfig {
    /** Enable/disable individual features (all enabled by default) */
    features?: SupportFeatures;
    /** AI provider configuration */
    ai?: AIProviderConfig;
    /** Email configuration for ticket notifications */
    email?: EmailConfig;
    /** Locale: 'fr' or 'en' (default: 'fr') */
    locale?: 'fr' | 'en';
    /** Nav group label in Payload admin sidebar */
    navGroup?: string;
    /** Base path for admin views (default: '/support') */
    basePath?: string;
    /** User collection slug for agent relationships (default: 'users') */
    userCollectionSlug?: string;
    /**
     * Restrict Google OAuth auto-registration to specific email domains.
     * When set and non-empty, only emails matching one of these domains can
     * create an account via OAuth. Existing accounts are unaffected.
     * Example: ['acme.com', 'partner.org']
     */
    allowedEmailDomains?: string[];
    /** Skip injecting collections (use your own custom collections) */
    skipCollections?: boolean;
    /** Skip injecting admin views (use your own custom views) */
    skipViews?: boolean;
    /** Skip injecting endpoints (use your own custom API routes) */
    skipEndpoints?: boolean;
    /** Collection slug overrides */
    collectionSlugs?: {
        tickets?: string;
        ticketMessages?: string;
        supportClients?: string;
        timeEntries?: string;
        cannedResponses?: string;
        ticketActivityLog?: string;
        satisfactionSurveys?: string;
        knowledgeBase?: string;
        chatMessages?: string;
        pendingEmails?: string;
        emailLogs?: string;
        authLogs?: string;
        webhookEndpoints?: string;
        slaPolicies?: string;
        macros?: string;
        ticketStatuses?: string;
    };
    /** Admin notification collection slug (default: 'admin-notifications') */
    notificationSlug?: string;
    /** Custom component path for ticket conversation UI field */
    conversationComponent?: string;
    /** Project collection slug — adds a project relationship to tickets (optional) */
    projectCollectionSlug?: string;
    /** Documents upload collection slug — adds quote/invoice upload fields to tickets (optional) */
    documentsCollectionSlug?: string;
}
interface TicketData {
    id: number | string;
    ticketNumber: string;
    subject: string;
    status: string;
    priority: string;
    category?: string;
    client?: number | string;
    assignedTo?: number | string;
    totalTimeMinutes?: number;
    createdAt: string;
    updatedAt: string;
}
interface MessageData {
    id: number | string;
    ticket: number | string;
    body: string;
    bodyHtml?: string;
    authorType: 'admin' | 'client' | 'email';
    isInternal?: boolean;
    attachments?: Array<{
        file: number | string;
    }>;
    createdAt: string;
}
interface TimeEntryData {
    id: number | string;
    ticket: number | string;
    minutes: number;
    description?: string;
    date: string;
}
interface ClientData {
    id: number | string;
    email: string;
    firstName: string;
    lastName: string;
    company?: string;
    phone?: string;
}
interface CannedResponseData {
    id: number | string;
    title: string;
    body: string;
    category?: string;
}
interface ActivityEntryData {
    id: number | string;
    ticket: number | string;
    action: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    actorType: 'admin' | 'client' | 'system';
    actorEmail?: string;
    createdAt: string;
}
interface SatisfactionSurveyData {
    id: number | string;
    ticket: number | string;
    client: number | string;
    rating: number;
    comment?: string;
}
declare const DEFAULT_FEATURES: Required<SupportFeatures>;

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
declare function supportPlugin(config?: SupportPluginConfig): Plugin;

/**
 * Default collection slugs used by the support plugin.
 * All slugs can be overridden via SupportPluginConfig.collectionSlugs.
 */
interface CollectionSlugs {
    tickets: string;
    ticketMessages: string;
    supportClients: string;
    timeEntries: string;
    cannedResponses: string;
    ticketActivityLog: string;
    satisfactionSurveys: string;
    knowledgeBase: string;
    chatMessages: string;
    pendingEmails: string;
    emailLogs: string;
    authLogs: string;
    webhookEndpoints: string;
    slaPolicies: string;
    macros: string;
    ticketStatuses: string;
    users: string;
    media: string;
}
declare const DEFAULT_SLUGS: CollectionSlugs;
/**
 * Resolve collection slugs merging user overrides with defaults.
 */
declare function resolveSlugs(overrides?: Partial<CollectionSlugs>): CollectionSlugs;

interface SupportSettings {
    email: {
        fromAddress: string;
        fromName: string;
        replyToAddress: string;
    };
    ai: {
        provider: string;
        model: string;
        enableSentiment: boolean;
        enableSynthesis: boolean;
        enableSuggestion: boolean;
        enableRewrite: boolean;
    };
    sla: {
        firstResponseMinutes: number;
        resolutionMinutes: number;
        businessHoursOnly: boolean;
        escalationEmail: string;
    };
    autoClose: {
        enabled: boolean;
        daysBeforeClose: number;
        reminderDaysBefore: number;
    };
}
interface UserPrefs {
    locale: 'fr' | 'en';
    signature: string;
}
declare const DEFAULT_SETTINGS: SupportSettings;
declare const DEFAULT_USER_PREFS: UserPrefs;
declare function readSupportSettings(payload: Payload): Promise<SupportSettings>;
declare function readUserPrefs(payload: Payload, userId: string | number): Promise<UserPrefs>;

/**
 * Helper to create an admin notification.
 * Can be called from any hook or endpoint.
 *
 * @param payload - Payload instance
 * @param data - Notification data
 * @param collectionSlug - Override collection slug (default: 'admin-notifications')
 */
declare function createAdminNotification(payload: Payload, data: {
    title: string;
    message?: string;
    type: 'info' | 'new_ticket' | 'client_message' | 'quote_request' | 'urgent_ticket' | 'post_published' | 'satisfaction' | 'sla_alert';
    link?: string;
    recipient?: number | string;
}, collectionSlug?: string): Promise<void>;

type WebhookEvent = 'ticket_created' | 'ticket_resolved' | 'ticket_replied' | 'sla_breached';
/**
 * Dispatch outbound webhooks for a given event.
 * Fetches all active webhook endpoints matching the event,
 * POSTs JSON to each with optional HMAC-SHA256 signature.
 * Fire-and-forget: errors are logged but never thrown.
 *
 * @param data - Payload data to send
 * @param event - Webhook event type
 * @param payload - Payload instance
 * @param slugs - Collection slugs for dynamic collection references
 */
declare function dispatchWebhook(data: Record<string, unknown>, event: WebhookEvent, payload: BasePayload, slugs: CollectionSlugs): void;

/**
 * Calculate a business-hours deadline from a start date.
 * Business hours: Mon-Fri, 9:00-18:00 (Europe/Paris).
 * @param start - start date
 * @param minutes - number of business-hour minutes to add
 * @returns deadline date
 */
declare function calculateBusinessHoursDeadline(start: Date, minutes: number): Date;
/**
 * Factory: Assign SLA deadlines when a ticket is created or SLA policy changes.
 * Runs as afterChange on tickets collection.
 */
declare function createAssignSlaDeadlines(slugs: CollectionSlugs, notificationSlug?: string): CollectionAfterChangeHook;
/**
 * Factory: Check SLA resolution breach when ticket is resolved.
 * Runs as afterChange on tickets collection.
 */
declare function createCheckSlaOnResolve(slugs: CollectionSlugs, notificationSlug?: string): CollectionAfterChangeHook;
/**
 * Factory: Check SLA breach on first admin response.
 * Runs as afterChange on ticket-messages collection.
 */
declare function createCheckSlaOnReply(slugs: CollectionSlugs, notificationSlug?: string): CollectionAfterChangeHook;

/**
 * Factory: Send email notification to the client when a ticket is created
 * or when its status changes to `waiting_client`.
 *
 * Note: Resolved notifications are handled by the existing
 * `notifyClientOnResolve` hook, so this hook skips those transitions.
 */
declare function createTicketStatusEmail(slugs: CollectionSlugs): CollectionAfterChangeHook;

declare function createTicketsCollection(slugs: CollectionSlugs, options?: {
    conversationComponent?: string;
    projectCollectionSlug?: string;
    documentsCollectionSlug?: string;
    notificationSlug?: string;
}): CollectionConfig;

declare function createTicketMessagesCollection(slugs: CollectionSlugs, options?: {
    notificationSlug?: string;
}): CollectionConfig;

declare function createSupportClientsCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createTimeEntriesCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createCannedResponsesCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createTicketActivityLogCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createSatisfactionSurveysCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createKnowledgeBaseCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createChatMessagesCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createPendingEmailsCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createEmailLogsCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createAuthLogsCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createWebhookEndpointsCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createSlaPoliciesCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createMacrosCollection(slugs: CollectionSlugs): CollectionConfig;

declare function createTicketStatusesCollection(slugs: CollectionSlugs): CollectionConfig;

export { type AIProviderConfig, type ActivityEntryData, type CannedResponseData, type ClientData, type CollectionSlugs, DEFAULT_FEATURES, DEFAULT_SETTINGS, DEFAULT_SLUGS, DEFAULT_USER_PREFS, type EmailConfig, type MessageData, type SatisfactionSurveyData, type SupportFeatures, type SupportPluginConfig, type SupportSettings, type TicketData, type TimeEntryData, type UserPrefs, calculateBusinessHoursDeadline, createAdminNotification, createAssignSlaDeadlines, createAuthLogsCollection, createCannedResponsesCollection, createChatMessagesCollection, createCheckSlaOnReply, createCheckSlaOnResolve, createEmailLogsCollection, createKnowledgeBaseCollection, createMacrosCollection, createPendingEmailsCollection, createSatisfactionSurveysCollection, createSlaPoliciesCollection, createSupportClientsCollection, createTicketActivityLogCollection, createTicketMessagesCollection, createTicketStatusEmail, createTicketStatusesCollection, createTicketsCollection, createTimeEntriesCollection, createWebhookEndpointsCollection, dispatchWebhook, readSupportSettings, readUserPrefs, resolveSlugs, supportPlugin };
