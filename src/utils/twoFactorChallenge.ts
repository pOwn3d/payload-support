import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Proof that the password step already succeeded for this email address.
 *
 * `POST /support/2fa {action:'send'}` used to accept an email and nothing else.
 * Its only guard was a limiter keyed on that email — 3 sends per hour — so an
 * ANONYMOUS caller who knew a victim's address (they circulate in ticket threads
 * and email copies) could burn the quota in three requests and leave the victim
 * unable to obtain the code their own login now demands. Since the OAuth path
 * enforces 2FA as well, that was a complete, renewable account lockout, plus an
 * outbound-email amplifier and a way to overwrite a code already in flight.
 *
 * The fix keys the consumable resource to something the ATTACKER cannot produce:
 * a short-lived signature issued only by a successful password (or Google)
 * authentication. Same HMAC-over-PAYLOAD_SECRET construction as the tracking
 * pixel, no storage, no new dependency.
 *
 * Format: `<expiry-ms>.<hex hmac>`. The signature covers the email AND the
 * expiry, so neither can be swapped without invalidating the token, and a token
 * issued for one account is useless for another.
 */

/** Matches the 10-minute validity of the code the challenge lets you request. */
export const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000

function challengeSecret(): string {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) {
    // Fail closed: the codes themselves are hashed with this secret, so 2FA is
    // already inoperable without it — never fall back to a source-visible value.
    throw new Error(
      '[support][2fa] PAYLOAD_SECRET is not set — refusing to issue a 2FA challenge with an insecure fallback secret',
    )
  }
  return secret
}

function normalizeEmail(email: string): string {
  return String(email).trim().toLowerCase()
}

function sign(email: string, expiresAt: number): string {
  return createHmac('sha256', challengeSecret())
    .update(`2fa-challenge:${normalizeEmail(email)}:${expiresAt}`)
    .digest('hex')
}

/** Issued by the login endpoints once credentials have been verified. */
export function issueTwoFactorChallenge(email: string, now: number = Date.now()): string {
  const expiresAt = now + TWO_FACTOR_CHALLENGE_TTL_MS
  return `${expiresAt}.${sign(email, expiresAt)}`
}

/** Constant-time; false on any malformed, expired or foreign token. */
export function verifyTwoFactorChallenge(
  email: unknown,
  token: unknown,
  now: number = Date.now(),
): boolean {
  if (typeof email !== 'string' || !email || typeof token !== 'string') return false
  const separator = token.indexOf('.')
  if (separator <= 0) return false

  const expiresAt = Number(token.slice(0, separator))
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false

  const received = token.slice(separator + 1)
  if (!/^[0-9a-f]{64}$/i.test(received)) return false

  let expected: string
  try {
    expected = sign(email, expiresAt)
  } catch {
    return false // no secret configured — fail closed
  }
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(received.toLowerCase(), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
