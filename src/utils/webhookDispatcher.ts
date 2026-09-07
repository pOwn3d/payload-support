import crypto from 'crypto'
import type { BasePayload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { dbFind, dbUpdate } from './db'

/**
 * Outbound webhook events. Must stay in sync with the `events` options of the
 * webhook-endpoints collection.
 */
export type WebhookEvent =
  | 'ticket_created'
  | 'ticket_resolved'
  | 'ticket_replied'
  | 'ticket_assigned'
  | 'sla_breached'

/**
 * Dispatch outbound webhooks for a given event.
 * Fetches all active webhook endpoints matching the event,
 * POSTs JSON to each with optional HMAC-SHA256 signature.
 * Fire-and-forget: errors are logged but never thrown.
 *
 * @param data - Payload data to send
 * @param event - Webhook event type
 * @param payload - Payload instance
 * @param slugs - Collection slugs for dynamic collection references
 */
export function dispatchWebhook(
  data: Record<string, unknown>,
  event: WebhookEvent,
  payload: BasePayload,
  slugs: CollectionSlugs,
): Promise<void> {
  // Fire and forget for callers (hooks never await it); the promise is returned so
  // tests — and any caller that wants to — can wait for delivery to settle.
  const done = _dispatch(data, event, payload, slugs)
  void done
  return done
}

async function _dispatch(
  data: Record<string, unknown>,
  event: WebhookEvent,
  payload: BasePayload,
  slugs: CollectionSlugs,
): Promise<void> {
  try {
    const { docs: endpoints } = await dbFind(payload, slugs.webhookEndpoints, {
      where: {
        and: [
          { active: { equals: true } },
          { events: { contains: event } },
        ],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    if (endpoints.length === 0) return

    const body = JSON.stringify({ event, data, timestamp: new Date().toISOString() })

    await Promise.allSettled(
      endpoints.map((endpoint) => _sendToEndpoint(endpoint as any, body, payload, slugs)),
    )
  } catch (err) {
    console.error(`[webhook] Failed to fetch endpoints for event ${event}:`, err)
  }
}

async function _sendToEndpoint(
  endpoint: { id: number | string; url: string; secret?: string | null; name?: string | null },
  body: string,
  payload: BasePayload,
  slugs: CollectionSlugs,
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PayloadSupport-Webhook/1.0',
    }

    // Sign payload with HMAC-SHA256 if secret is configured
    if (endpoint.secret) {
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex')
      headers['X-Webhook-Signature'] = signature
    }

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    // Update last triggered info on the endpoint
    await dbUpdate(payload, slugs.webhookEndpoints, {
      id: endpoint.id,
      data: {
        lastTriggeredAt: new Date().toISOString(),
        lastStatus: response.status,
      },
      overrideAccess: true,
    })

    if (!response.ok) {
      console.warn(`[webhook] ${endpoint.name || endpoint.url} returned ${response.status}`)
    }
  } catch (err) {
    console.error(`[webhook] Failed to call ${endpoint.name || endpoint.url}:`, err)

    // Still update with error status
    try {
      await dbUpdate(payload, slugs.webhookEndpoints, {
        id: endpoint.id,
        data: {
          lastTriggeredAt: new Date().toISOString(),
          lastStatus: 0,
        },
        overrideAccess: true,
      })
    } catch {
      // Ignore secondary error
    }
  }
}
