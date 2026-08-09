export { readSupportSettings, readSupportSettingsState, mergeSupportSettings, invalidateSupportSettingsCache, DEFAULT_SETTINGS } from './readSettings'
export type { SupportSettings, SupportSettingsState } from './readSettings'
export { DEFAULT_TICKETING_FEATURES, normalizeFeatures, projectAutoClose, stripProjectedFeatures } from './features'
export type { TicketingFeatures } from './features'
export { resolveSlugs, DEFAULT_SLUGS } from './slugs'
export type { CollectionSlugs } from './slugs'
export { RateLimiter } from './rateLimiter'
export { AuthError, requireAdmin, requireClient, handleAuthError } from './auth'
export { fireWebhooks } from './fireWebhooks'
export { createAdminNotification } from './adminNotification'
export { dispatchWebhook } from './webhookDispatcher'

export {
  escapeHtml,
  emailTrackingPixel,
  emailRichContent,
  emailButton,
  emailQuote,
  emailInfoRow,
  emailParagraph,
  emailWrapper,
  createEmailTemplateFactory,
} from './emailTemplate'
export type { EmailTemplateConfig, EmailTemplateFactory } from './emailTemplate'
