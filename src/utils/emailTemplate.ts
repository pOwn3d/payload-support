/**
 * Professional B2B email template system
 * Configurable branding, colors, and layout
 * Tone: Professional, responsive email design
 */

// ─── Configuration ───────────────────────────────────────────────────

export interface EmailTemplateConfig {
  brandName?: string
  brandColor?: string // primary accent color (hex)
  secondaryColor?: string // secondary accent color (hex)
  accentColor?: string // tertiary accent color (hex)
  logoUrl?: string
  supportEmail?: string
  websiteUrl?: string
  phone?: string
  location?: string
  /** Short brand initials shown in header badge (e.g. "CW", "AB") */
  brandInitials?: string
}

const DEFAULT_CONFIG: Required<EmailTemplateConfig> = {
  brandName: 'Support',
  brandColor: '#00E5FF',
  secondaryColor: '#FFD600',
  accentColor: '#FF8A00',
  logoUrl: '',
  supportEmail: process.env.SUPPORT_EMAIL || '',
  websiteUrl: process.env.NEXT_PUBLIC_SERVER_URL || '',
  phone: '',
  location: '',
  brandInitials: '',
}

function resolveConfig(config?: EmailTemplateConfig): Required<EmailTemplateConfig> {
  return { ...DEFAULT_CONFIG, ...config }
}

// ─── Brand-agnostic utilities ────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Tracking pixel for email open detection
 * Inserts a 1x1 transparent GIF that triggers /api/support/track-open
 */
export function emailTrackingPixel(ticketId: number | string, messageId?: number | string, baseUrl?: string): string {
  const url = baseUrl || process.env.NEXT_PUBLIC_SERVER_URL || ''
  const params = `t=${ticketId}${messageId ? `&m=${messageId}` : ''}`
  return `<img src="${url}/api/support/track-open?${params}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
}

/**
 * Convert WYSIWYG HTML to email-safe HTML with inline styles.
 * Handles blockquotes, images, links, lists, and paragraphs.
 */
export function emailRichContent(html: string, config?: EmailTemplateConfig): string {
  const c = resolveConfig(config)
  const baseUrl = c.websiteUrl

  // Helper: replace tag with inline-styled version (strips existing style)
  function styleTag(input: string, tag: string, style: string): string {
    const regex = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi')
    return input.replace(regex, (_match, attrs) => {
      const cleanAttrs = (attrs || '').replace(/\s*style="[^"]*"/g, '')
      return `<${tag}${cleanAttrs} style="${style}">`
    })
  }

  let result = html
    // Make relative image URLs absolute
    .replace(/src="\/([^"]+)"/g, `src="${baseUrl}/$1"`)

  // Apply inline styles to elements
  result = styleTag(result, 'blockquote', `border-left: 4px solid ${c.brandColor}; margin: 16px 0; padding: 12px 20px; background: #f0f9fa; border-radius: 0 8px 8px 0;`)
  result = styleTag(result, 'img', 'max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block;')
  result = styleTag(result, 'a', `color: ${c.brandColor}; text-decoration: underline; font-weight: 600;`)
  result = styleTag(result, 'ul', 'margin: 8px 0; padding-left: 24px;')
  result = styleTag(result, 'ol', 'margin: 8px 0; padding-left: 24px;')
  result = styleTag(result, 'li', 'margin: 4px 0; line-height: 1.6;')
  result = styleTag(result, 'p', 'margin: 0 0 12px 0; line-height: 1.75; font-size: 15px; color: #1f2937;')

  // Strip dangerous content
  result = result
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')

  return `<div style="font-size: 15px; line-height: 1.75; color: #1f2937;">${result}</div>`
}

// ─── Configurable email components ───────────────────────────────────

type ButtonColor = 'primary' | 'secondary' | 'dark'

function getButtonColors(config: Required<EmailTemplateConfig>): Record<ButtonColor, { bg: string; text: string; border: string }> {
  return {
    primary: { bg: config.brandColor, text: '#000000', border: '#000000' },
    secondary: { bg: config.secondaryColor, text: '#000000', border: '#000000' },
    dark: { bg: '#000000', text: '#FFFFFF', border: '#000000' },
  }
}

