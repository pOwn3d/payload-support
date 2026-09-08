import { lookup } from 'dns/promises'

/**
 * SSRF guards for every URL the SERVER follows on behalf of a user-supplied
 * value: outbound webhook endpoints, and Web Push subscription endpoints.
 *
 * `webhook-endpoints.url` is a plain `text` field with no validation, writable by
 * any member of the staff collection, and `_sendToEndpoint` used to `fetch()` it
 * with the default redirect policy. Pointing it at `http://169.254.169.254/…` or
 * an internal service turned every ticket event into a blind SSRF, with the HTTP
 * status echoed back into the admin through `lastStatus`.
 *
 * Three layers, because any one of them alone is bypassable:
 *  1. `validateWebhookUrl` at WRITE time — rejects the scheme and the literal
 *     private / loopback / link-local hosts before the row is saved.
 *  2. `assertPublicHost` at SEND time — resolves the name and re-checks the
 *     resolved addresses, so a DNS record flipped to 127.0.0.1 after the row was
 *     validated is caught. It FAILS CLOSED: a resolution that errors, returns
 *     nothing, or outruns `LOOKUP_TIMEOUT_MS` is treated as "do not connect".
 *     Note the limit, honestly stated: `fetch` resolves the name a SECOND time,
 *     so this narrows the rebinding window rather than closing it — closing it
 *     would mean connecting to the address we validated (a custom dispatcher
 *     lookup), which is a dependency this plugin does not take.
 *  3. `safeFetch` follows redirects MANUALLY, re-running (1) and (2) on every
 *     hop: a public host answering `302 Location: http://127.0.0.1:8080/` would
 *     otherwise walk straight through the first two layers.
 */

/** Set `SUPPORT_ALLOW_INSECURE_WEBHOOKS=1` to allow plain http (local dev only). */
function httpAllowed(): boolean {
  return process.env.SUPPORT_ALLOW_INSECURE_WEBHOOKS === '1'
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.localhost', '.internal', '.home.arpa']

/** Dotted-quad only — no octal/hex shorthand, which `new URL()` normalises away anyway. */
function parseIPv4(host: string): number[] | null {
  const parts = host.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    octets.push(n)
  }
  return octets
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a, b] = octets
  if (a === 0) return true // "this network" / 0.0.0.0
  if (a === 10) return true // 10/8
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 192 && b === 0) return true // 192.0.0/24 + 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a >= 224) return true // multicast + reserved + broadcast
  return false
}

/**
 * Handles the IPv4-mapped and IPv4-compatible forms — `::ffff:10.0.0.1` and
 * `::ffff:a00:1` both reach 10.0.0.1 and both must be blocked.
 */
function isPrivateIPv6(host: string): boolean {
  const lower = host.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true // fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // fc00::/7 unique-local
  if (lower.startsWith('ff')) return true // multicast

  // IPv4-mapped / -compatible, dotted form: ::ffff:10.0.0.1
  const dotted = lower.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (dotted) {
    const octets = parseIPv4(dotted[1])
    return octets ? isPrivateIPv4(octets) : true
  }

  // IPv4-mapped, hex form: ::ffff:a00:1
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const high = parseInt(hex[1], 16)
    const low = parseInt(hex[2], 16)
    return isPrivateIPv4([high >> 8, high & 0xff, low >> 8, low & 0xff])
  }

  return false
}

/** Strips the brackets WHATWG URL keeps around an IPv6 literal. */
function normalizeHost(hostname: string): string {
  const host = hostname.trim().toLowerCase()
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

/**
 * True when the host is a literal address (or a name) that must never be
 * reached from the server. Names that are not literals are NOT blocked here —
 * they are resolved and re-checked by `assertPublicHost`.
 */
export function isBlockedHost(hostname: string): boolean {
  const host = normalizeHost(hostname)
  if (!host) return true
  if (host === 'localhost') return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true

  const v4 = parseIPv4(host)
  if (v4) return isPrivateIPv4(v4)
  if (host.includes(':')) return isPrivateIPv6(host)
  return false
}

export interface UrlValidationResult {
  ok: boolean
  /** Machine-readable reason, also used as the field validation message. */
  reason?: 'invalid_url' | 'scheme_not_allowed' | 'private_host'
  url?: URL
}

/** Scheme + literal-host validation. Cheap, synchronous, safe to run in a field `validate`. */
export function validateWebhookUrl(raw: unknown): UrlValidationResult {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, reason: 'invalid_url' }
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && httpAllowed())) {
    return { ok: false, reason: 'scheme_not_allowed' }
  }
  if (isBlockedHost(url.hostname)) return { ok: false, reason: 'private_host' }
  return { ok: true, url }
}

/** French messages for the collection field — mirrors the rest of the admin UI. */
export const WEBHOOK_URL_MESSAGES: Record<NonNullable<UrlValidationResult['reason']>, string> = {
  invalid_url: 'URL invalide.',
  scheme_not_allowed: 'Seules les URL https:// sont acceptées.',
  private_host: 'Les adresses privées, loopback et link-local sont interdites (SSRF).',
}

