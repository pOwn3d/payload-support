import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { createAdminNotification } from '../utils/adminNotification'

// ─── Hooks ───────────────────────────────────────────────

function createAlertOnLowRating(slugs: CollectionSlugs, notificationSlug: string): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (operation !== 'create') return doc
    const rating = typeof doc.rating === 'number' ? doc.rating : Number(doc.rating)
    if (!Number.isFinite(rating) || rating > 2) return doc

    try {
      const ticketId = typeof doc.ticket === 'object' ? doc.ticket?.id : doc.ticket
      const ticketNumber = typeof doc.ticket === 'object' ? doc.ticket?.ticketNumber : undefined
      const ticketLabel = ticketNumber || (ticketId ? `#${ticketId}` : '?')

      await createAdminNotification(req.payload, {
        title: `Client mecontent : ${ticketLabel}`,
        message: `Note ${rating}/5${doc.comment ? ` — ${String(doc.comment).slice(0, 200)}` : ''}`,
        type: 'satisfaction',
        link: ticketId ? `/admin/collections/${slugs.tickets}/${ticketId}` : undefined,
      }, notificationSlug)
    } catch (err) {
      console.error('[support] Failed to alert on low rating:', err)
    }
    return doc
  }
}

// ─── Collection factory ──────────────────────────────────

export function createTicketFeedbackCollection(slugs: CollectionSlugs, options?: {
  notificationSlug?: string
}): CollectionConfig {
  const notificationSlug = options?.notificationSlug || 'admin-notifications'

  return {
    slug: 'ticket-feedback',
    labels: {
      singular: 'Feedback ticket',
      plural: 'Feedbacks tickets',
    },
    admin: {
      useAsTitle: 'rating',
      group: 'Support',
      defaultColumns: ['ticket', 'rating', 'client', 'submittedFrom', 'createdAt'],
    },
    access: {
      // Creation is gated by the dedicated endpoint (signed token / portal session).
      // We accept admins and authenticated support clients here; anonymous creation
      // must go through the endpoint which uses overrideAccess.
      create: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) return true
        return false
      },
      read: ({ req }) => {
        // Admins only — keeps feedback private from clients
        return req.user?.collection === slugs.users
      },
      update: () => false,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      {
        name: 'ticket',
        type: 'relationship',
        relationTo: slugs.tickets,
        required: true,
        hasMany: false,
        unique: true,
        label: 'Ticket',
        admin: { readOnly: true },
      },
      {
        name: 'rating',
        type: 'number',
        required: true,
        min: 1,
        max: 5,
        label: 'Note (1-5)',
        admin: { description: '1 = tres insatisfait, 5 = tres satisfait' },
      },
      {
        name: 'comment',
        type: 'textarea',
        label: 'Commentaire',
        admin: { description: 'Commentaire optionnel du client' },
      },
      {
        name: 'client',
        type: 'relationship',
        relationTo: slugs.supportClients,
        label: 'Client',
        admin: { readOnly: true },
      },
      {
        name: 'submittedFrom',
        type: 'select',
        defaultValue: 'portal',
        label: 'Source',
        options: [
          { label: 'Portail', value: 'portal' },
          { label: 'Email', value: 'email' },
          { label: 'Admin', value: 'admin' },
        ],
        admin: { readOnly: true },
      },
    ],
    hooks: {
      afterChange: [createAlertOnLowRating(slugs, notificationSlug)],
    },
    timestamps: true,
  }
}