/**
 * Generate a CTA button for emails
 */
export function emailButton(text: string, url: string, color: ButtonColor = 'primary', config?: EmailTemplateConfig): string {
  const c = resolveConfig(config)
  const colors = getButtonColors(c)
  const bc = colors[color]
  return `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; padding: 16px 40px; background: ${bc.bg}; color: ${bc.text}; font-weight: 800; font-size: 15px; text-decoration: none; border-radius: 10px; border: 2px solid ${bc.border}; letter-spacing: 0.02em;">
        ${text}
      </a>
    </div>
  `
}

/**
 * Quote block for message previews
 */
export function emailQuote(content: string, borderColor?: string, config?: EmailTemplateConfig): string {
  const c = resolveConfig(config)
  const color = borderColor || c.brandColor
  return `
    <div style="margin: 24px 0; padding: 20px 24px; background: #f8f9fa; border-left: 4px solid ${color}; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.75; color: #333333; white-space: pre-wrap;">${escapeHtml(content)}</p>
    </div>
  `
}

/**
 * Info row (label: value) for structured data in emails
 */
export function emailInfoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 0; font-size: 14px; font-weight: 700; color: #333333; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.03em; font-size: 12px;">${escapeHtml(label)}</td>
      <td style="padding: 8px 0; font-size: 15px; color: #1f2937; line-height: 1.5;">${value}</td>
    </tr>
  `
}

/**
 * Paragraph helper with professional styling
 */
export function emailParagraph(text: string): string {
  return `<p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.75; color: #1f2937;">${text}</p>`
}

/**
 * Generate the professional footer
 */
