import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createTicketActivityLogCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.ticketActivityLog,
    labels: {
      singular: 'Activité ticket',
      plural: 'Activités tickets',
    },
    admin: {
      hidden: true,
      group: 'Gestion',
      defaultColumns: ['ticket', 'action', 'actorEmail', 'createdAt'],
    },
    fields: [
      {
        name: 'ticket',
        type: 'relationship',
        relationTo: slugs.tickets,
        required: true,
        label: 'Ticket',
      },
      {
        name: 'action',
        type: 'text',
        required: true,
        label: 'Action',
        admin: {
          description: 'Ex: status_changed, priority_changed, assigned, merged',
        },
      },
      {
        name: 'detail',
        type: 'text',
        label: 'Détail',
        admin: {
          description: 'Ex: "status: open → in_progress"',
        },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'actorType',
            type: 'select',
            label: 'Type acteur',
            options: [
              { label: 'Admin', value: 'admin' },
              { label: 'Client', value: 'client' },
              { label: 'Système', value: 'system' },
            ],
            admin: { width: '50%' },
          },
          {
            name: 'actorEmail',
            type: 'text',
            label: 'Email acteur',
            admin: { width: '50%' },
          },
        ],
      },
    ],
    access: {
      create: () => false, // Created only by hooks via overrideAccess
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        // Clients can read activity logs for their own tickets
        if (req.user?.collection === slugs.supportClients) {
          return { 'ticket.client': { equals: req.user.id } }
        }
        return false
      },
      update: () => false,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    timestamps: true,
  }
}
