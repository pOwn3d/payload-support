/**
 * ConsilioWEB Support — email template system v2
 *
 * Design system: warm-neutral background, ink + teal accents.
 *   - ink     #1d2b4d  (primary text / headers)
 *   - teal    #17807c  (accent / links / reply family)
 *   - amber   #c2410c  (alert family — "action requise")
 *   - paper   #faf8f5  (outer canvas)        card #ffffff
 *   - sand    #f4f1ec  (quote / panel bg)    line #e7e2d9 (hairlines)
 *
 * Goals: fewer, clearer emails. Each client email carries a visual "family"
 * (eyebrow + accent) so the inbox reads at a glance, plus an explicit preheader.
 *
 * Public API is FROZEN — names & signatures of emailWrapper, emailButton,
 * emailParagraph, emailQuote, emailRichContent, emailTrackingPixel,
 * emailInfoRow, escapeHtml, createEmailTemplateFactory must not change.
 */

import { generateTrackingToken } from '../endpoints/track-open'

// ─── Design tokens ───────────────────────────────────────────────────

const COLORS = {
  ink: '#1d2b4d',
  inkSoft: '#3a486a',
  teal: '#17807c',
  tealDark: '#0f5d5a',
  amber: '#c2410c',
  paper: '#faf8f5',
  card: '#ffffff',
  sand: '#f4f1ec',
  line: '#e7e2d9',
  text: '#2a3142',
  muted: '#6b7280',
  faint: '#9aa1ad',
} as const

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
  /** Absolute URL of the client notification preferences page (footer link) */
  preferencesUrl?: string
}

const DEFAULT_CONFIG: Required<EmailTemplateConfig> = {
  brandName: 'Support',
  brandColor: COLORS.teal,
  secondaryColor: COLORS.ink,
  accentColor: COLORS.amber,
  logoUrl: '',
  supportEmail: process.env.SUPPORT_EMAIL || '',
  websiteUrl: process.env.NEXT_PUBLIC_SERVER_URL || '',
  phone: '',
  location: '',
  brandInitials: '',
  preferencesUrl: '',
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
  const secret = process.env.PAYLOAD_SECRET || ''
  // Open-tracking requires a signed URL (HMAC). Without a secret or a messageId we
  // cannot sign, so we emit NO pixel rather than an unsigned (abusable) one.
  if (!secret || messageId === undefined || messageId === null) return ''
  const sig = generateTrackingToken(String(ticketId), String(messageId), secret)
  const params = `t=${ticketId}&m=${messageId}&sig=${sig}`
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

  // Convert markdown fenced code blocks (```lang\ncode\n```) to styled <pre> blocks
  // Email clients don't run JS so we just use a nice layout, no syntax highlighting
  function convertFencedCodeBlocks(input: string): string {
    // Quick check: no backticks, no work to do
    if (!input.includes('```')) return input

    // Normalize HTML block breaks to newlines so the regex can span paragraphs
    const normalized = input
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>\s*<(p|div)[^>]*>/gi, '\n')
      .replace(/<(p|div)[^>]*>/gi, '')
      .replace(/<\/(p|div)>/gi, '\n')

    // Replace code blocks with markers to protect them from paragraph wrapping
    const codeBlocks: string[] = []
    const withMarkers = normalized.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
      codeBlocks.push(renderCodeBlockHtml(lang || '', code || ''))
      return `\x00CODEBLOCK_${codeBlocks.length - 1}\x00`
    })

    // Wrap non-marker text lines in <p>, then restore code blocks
    return withMarkers
      .split(/(\x00CODEBLOCK_\d+\x00)/g)
      .map((chunk) => {
        const markerMatch = chunk.match(/^\x00CODEBLOCK_(\d+)\x00$/)
        if (markerMatch) return codeBlocks[parseInt(markerMatch[1], 10)]
        return chunk
          .split('\n')
          .map((line) => line.trim() ? `<p>${line}</p>` : '')
          .join('')
      })
      .join('')
  }

  let result = html
    // Make relative image URLs absolute
    .replace(/src="\/([^"]+)"/g, `src="${baseUrl}/$1"`)

  // Convert fenced code blocks BEFORE other processing (protects code from HTML styling)
  result = convertFencedCodeBlocks(result)

  // Apply inline styles to elements
  result = styleTag(result, 'blockquote', `border-left: 3px solid ${COLORS.teal}; margin: 16px 0; padding: 12px 20px; background: ${COLORS.sand}; border-radius: 0 8px 8px 0; color: ${COLORS.inkSoft};`)
  result = styleTag(result, 'img', 'max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block;')
  result = styleTag(result, 'a', `color: ${COLORS.teal}; text-decoration: underline; font-weight: 600;`)
  result = styleTag(result, 'ul', 'margin: 8px 0; padding-left: 24px;')
  result = styleTag(result, 'ol', 'margin: 8px 0; padding-left: 24px;')
  result = styleTag(result, 'li', `margin: 4px 0; line-height: 1.6; color: ${COLORS.text};`)
  result = styleTag(result, 'p', `margin: 0 0 12px 0; line-height: 1.75; font-size: 15px; color: ${COLORS.text};`)

  // Strip dangerous content — keep this in sync with any rich-text source.
  result = result
    // <script>…</script> and <style>…</style> (including unclosed/nested-ish)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Embedded frames / plugins — never valid in email, common XSS vector
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    // Inline event handlers (onclick, onload, …)
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    // javascript: URIs
    .replace(/javascript:/gi, '')

  return `<div style="font-size: 15px; line-height: 1.75; color: ${COLORS.text};">${result}</div>`
}

