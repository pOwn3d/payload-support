import sanitizeHtml from 'sanitize-html'

/**
 * Allow-list sanitizer for user/agent-submitted rich message content (`bodyHtml`).
 *
 * `bodyHtml` is rendered with `dangerouslySetInnerHTML` in BOTH the portal and the
 * admin views, so unsanitized HTML is a stored-XSS vector: a client could inject
 * a payload that runs in an agent's session → session theft → cross-client access.
 *
 * Applied server-side on write (TicketMessages `beforeChange`). Strips <script>,
 * <iframe>/<embed>/<object>, inline event handlers (`on*`) and `javascript:` URIs,
 * and restricts inline styles to a safe property/value allow-list (no `url()` /
 * `expression()`).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'mark',
    'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'kbd', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'],
    pre: ['class'],
    span: ['class'],
    '*': ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Force safe rel on links opening a new tab (defense against tabnabbing).
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }, true),
  },
  // Only allow CSS that cannot carry a script payload.
  allowedStyles: {
    '*': {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3}\s*,\s*){2}\d{1,3}\s*\)$/i, /^[a-z-]+$/i],
      'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3}\s*,\s*){2}\d{1,3}\s*\)$/i, /^[a-z-]+$/i],
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
    },
  },
}

/**
 * Sanitize a rich-HTML message body. Returns the input unchanged when empty.
 */
export function sanitizeMessageHtml(html: string): string {
  if (!html) return html
  return sanitizeHtml(html, OPTIONS)
}
