import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { dbFind, dbDelete } from './db'
import webpush from 'web-push'

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
