import type { Endpoint } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import crypto from 'crypto'
import { dbFind, dbUpdate, dbCreate, dbFindByID } from '../utils/db'
import { issueTwoFactorChallenge } from '../utils/twoFactorChallenge'

/**
 * POST /api/support/oauth/google
 * Google OAuth — handles both login redirect and callback.
 * Body: { action: 'login' } or { code: string, state: string }
 *
 * The CSRF state is NOT taken from the body: `action: 'login'` issues it as an
 * HttpOnly cookie and the callback reads it back from the `Cookie` header.
 */
export interface OAuthGoogleOptions {
  allowedEmailDomains?: string[]
}

/** Name of the HttpOnly cookie carrying the CSRF state between the two steps. */
export const OAUTH_STATE_COOKIE = 'support-oauth-state'

/** Same window as the Google authorization code: 10 minutes is plenty. */
const OAUTH_STATE_MAX_AGE = 600

/**
 * A successful `/support/2fa` verify stamps `twoFactorVerifiedAt`; the marker is
 * valid for this window then consumed. Mirrors `TWO_FA_WINDOW_MS` in
 * `collections/SupportClients.ts` — the two MUST stay in sync.
 */
const TWO_FA_WINDOW_MS = 5 * 60 * 1000

/**
 * Read one cookie from the request's own `Cookie` header.
 *
 * The callback used to compare `state` against a `cookieState` ALSO taken from
 * the JSON body: two values from the same attacker-controlled place, so the CSRF
 * check was a no-op for any non-browser caller (send the same string twice). The
 * state is now issued as an HttpOnly cookie at the `login` step and read back
 * here, server-side — the only place a browser cannot forge it from script.
 */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      return part.slice(eq + 1).trim()
    }
  }
  return null
}

/**
 * Expire the state cookie: it is single-use, and leaving it live for the rest of
 * its 10 minutes keeps a consumed CSRF token replayable for no benefit.
 */
export function clearedStateCookie(): string {
  const secure = process.env.NODE_ENV === 'production'
  return `${OAUTH_STATE_COOKIE}=; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=0`
}

/** Constant-time comparison — the state is a secret for the length of the flow. */
function statesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const left = crypto.createHash('sha256').update(a).digest()
  const right = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(left, right)
}

