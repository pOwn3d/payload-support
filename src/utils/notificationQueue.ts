import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { dbCreate } from './db'

export interface QueuedNotification {
  client: number | string
  type: string
  title: string
  message: string
  ticket?: number | string
}

/**
 * Queue a client notification for later digest delivery (best-effort). Used when
 * the client opted into `daily`/`weekly` notification frequency instead of immediate.
 */
export async function queueClientNotification(
  payload: Payload,
  slugs: CollectionSlugs,
  item: QueuedNotification,
): Promise<void> {
  try {
    await dbCreate(payload, slugs.notificationQueue, {
      data: {
        client: item.client,
        type: item.type,
        title: item.title,
        message: item.message,
        ...(item.ticket ? { ticket: item.ticket } : {}),
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[support] Failed to queue client notification:', err)
  }
}
