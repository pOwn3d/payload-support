import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'

/**
 * Fire all active webhooks matching the given event.
 * Uses fire-and-forget pattern (Promise.allSettled) so hook callers are never blocked.
 * Each webhook request has a 10-second timeout.
 */
export async function fireWebhooks(
  payload: Payload,
  slugs: CollectionSlugs,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    // Find all active webhook endpoints subscribed to this event
    const endpoints = await payload.find({
      collection: slugs.webhookEndpoints as any,
      where: {
        active: { equals: true },
        events: { contains: event },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    if (endpoints.docs.length === 0) return

    const timestamp = new Date().toISOString()

    // Fire each webhook in parallel (fire-and-forget)
    await Promise.allSettled(
      endpoints.docs.map(async (endpoint: any) => {
        try {
          const res = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(endpoint.secret ? { 'X-Webhook-Secret': endpoint.secret } : {}),
            },
            body: JSON.stringify({ event, data, timestamp }),
            signal: AbortSignal.timeout(10000),
          })

          // Update webhook metadata (best-effort, don't throw on failure)
          try {
            await payload.update({
              collection: slugs.webhookEndpoints as any,
              id: endpoint.id,
              data: {
                lastTriggeredAt: timestamp,
                lastStatus: res.status,
              },
              overrideAccess: true,
            })
          } catch {
            // Ignore metadata update failures
          }
        } catch (error) {
          console.warn(`[support] Webhook delivery failed: ${endpoint.url}`, error)

          // Record the failure
          try {
            await payload.update({
              collection: slugs.webhookEndpoints as any,
              id: endpoint.id,
              data: {
                lastTriggeredAt: timestamp,
                lastStatus: 0,
              },
              overrideAccess: true,
            })
          } catch {
            // Ignore metadata update failures
          }
        }
      }),
    )
  } catch (error) {
    // Never let webhook errors propagate to the caller
    console.error('[support] Failed to fire webhooks:', error)
  }
}
