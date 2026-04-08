export { resolveSlugs, DEFAULT_SLUGS } from './slugs'
export type { CollectionSlugs } from './slugs'
export { RateLimiter } from './rateLimiter'
export { AuthError, requireAdmin, requireClient, handleAuthError } from './auth'
export { fireWebhooks } from './fireWebhooks'

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