/**
 * A `push-subscriptions.endpoint` is the same shape of hole as a webhook URL,
 * from the same actor: `requireAdmin` only checks that the caller belongs to the
 * staff collection, the field is plain `text` with no `validate`, no collection
 * hook rewrites it, and `web-push` then hands the hostname and PORT straight to
 * `https.request` with no allowlist of its own. Pointing it at an internal
 * service turned every client reply into an outbound request of the attacker's
 * choosing, with a 1-bit oracle: a 404/410 deletes the row, and staff can read
 * `push-subscriptions` back.
 *
 * Stricter than `validateWebhookUrl` on two points, both because `web-push`
 * behaves differently from `fetch`:
 *  - https only, with NO `SUPPORT_ALLOW_INSECURE_WEBHOOKS` escape hatch —
 *    `web-push` calls `https.request` whatever the scheme says, so an `http://`
 *    endpoint is a broken subscription, not a dev convenience;
 *  - an explicit length cap, because unlike a webhook URL this value arrives
 *    from an HTTP body and is persisted verbatim.
 */
const MAX_PUSH_ENDPOINT_LENGTH = 2048

export function validatePushEndpoint(raw: unknown): UrlValidationResult {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_PUSH_ENDPOINT_LENGTH) {
    return { ok: false, reason: 'invalid_url' }
  }
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'scheme_not_allowed' }
  if (isBlockedHost(url.hostname)) return { ok: false, reason: 'private_host' }
  return { ok: true, url }
}

/**
 * Resolve the name and reject unless EVERY resolved address is public.
 *
 * FAIL-CLOSED on anything that is not a clean answer. The previous version
 * returned `true` on its own timeout, on an empty answer and on every error, on
 * the theory that "`fetch` would fail the same way". A slow resolver is not a
 * failing resolver: an attacker-run authoritative server answering just after
 * the deadline got this guard to wave the request through, and `fetch` then did
 * its OWN resolution — no deadline — and reached 127.0.0.1. So a timeout, a
 * temporary resolver error (EAI_AGAIN/EAI_FAIL) and an empty answer all block.
 *
 * The ONE tolerated case is a definitive "this name does not exist"
 * (ENOTFOUND / ENODATA): there is no address for `fetch` to reach either, so
 * blocking would only swap one failure message for another.
 *
 * The deadline is generous on purpose — with fail-closed semantics it now costs
 * a legitimate delivery when it fires, and a resolver needing more than 5s is
 * broken, not slow. It still bounds the delivery: the `fetch` that follows has
 * its own 10s abort.
 */
const LOOKUP_TIMEOUT_MS = 5000
const LOOKUP_TIMED_OUT = Symbol('lookup-timed-out')
/** Definitive "no such host" — nothing for `fetch` to connect to either. */
const NONEXISTENT_HOST_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NOTFOUND'])

export async function assertPublicHost(hostname: string): Promise<boolean> {
  const host = normalizeHost(hostname)
  if (isBlockedHost(host)) return false
  if (parseIPv4(host) || host.includes(':')) return true // already a literal, checked above
  try {
    // Bounded: a stalled resolver must not hold a webhook delivery open.
    const addresses = await Promise.race([
      lookup(host, { all: true }),
      new Promise<typeof LOOKUP_TIMED_OUT>((resolve) =>
        setTimeout(() => resolve(LOOKUP_TIMED_OUT), LOOKUP_TIMEOUT_MS).unref?.(),
      ),
    ])
    if (addresses === LOOKUP_TIMED_OUT) return false
    // `[].every()` is `true`: an empty answer must not read as "all public".
    if (!Array.isArray(addresses) || addresses.length === 0) return false
    return addresses.every((entry) => !isBlockedHost(entry.address))
  } catch (error) {
    const code = (error as { code?: string } | null)?.code
    return typeof code === 'string' && NONEXISTENT_HOST_CODES.has(code)
  }
}

export class BlockedRequestError extends Error {
  constructor(public readonly reason: NonNullable<UrlValidationResult['reason']> | 'too_many_redirects') {
    super(`Blocked outbound request: ${reason}`)
    this.name = 'BlockedRequestError'
  }
}

const MAX_REDIRECTS = 3

/**
 * `fetch` with SSRF guards on the initial URL AND on every redirect target.
 *
 * `redirect: 'manual'` is the point: the default policy follows 3xx inside
 * undici, where no guard of ours can see the new target.
 */
export async function safeFetch(rawUrl: string, init: RequestInit): Promise<Response> {
  let current = rawUrl
  let body: BodyInit | null | undefined = init.body

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validation = validateWebhookUrl(current)
    if (!validation.ok || !validation.url) throw new BlockedRequestError(validation.reason || 'invalid_url')
    if (!(await assertPublicHost(validation.url.hostname))) throw new BlockedRequestError('private_host')

    const response = await fetch(current, { ...init, body, redirect: 'manual' })
    if (response.status < 300 || response.status > 399) return response

    const location = response.headers.get('location')
    if (!location) return response

    current = new URL(location, current).toString()
    // 303 (and, in practice, 301/302 on a POST) turns the follow-up into a GET.
    if (response.status === 303) body = undefined
  }

  throw new BlockedRequestError('too_many_redirects')
}
