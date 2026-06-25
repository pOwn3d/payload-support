import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { RateLimiter } from '../utils/rateLimiter'
import { dbCreate } from '../utils/db'

const loginLimiter = new RateLimiter(15 * 60_000, 10) // 10 per 15 min

/**
 * POST /api/support/login
 * Client login endpoint.
 */
export function createLoginEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/login',
    method: 'post',
    handler: async (req) => {
      // NOTE: x-forwarded-for is spoofable unless this app sits strictly behind a
      // trusted proxy that rewrites it. This IP rate-limit is a SECONDARY defense;
      // the primary brute-force control is Payload's account lock (maxLoginAttempts).
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

      if (loginLimiter.check(ip)) {
        return Response.json(
          { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
          { status: 429 },
        )
      }

      const payload = req.payload
      let body: { email?: string; password?: string }
      try {
        body = await req.json!()
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const { email, password } = body
      const userAgent = req.headers.get('user-agent') || ''

      if (!email || !password) {
        return Response.json({ error: 'Email et mot de passe requis.' }, { status: 400 })
      }

      try {
        const result = await payload.login({
          collection: slugs.supportClients as any,
          data: { email, password },
        })

        // Log successful login (fire-and-forget)
        dbCreate(payload, slugs.authLogs, {
          data: { email, success: true, action: 'login', ipAddress: ip, userAgent },
          overrideAccess: true,
        }).catch(() => {})

        const headers = new Headers({ 'Content-Type': 'application/json' })

        if (result.token) {
          const secure = process.env.NODE_ENV === 'production'
          headers.append(
            'Set-Cookie',
            `payload-token=${result.token}; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=7200`,
          )
        }

        return new Response(
          JSON.stringify({
            message: 'Login successful',
            user: result.user,
            token: result.token,
            exp: result.exp,
          }),
          { status: 200, headers },
        )
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'

        // 2FA gate: password was correct but a fresh 2FA verification is required.
        // No session/cookie is issued (Payload rolled it back on the throw).
        if (errorMessage.includes('2FA_REQUIRED')) {
          return Response.json({ requires2FA: true }, { status: 200 })
        }

        let errorReason = 'Identifiants incorrects'
        if (errorMessage.includes('locked') || errorMessage.includes('verrouillé') || errorMessage.includes('Too many')) {
          errorReason = 'Compte verrouillé (trop de tentatives)'
        }

        dbCreate(payload, slugs.authLogs, {
          data: { email, success: false, action: 'login', errorReason, ipAddress: ip, userAgent },
          overrideAccess: true,
        }).catch(() => {})

        return Response.json(
          { errors: [{ message: 'Email ou mot de passe incorrect.' }] },
          { status: 401 },
        )
      }
    },
  }
}