// ─── Configurable email components ───────────────────────────────────

type ButtonColor = 'primary' | 'secondary' | 'dark'

function getButtonColors(_config: Required<EmailTemplateConfig>): Record<ButtonColor, { bg: string; text: string; border: string }> {
  return {
    primary: { bg: COLORS.teal, text: '#ffffff', border: COLORS.teal },
    secondary: { bg: COLORS.sand, text: COLORS.ink, border: COLORS.line },
    dark: { bg: COLORS.ink, text: '#ffffff', border: COLORS.ink },
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
      <a href="${url}" style="display: inline-block; padding: 14px 36px; background: ${bc.bg}; color: ${bc.text}; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 10px; border: 1px solid ${bc.border}; letter-spacing: 0.01em;">
        ${text}
      </a>
    </div>
  `
}

/**
 * Render a single fenced code block as styled email HTML.
 * Email clients don't run JS so we just use a nice static layout.
 */
function renderCodeBlockHtml(lang: string, code: string): string {
  const cleanCode = escapeHtml(code.replace(/\n$/, ''))
  const label = lang ? lang.trim() : 'code'
  return `<div style="margin: 12px 0; border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; background: #0f172a;">
    <div style="padding: 6px 14px; background: #1e293b; border-bottom: 1px solid #334155; font-family: 'SF Mono', 'Fira Code', Consolas, monospace; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(label)}</div>
    <pre style="margin: 0; padding: 14px 16px; overflow-x: auto; background: #0f172a; color: #e2e8f0; font-family: 'SF Mono', 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.6; white-space: pre;"><code style="background: transparent; padding: 0; color: inherit; font-family: inherit; font-size: inherit;">${cleanCode}</code></pre>
  </div>`
}

/**
 * Quote block for message previews — supports fenced code blocks.
 */
export function emailQuote(content: string, borderColor?: string, config?: EmailTemplateConfig): string {
  resolveConfig(config)
  const color = borderColor || COLORS.teal
  const panel = `margin: 24px 0; padding: 18px 22px; background: ${COLORS.sand}; border-left: 3px solid ${color}; border-radius: 0 8px 8px 0;`

  // If content has fenced code blocks, render them as styled blocks
  if (content && content.includes('```')) {
    const parts: string[] = []
    const regex = /```(\w*)\n?([\s\S]*?)```/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      // Text before the code block
      const textBefore = content.slice(lastIndex, match.index).trim()
      if (textBefore) {
        parts.push(`<p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.75; color: ${COLORS.inkSoft}; white-space: pre-wrap;">${escapeHtml(textBefore)}</p>`)
      }
      parts.push(renderCodeBlockHtml(match[1] || '', match[2] || ''))
      lastIndex = match.index + match[0].length
    }
    // Remaining text after the last code block
    const textAfter = content.slice(lastIndex).trim()
    if (textAfter) {
      parts.push(`<p style="margin: 12px 0 0 0; font-size: 15px; line-height: 1.75; color: ${COLORS.inkSoft}; white-space: pre-wrap;">${escapeHtml(textAfter)}</p>`)
    }
    return `
      <div style="${panel}">
        ${parts.join('')}
      </div>
    `
  }

  return `
    <div style="${panel}">
      <p style="margin: 0; font-size: 15px; line-height: 1.75; color: ${COLORS.inkSoft}; white-space: pre-wrap;">${escapeHtml(content)}</p>
    </div>
  `
}

