import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { dbFind, dbCreate, dbUpdate } from '../utils/db'
import { getVapidPublicKey } from '../utils/push'
import { validatePushEndpoint, WEBHOOK_URL_MESSAGES } from '../utils/urlSafety'

/** GET /api/support/push/vapid-public-key — public key the browser uses to subscribe. */
export function createVapidKeyEndpoint(): Endpoint {
  return {
    path: '/support/push/vapid-public-key',
    method: 'get',
    handler: async () => Response.json({ publicKey: getVapidPublicKey() }),
  }
}

/** POST /api/support/push/subscribe — register the current agent's browser push subscription. */
export function createPushSubscribeEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/push/subscribe',
    method: 'post',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)
        let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }
        try { body = (await req.json!()) as typeof body } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }) }
        const sub = body?.subscription
        const endpoint = sub?.endpoint
        const p256dh = sub?.keys?.p256dh
        const auth = sub?.keys?.auth
        if (!endpoint || !p256dh || !auth) {
          return Response.json({ error: 'subscription invalide (endpoint + keys requis).' }, { status: 400 })
        }
        // WRITE-time SSRF guard. `requireAdmin` above only proves the caller
        // belongs to the staff collection — the very actor `utils/urlSafety`
        // already models as hostile for webhook URLs — and `web-push` hands this
        // string's host and port straight to `https.request`. Same guard, same
        // reason, on the second field that steers an outbound request.
        const endpointCheck = validatePushEndpoint(endpoint)
        if (!endpointCheck.ok) {
          return Response.json(
            { error: WEBHOOK_URL_MESSAGES[endpointCheck.reason || 'invalid_url'] },
            { status: 400 },
          )
        }
        const data = { user: req.user!.id, endpoint, p256dh, auth, userAgent: (req.headers.get('user-agent') || '').slice(0, 256) }
        const existing = await dbFind(req.payload, slugs.pushSubscriptions, { where: { endpoint: { equals: endpoint } }, limit: 1, depth: 0, overrideAccess: true })
        if (existing.docs.length > 0) {
          await dbUpdate(req.payload, slugs.pushSubscriptions, { id: (existing.docs[0] as { id: number | string }).id, data, overrideAccess: true })
        } else {
          await dbCreate(req.payload, slugs.pushSubscriptions, { data, overrideAccess: true })
        }
        return Response.json({ ok: true })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[push] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
