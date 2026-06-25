import type { Endpoint } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import crypto from 'crypto'
import { dbFind, dbUpdate, dbCreate, dbFindByID } from '../utils/db'

/**
 * POST /api/support/oauth/google
 * Google OAuth — handles both login redirect and callback.
 * Body: { action: 'login' } or { code: string, state: string, cookieState: string }
 */
export interface OAuthGoogleOptions {
  allowedEmailDomains?: string[]
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
        const { action, code, state: queryState, cookieState } = body

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

          return Response.json({
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
            state: oauthState,
          })
        }

        // Step 2: Handle callback (code exchange)
        if (code) {
          // Validate state
          if (!cookieState || !queryState || cookieState !== queryState) {
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

          return new Response(JSON.stringify({ token, user: clientDoc, exp }), {
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