function emailFooter(config: Required<EmailTemplateConfig>): string {
  const logoHtml = config.logoUrl
    ? `<a href="${config.websiteUrl}">
            <img src="${config.logoUrl}" alt="${escapeHtml(config.brandName)}" width="100" height="47" style="display: block; border: 0;" />
          </a>`
    : `<a href="${config.websiteUrl}" style="font-size: 18px; font-weight: 900; color: #000000; text-decoration: none;">${escapeHtml(config.brandName)}</a>`

  const contactParts: string[] = []
  if (config.supportEmail) {
    contactParts.push(`<a href="mailto:${config.supportEmail}" style="color: #555555; text-decoration: none;">${config.supportEmail}</a>`)
  }
  if (config.phone) {
    contactParts.push(`<a href="tel:${config.phone.replace(/\s/g, '')}" style="color: #555555; text-decoration: none;">${config.phone}</a>`)
  }

  const locationParts: string[] = []
  if (config.websiteUrl) {
    const displayUrl = config.websiteUrl.replace(/^https?:\/\//, '')
    locationParts.push(`<a href="${config.websiteUrl}" style="color: ${config.brandColor}; text-decoration: none; font-weight: 600;">${displayUrl}</a>`)
  }
  if (config.location) {
    locationParts.push(config.location)
  }

  const unsubscribeHtml = config.supportEmail
    ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #aaaaaa; line-height: 1.4;">
            <a href="mailto:${config.supportEmail}?subject=Unsubscribe" style="color: #aaaaaa; text-decoration: underline;">Se d&eacute;sinscrire</a>
          </p>`
    : ''

  return `
    <!-- Spacer -->
    <div style="height: 24px;"></div>

    <!-- Tricolor separator -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td width="50%" height="3" bgcolor="${config.brandColor}" style="font-size:1px;line-height:1px;">&nbsp;</td>
        <td width="25%" height="3" bgcolor="${config.secondaryColor}" style="font-size:1px;line-height:1px;">&nbsp;</td>
        <td width="25%" height="3" bgcolor="${config.accentColor}" style="font-size:1px;line-height:1px;">&nbsp;</td>
      </tr>
    </table>

    <!-- Footer -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td width="120" valign="top" style="padding-right: 16px;">
          ${logoHtml}
        </td>
        <td valign="top">
          <p style="margin: 0; font-size: 14px; font-weight: 800; color: #000000; letter-spacing: 0.01em;">${escapeHtml(config.brandName)}</p>
          ${contactParts.length > 0 ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #555555; line-height: 1.5;">${contactParts.join(' &nbsp;&middot;&nbsp; ')}</p>` : ''}
          ${locationParts.length > 0 ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #888888; line-height: 1.4;">${locationParts.join(' &nbsp;&middot;&nbsp; ')}</p>` : ''}
          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  `
}

interface EmailOptions {
  /** Header background color variant */
  headerColor?: 'primary' | 'secondary'
  /** Preheader text (hidden preview in email clients) */
  preheader?: string
}

/**
 * Wrap email content in the professional template
 */
export function emailWrapper(title: string, body: string, options: EmailOptions = {}, config?: EmailTemplateConfig): string {
  const c = resolveConfig(config)
  const { headerColor = 'primary', preheader } = options
  const headerBg = headerColor === 'secondary' ? c.secondaryColor : c.brandColor

  const badgeHtml = c.brandInitials
    ? `<td width="48" align="right" valign="middle">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background: #000; display: inline-block; text-align: center; line-height: 36px;">
                      <span style="color: #fff; font-weight: 900; font-size: 14px; letter-spacing: 0.05em;">${escapeHtml(c.brandInitials)}</span>
                    </div>
                  </td>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(preheader)}</div>` : ''}

  <!-- Outer wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f0f0f0; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main container — wider (660px) -->
        <table cellpadding="0" cellspacing="0" border="0" width="660" style="max-width: 660px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${headerBg}; padding: 32px 40px; border-radius: 12px 12px 0 0; border: 2px solid #000000; border-bottom: none;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #000000; font-size: 22px; font-weight: 800; line-height: 1.3; letter-spacing: -0.01em;">
                      ${escapeHtml(title)}
                    </h1>
                  </td>
                  ${badgeHtml}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background: #ffffff; padding: 40px; border: 2px solid #000000; border-top: none; border-radius: 0 0 12px 12px;">
              ${body}
              ${emailFooter(c)}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Factory ─────────────────────────────────────────────────────────

export interface EmailTemplateFactory {
  emailButton: (text: string, url: string, color?: ButtonColor) => string
  emailWrapper: (title: string, body: string, options?: EmailOptions) => string
  emailQuote: (content: string, borderColor?: string) => string
  emailInfoRow: (label: string, value: string) => string
  emailParagraph: (text: string) => string
  emailTrackingPixel: (ticketId: number | string, messageId?: number | string) => string
  emailRichContent: (html: string) => string
  escapeHtml: (str: string) => string
}

/**
 * Create a pre-configured email template factory.
 * All returned functions use the provided config automatically.
 *
 * @example
 * const email = createEmailTemplateFactory({
 *   brandName: 'MyBrand',
 *   brandColor: '#FF5733',
 *   supportEmail: 'help@mybrand.com',
 *   websiteUrl: 'https://mybrand.com',
 *   logoUrl: 'https://mybrand.com/logo.png',
 *   brandInitials: 'MB',
 * })
 *
 * const html = email.emailWrapper('Welcome!', email.emailParagraph('Hello world.'))
 */
export function createEmailTemplateFactory(config: EmailTemplateConfig): EmailTemplateFactory {
  const c = resolveConfig(config)
  return {
    emailButton: (text, url, color = 'primary') => emailButton(text, url, color, c),
    emailWrapper: (title, body, options = {}) => emailWrapper(title, body, options, c),
    emailQuote: (content, borderColor?) => emailQuote(content, borderColor, c),
    emailInfoRow,
    emailParagraph,
    emailTrackingPixel: (ticketId, messageId?) => emailTrackingPixel(ticketId, messageId, c.websiteUrl),
    emailRichContent: (html) => emailRichContent(html, c),
    escapeHtml,
  }
}
