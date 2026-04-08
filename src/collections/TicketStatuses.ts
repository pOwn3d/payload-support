import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createTicketStatusesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.ticketStatuses,
    labels: {
      singular: 'Statut de ticket',
      plural: 'Statuts de ticket',
    },
    admin: {
      useAsTitle: 'name',
      group: 'Support',
      defaultColumns: ['name', 'slug', 'type', 'color', 'isDefault', 'sortOrder'],
    },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'name',
            type: 'text',
            required: true,
            label: 'Nom',
            admin: {
              width: '50%',
              description: 'Libellé affiché (ex: "Ouvert", "En attente client")',
            },
          },
          {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            label: 'Slug',
            admin: {
              width: '50%',
              description: 'Identifiant technique unique (ex: "open", "waiting_client")',
            },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'color',
            type: 'text',
            required: true,
            label: 'Couleur',
            admin: {
              width: '50%',
              description: 'Couleur hexadécimale (ex: #22c55e)',
            },
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            label: 'Type sémantique',
            options: [
              { label: 'Ouvert', value: 'open' },
              { label: 'En attente', value: 'pending' },
              { label: 'Fermé', value: 'closed' },
            ],
            admin: {
              width: '50%',
              description: 'Type logique pour la logique SLA et auto-close',
            },
          },
        ],
      },
      {
        name: 'isDefault',
        type: 'checkbox',
        defaultValue: false,
        label: 'Statut par défaut',
        admin: {
          position: 'sidebar',
          description: 'Statut assigné automatiquement aux nouveaux tickets',
        },
      },
      {
        name: 'sortOrder',
        type: 'number',
        defaultValue: 0,
        label: 'Ordre',
        admin: {
          position: 'sidebar',
        },
      },
    ],
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => {
        // Authenticated users (admin or support-clients) can read statuses
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) return true
        return false
      },
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    timestamps: true,
  }
}
