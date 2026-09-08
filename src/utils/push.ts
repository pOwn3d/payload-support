import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { dbFind, dbDelete } from './db'
import webpush from 'web-push'
import { assertPublicHost, validatePushEndpoint } from './urlSafety'

let configured = false
function ensureVapid(): boolean {
  if (configured) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@example.com', publicKey, privateKey)
  configured = true
  return true
}

/** Public VAPID key for the browser to subscribe (null if push isn't configured). */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

export interface PushNotification {
  title: string
  body: string
  url?: string
}

/**
 * Send a Web Push notification to all of an agent's subscriptions. RUNTIME-only:
 * requires VAPID keys; without them it no-ops (`{ sent: 0 }`). Stale subscriptions
 * (404/410) are pruned automatically.
 */
export async function sendPushToUser(
  payload: Payload,
  slugs: CollectionSlugs,
  userId: number | string,
  notification: PushNotification,
): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 }
  let sent = 0
  try {
    const subs = await dbFind(payload, slugs.pushSubscriptions, { where: { user: { equals: userId } }, limit: 100, depth: 0, overrideAccess: true })
    for (const s of subs.docs) {
      const row = s as { id: number | string; endpoint?: string; p256dh?: string; auth?: string }
      if (!row.endpoint || !row.p256dh || !row.auth) continue

      // SEND-time SSRF guard, the second of the two layers `utils/urlSafety`
      // describes. It is not redundant with the write-time check: it also covers
      // rows persisted BEFORE that check existed, and a name whose DNS record is
      // flipped to a private address after the row was accepted. `web-push`
      // builds its own `https.request`, so `safeFetch` cannot wrap it — this is
      // the layer that stands in for it.
      //
      // A blocked row is SKIPPED, never deleted: `assertPublicHost` fails closed
      // on a resolver timeout, and a hiccup must not purge a legitimate agent's
      // subscription. Only a real 404/410 from the push service prunes below.
      const check = validatePushEndpoint(row.endpoint)
      if (!check.ok || !check.url) {
        console.warn('[support] Push endpoint refused (unsafe URL):', check.reason)
        continue
      }
      if (!(await assertPublicHost(check.url.hostname))) {
        console.warn('[support] Push endpoint refused (host resolves to a private address)')
        continue
      }

      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(notification),
        )
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          try { await dbDelete(payload, slugs.pushSubscriptions, { id: row.id, overrideAccess: true }) } catch { /* ignore */ }
        }
      }
    }
  } catch (err) {
    console.error('[support] Push send failed:', err)
  }
  return { sent }
}