/**
 * Info row (label: value) for structured data in emails
 */
export function emailInfoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 0; font-weight: 700; color: ${COLORS.muted}; width: 150px; vertical-align: top; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px;">${escapeHtml(label)}</td>
      <td style="padding: 8px 0; font-size: 15px; color: ${COLORS.text}; line-height: 1.5;">${value}</td>
    </tr>
  `
}

/**
 * Paragraph helper with professional styling
 */
export function emailParagraph(text: string): string {
  return `<p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.75; color: ${COLORS.text};">${text}</p>`
}

// ─── Email families (eyebrow + accent) ───────────────────────────────

export type EmailKind = 'reply' | 'system' | 'alert'

interface KindStyle {
  eyebrow: string
  accent: string
}

function getKindStyle(kind: EmailKind): KindStyle {
  switch (kind) {
    case 'reply':
      return { eyebrow: 'Réponse de votre équipe', accent: COLORS.teal }
    case 'alert':
      return { eyebrow: 'Action requise', accent: COLORS.amber }
    case 'system':
    default:
      return { eyebrow: 'Notification automatique', accent: COLORS.inkSoft }
  }
}

/**
 * Generate the professional footer
 */
function emailFooter(config: Required<EmailTemplateConfig>): string {
  const logoHtml = config.logoUrl
    ? `<a href="${config.websiteUrl}">
            <img src="${config.logoUrl}" alt="${escapeHtml(config.brandName)}" width="100" height="47" style="display: block; border: 0;" />
          </a>`
    : `<a href="${config.websiteUrl}" style="font-size: 16px; font-weight: 800; color: ${COLORS.ink}; text-decoration: none; letter-spacing: -0.01em;">${escapeHtml(config.brandName)}</a>`

  const contactParts: string[] = []
  if (config.supportEmail) {
    contactParts.push(`<a href="mailto:${config.supportEmail}" style="color: ${COLORS.muted}; text-decoration: none;">${config.supportEmail}</a>`)
  }
  if (config.phone) {
    contactParts.push(`<a href="tel:${config.phone.replace(/\s/g, '')}" style="color: ${COLORS.muted}; text-decoration: none;">${config.phone}</a>`)
  }

  const locationParts: string[] = []
  if (config.websiteUrl) {
    const displayUrl = config.websiteUrl.replace(/^https?:\/\//, '')
    locationParts.push(`<a href="${config.websiteUrl}" style="color: ${COLORS.teal}; text-decoration: none; font-weight: 600;">${displayUrl}</a>`)
  }
  if (config.location) {
    locationParts.push(config.location)
  }

  // "Gérer mes notifications" link — points at the client preferences page
  // when available, otherwise falls back to a mailto so the link is never dead.
  const manageUrl = config.preferencesUrl
    || (config.websiteUrl ? `${config.websiteUrl}/support/profile` : '')
    || (config.supportEmail ? `mailto:${config.supportEmail}?subject=Notifications` : '')
  const preferencesLinks: string[] = []
  if (manageUrl) {
    preferencesLinks.push(`<a href="${manageUrl}" style="color: ${COLORS.muted}; text-decoration: underline;">Gérer mes notifications</a>`)
  }
  if (config.supportEmail) {
    preferencesLinks.push(`<a href="mailto:${config.supportEmail}?subject=Unsubscribe" style="color: ${COLORS.faint}; text-decoration: underline;">Se désinscrire</a>`)
  }
  const preferencesHtml = preferencesLinks.length > 0
    ? `<p style="margin: 10px 0 0 0; font-size: 11px; color: ${COLORS.faint}; line-height: 1.5;">${preferencesLinks.join(' &nbsp;&middot;&nbsp; ')}</p>`
    : ''

  return `
    <!-- Spacer -->
    <div style="height: 28px;"></div>

    <!-- Hairline separator -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 22px;">
      <tr>
        <td height="1" bgcolor="${COLORS.line}" style="font-size:1px;line-height:1px;">&nbsp;</td>
      </tr>
    </table>

    <!-- Footer -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td width="120" valign="top" style="padding-right: 16px;">
          ${logoHtml}
        </td>
        <td valign="top">
          <p style="margin: 0; font-size: 13px; font-weight: 700; color: ${COLORS.ink}; letter-spacing: 0.01em;">${escapeHtml(config.brandName)}</p>
          ${contactParts.length > 0 ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${COLORS.muted}; line-height: 1.5;">${contactParts.join(' &nbsp;&middot;&nbsp; ')}</p>` : ''}
          ${locationParts.length > 0 ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: ${COLORS.faint}; line-height: 1.4;">${locationParts.join(' &nbsp;&middot;&nbsp; ')}</p>` : ''}
          ${preferencesHtml}
        </td>
      </tr>
    </table>
  `
}

interface EmailOptions {
  /**
   * Header background color variant.
   * @deprecated Prefer `kind` for client emails — it drives the visual family
   * (eyebrow + accent). `headerColor` is kept for backward compatibility.
   */
  headerColor?: 'primary' | 'secondary'
  /** Preheader text (hidden preview shown in the inbox list) */
  preheader?: string
  /**
   * Visual family of the email:
   *  - 'reply'  → "Réponse de votre équipe" (teal)   — human answer
   *  - 'system' → "Notification automatique" (ink)    — status / confirmation
   *  - 'alert'  → "Action requise" (amber)            — reminder / needs client
   */
  kind?: EmailKind
}

/**
 * Wrap email content in the professional template
 */
export function emailWrapper(title: string, body: string, options: EmailOptions = {}, config?: EmailTemplateConfig): string {
  const c = resolveConfig(config)
  const { preheader, kind } = options
  const kindStyle = kind ? getKindStyle(kind) : null
  const accent = kindStyle?.accent || COLORS.teal

  const eyebrowHtml = kindStyle
    ? `<p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${kindStyle.accent};">${escapeHtml(kindStyle.eyebrow)}</p>`
    : ''

  const badgeHtml = c.brandInitials
    ? `<td width="48" align="right" valign="middle">
                    <div style="width: 38px; height: 38px; border-radius: 10px; background: ${COLORS.ink}; display: inline-block; text-align: center; line-height: 38px;">
                      <span style="color: #fff; font-weight: 800; font-size: 14px; letter-spacing: 0.04em;">${escapeHtml(c.brandInitials)}</span>
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
<body style="margin: 0; padding: 0; background: ${COLORS.paper}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: ${COLORS.paper};">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}

  <!-- Outer wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: ${COLORS.paper}; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main container — 640px -->
        <table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width: 640px; width: 100%;">

          <!-- Accent rule -->
          <tr>
            <td style="height: 4px; background: ${accent}; border-radius: 12px 12px 0 0; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background: ${COLORS.card}; padding: 30px 40px 22px 40px; border: 1px solid ${COLORS.line}; border-top: none; border-bottom: none;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td valign="middle">
                    ${eyebrowHtml}
                    <h1 style="margin: 0; color: ${COLORS.ink}; font-size: 21px; font-weight: 800; line-height: 1.3; letter-spacing: -0.01em;">
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
            <td style="background: ${COLORS.card}; padding: 8px 40px 40px 40px; border: 1px solid ${COLORS.line}; border-top: none; border-radius: 0 0 12px 12px;">
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
