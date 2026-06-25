import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * Pending client notifications, queued instead of sent immediately when the
 * client's `notificationFrequency` is `daily` or `weekly`. The `process-digests`
 * cron drains this per client and sends a single recap email.
 */
export function createNotificationQueueCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.notificationQueue,
    labels: { singular: 'Notification en file', plural: 'Notifications en file' },
    admin: { hidden: true, group: 'Support', defaultColumns: ['client', 'type', 'title', 'createdAt'] },
    access: {
      // Internal: written/drained only via overrideAccess (hooks + cron).
      create: () => false,
      update: () => false,
      read: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      { name: 'client', type: 'relationship', relationTo: slugs.supportClients, required: true, index: true, label: 'Client' },
      { name: 'type', type: 'text', label: 'Type' },
      { name: 'title', type: 'text', label: 'Titre' },
      { name: 'message', type: 'textarea', label: 'Message' },
      { name: 'ticket', type: 'relationship', relationTo: slugs.tickets, label: 'Ticket' },
    ],
    timestamps: true,
  }
}
