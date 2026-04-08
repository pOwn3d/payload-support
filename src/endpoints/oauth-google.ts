import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import crypto from 'crypto'

/**
 * POST /api/support/oauth/google
 * Google OAuth — handles both login redirect and callback.
 * Body: { action: 'login' } or { code: string, state: string, cookieState: string }
 */
export function createOAuthGoogleEndpoint(slugs: CollectionSlugs): Endpoint {
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

          const payload = req.payload

          // Find existing support client by email
          const existing = await payload.find({
            collection: slugs.supportClients as any,
            where: { email: { equals: profile.email } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          let clientDoc = existing.docs[0]

          // Auto-create account if needed
          if (!clientDoc) {
            const autoPassword = crypto.randomBytes(48).toString('base64url')
            const fullName = profile.name || profile.email.split('@')[0]
            const nameParts = fullName.split(' ')

            clientDoc = await payload.create({
              collection: slugs.supportClients as any,
              data: {
                email: profile.email,
                firstName: nameParts[0] || fullName,
                lastName: nameParts.slice(1).join(' ') || '-',
                company: fullName,
                password: autoPassword,
              },
              overrideAccess: true,
            })
          }

          // Generate temp password, login, then rotate
          const tempPassword = crypto.randomBytes(48).toString('base64url')
          await payload.update({
            collection: slugs.supportClients as any,
            id: clientDoc.id,
            data: { password: tempPassword },
            overrideAccess: true,
          })

          const loginResult = await payload.login({
            collection: slugs.supportClients as any,
            data: { email: profile.email, password: tempPassword },
          })

          // Immediately rotate password
          const postLoginPassword = crypto.randomBytes(48).toString('base64url')
          await payload.update({
            collection: slugs.supportClients as any,
            id: clientDoc.id,
            data: { password: postLoginPassword },
            overrideAccess: true,
          })

          if (!loginResult.token) {
            return Response.json({ error: 'login_failed' }, { status: 400 })
          }

          return Response.json({
            token: loginResult.token,
            user: loginResult.user,
            exp: loginResult.exp,
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