export function createOAuthGoogleEndpoint(slugs: CollectionSlugs, options?: OAuthGoogleOptions): Endpoint {
  return {
    path: '/support/oauth/google',
    method: 'post',
    handler: async (req) => {
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
      const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return Response.json(
          { error: 'Google OAuth non configuré.' },
          { status: 501 },
        )
      }

      try {
        const body = await req.json!()
        const { action, code, state: queryState } = body

        // Step 1: Generate OAuth URL
        if (action === 'login') {
          const oauthState = crypto.randomBytes(32).toString('hex')
          const redirectUri = `${baseUrl}/api/support/oauth/google`
          const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state: oauthState,
            prompt: 'select_account',
          })

          const secure = process.env.NODE_ENV === 'production'
          const loginHeaders = new Headers({ 'Content-Type': 'application/json' })
          loginHeaders.append(
            'Set-Cookie',
            `${OAUTH_STATE_COOKIE}=${oauthState}; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${OAUTH_STATE_MAX_AGE}`,
          )

          return new Response(
            JSON.stringify({
              url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
              // Kept for callers that echo it back in the redirect URL; the
              // server no longer trusts anything the caller returns.
              state: oauthState,
            }),
            { status: 200, headers: loginHeaders },
          )
        }

        // Step 2: Handle callback (code exchange)
        if (code) {
          // Validate state against the HttpOnly cookie set at the `login` step —
          // NOT against a second copy taken from the request body.
          const issuedState = readCookie(req.headers.get('cookie'), OAUTH_STATE_COOKIE)
          if (!statesMatch(issuedState, queryState)) {
            return Response.json({ error: 'state_mismatch' }, { status: 400 })
          }

          const redirectUri = `${baseUrl}/api/support/oauth/google`

          // Exchange code for tokens
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }),
          })

          const tokens = await tokenRes.json()

          if (!tokens.access_token) {
            return Response.json({ error: 'oauth_failed' }, { status: 400 })
          }

          // Get user profile from Google
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })

          const profile = await profileRes.json()

          if (!profile.email) {
            return Response.json({ error: 'no_email' }, { status: 400 })
          }

          // Only trust Google-verified emails — an unverified email matching an
          // existing client would otherwise allow account takeover.
          if (profile.verified_email !== true) {
            return Response.json({ error: 'email_not_verified' }, { status: 403 })
          }

          const payload = req.payload

          // Resolve the account by the stable Google subject id first, then by the
          // (verified) email — linking the googleId so subsequent logins are stable.
          const byGoogle = await dbFind(payload, slugs.supportClients, {
            where: { googleId: { equals: profile.id } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          let clientDoc = byGoogle.docs[0] as { id: number | string; email: string } | undefined

          if (!clientDoc) {
            const byEmail = await dbFind(payload, slugs.supportClients, {
              where: { email: { equals: profile.email } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            clientDoc = byEmail.docs[0] as { id: number | string; email: string } | undefined
            if (clientDoc && profile.id) {
              await dbUpdate(payload, slugs.supportClients, {
                id: clientDoc.id,
                data: { googleId: profile.id },
                overrideAccess: true,
              })
            }
          }

          // Auto-create account if needed (domain restriction enforced)
          if (!clientDoc) {
            const allowedDomains = options?.allowedEmailDomains
            if (allowedDomains && allowedDomains.length > 0) {
              const emailDomain = profile.email.split('@')[1]?.toLowerCase()
              const isAllowed = allowedDomains.some(
                (d: string) => d.toLowerCase() === emailDomain,
              )
              if (!isAllowed) {
                return Response.json(
                  { error: 'Inscription non autorisée pour ce domaine email.' },
                  { status: 403 },
                )
              }
            }
            const autoPassword = crypto.randomBytes(48).toString('base64url')
            const fullName = profile.name || profile.email.split('@')[0]
            const nameParts = fullName.split(' ')

            clientDoc = await dbCreate(payload, slugs.supportClients, {
              data: {
                email: profile.email,
                firstName: nameParts[0] || fullName,
                lastName: nameParts.slice(1).join(' ') || '-',
                company: fullName,
                googleId: profile.id,
                password: autoPassword,
              },
              overrideAccess: true,
            }) as { id: number | string; email: string }
          }

          // Replay the 2FA rule BEFORE minting anything.
          //
          // This path never calls `payload.login`, so the `beforeLogin` hook
          // `createEnforce2FA` (collections/SupportClients.ts) never runs: a
          // client who turned 2FA on from the portal profile page could skip it
          // entirely by clicking "Sign in with Google". Same contract as
          // `endpoints/login.ts`: no token, `{ requires2FA: true }`, and the
          // verified marker is single-use.
          const twoFactorDoc = (await dbFindByID(payload, slugs.supportClients, {
            id: clientDoc.id,
            depth: 0,
            overrideAccess: true,
            showHiddenFields: true,
          })) as { twoFactorEnabled?: boolean; twoFactorVerifiedAt?: string | null }

          if (twoFactorDoc?.twoFactorEnabled) {
            const raw = twoFactorDoc.twoFactorVerifiedAt
            const verifiedAt = raw ? new Date(raw).getTime() : 0
            if (!(verifiedAt > Date.now() - TWO_FA_WINDOW_MS)) {
              // The authorization code is spent: the client has to restart the
              // whole flow after verifying, so the state goes with it.
              //
              // Google just proved this identity, so the client is entitled to
              // request a code: hand out the same short-lived challenge
              // `endpoints/login.ts` mints, or `POST /support/2fa` would refuse
              // to send one.
              let challenge: string | undefined
              try {
                challenge = issueTwoFactorChallenge(clientDoc.email)
              } catch {
                // PAYLOAD_SECRET missing — 2FA is inoperable anyway; fail closed.
              }
              return new Response(JSON.stringify({ requires2FA: true, ...(challenge ? { challenge } : {}) }), {
                status: 200,
                headers: new Headers({
                  'Content-Type': 'application/json',
                  'Set-Cookie': clearedStateCookie(),
                }),
              })
            }
            // Consume the marker so the verified window cannot be replayed.
            await dbUpdate(payload, slugs.supportClients, {
              id: clientDoc.id,
              data: { twoFactorVerifiedAt: null },
              overrideAccess: true,
            })
          }

          // Mint a Payload session WITHOUT touching the user's password.
          // Uses Payload's own jwtSign/getFieldsToSign so the token format matches
          // exactly, and replicates addSessionToUser for the sessions array.
          const secret = process.env.PAYLOAD_SECRET
          if (!secret) {
            return Response.json({ error: 'server_misconfigured' }, { status: 500 })
          }
          const collectionConfig = (payload as any).collections[slugs.supportClients].config
          const tokenExpiration: number = collectionConfig.auth?.tokenExpiration ?? 7200

          let sid: string | undefined
          if (collectionConfig.auth?.useSessions) {
            sid = crypto.randomUUID()
            const now = new Date()
            const expiresAt = new Date(now.getTime() + tokenExpiration * 1000)
            const fresh = (await dbFindByID(payload, slugs.supportClients, {
              id: clientDoc.id,
              depth: 0,
              overrideAccess: true,
              showHiddenFields: true,
            })) as { sessions?: Array<{ id: string; createdAt: string; expiresAt: string }> }
            const kept = Array.isArray(fresh?.sessions)
              ? fresh.sessions.filter((s) => new Date(s.expiresAt) > now)
              : []
            await payload.db.updateOne({
              collection: slugs.supportClients,
              id: clientDoc.id,
              data: {
                sessions: [
                  ...kept,
                  { id: sid, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() },
                ],
              },
              returning: false,
            } as any)
          }

          const fieldsToSign = getFieldsToSign({
            collectionConfig,
            email: clientDoc.email,
            sid,
            user: { ...clientDoc, collection: slugs.supportClients },
          } as any)
          const { token, exp } = await jwtSign({ fieldsToSign, secret, tokenExpiration })

          const headers = new Headers({ 'Content-Type': 'application/json' })
          const cookieSecure = process.env.NODE_ENV === 'production'
          headers.append(
            'Set-Cookie',
            `payload-token=${token}; HttpOnly; ${cookieSecure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${tokenExpiration}`,
          )
          // The state has done its job — do not leave it replayable.
          headers.append('Set-Cookie', clearedStateCookie())

          return new Response(JSON.stringify({ user: clientDoc, exp }), {
            status: 200,
            headers,
          })
        }

        return Response.json({ error: 'Action invalide' }, { status: 400 })
      } catch (err) {
        console.error('[oauth/google] Error:', err)
        return Response.json({ error: 'oauth_error' }, { status: 500 })
      }
    },
  }
}
