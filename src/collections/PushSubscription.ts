import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * Web Push subscriptions for agents (browser notifications). Written by the
 * /support/push/subscribe endpoint and drained by `sendPushToUser`.
 */
export function createPushSubscriptionCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.pushSubscriptions,
    labels: { singular: 'Abonnement push', plural: 'Abonnements push' },
    admin: { hidden: true, group: 'Support', defaultColumns: ['user', 'endpoint', 'createdAt'] },
    access: {
      create: () => false, // written via the subscribe endpoint (overrideAccess)
      read: ({ req }) => req.user?.collection === slugs.users,
      update: () => false,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      { name: 'user', type: 'relationship', relationTo: slugs.users, index: true, label: 'Agent' },
      { name: 'endpoint', type: 'text', required: true, index: true, label: 'Endpoint' },
      { name: 'p256dh', type: 'text', label: 'Clé p256dh' },
      { name: 'auth', type: 'text', label: 'Clé auth' },
      { name: 'userAgent', type: 'text', label: 'User-Agent' },
    ],
    timestamps: true,
  }
}
