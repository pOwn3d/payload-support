import type { Payload } from 'payload'

/**
 * Helper to create an admin notification.
 * Can be called from any hook or endpoint.
 *
 * @param payload - Payload instance
 * @param data - Notification data
 * @param collectionSlug - Override collection slug (default: 'admin-notifications')
 */
export async function createAdminNotification(
  payload: Payload,
  data: {
    title: string
    message?: string
    type: 'info' | 'new_ticket' | 'client_message' | 'quote_request' | 'urgent_ticket' | 'post_published' | 'satisfaction' | 'sla_alert'
    link?: string
    recipient?: number | string
  },
  collectionSlug = 'admin-notifications',
): Promise<void> {
  try {
    await payload.create({
      collection: collectionSlug as any,
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
        recipient: data.recipient,
        read: false,
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[notification] Failed to create:', err)
  }
}
