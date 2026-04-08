import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createSatisfactionSurveysCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.satisfactionSurveys,
    labels: {
      singular: 'Enquête satisfaction',
      plural: 'Enquêtes satisfaction',
    },
    admin: {
      hidden: true,
      group: 'Support',
      defaultColumns: ['source', 'rating', 'client', 'createdAt'],
    },
    fields: [
      {
        name: 'source',
        type: 'select',
        options: [
          { label: 'Ticket', value: 'ticket' },
          { label: 'Live Chat', value: 'live-chat' },
        ],
        defaultValue: 'ticket',
        required: true,
        label: 'Source',
        admin: {
          description: 'Ticket de support ou session de chat en direct',
        },
      },
      {
        name: 'ticket',
        type: 'relationship',
        relationTo: slugs.tickets,
        unique: true,
        label: 'Ticket',
        admin: {
          condition: (data) => data?.source === 'ticket',
        },
      },
      {
        name: 'chatSession',
        type: 'text',
        unique: true,
        label: 'Session Chat',
        admin: {
          condition: (data) => data?.source === 'live-chat',
          description: 'ID de la session live chat',
        },
      },
      {
        name: 'client',
        type: 'relationship',
        relationTo: slugs.supportClients,
        required: true,
        label: 'Client',
      },
      {
        name: 'rating',
        type: 'number',
        required: true,
        min: 1,
        max: 5,
        label: 'Note (1-5)',
        admin: {
          description: '1 = Très insatisfait, 5 = Très satisfait',
        },
      },
      {
        name: 'comment',
        type: 'textarea',
        label: 'Commentaire',
        admin: {
          description: 'Feedback libre du client',
        },
      },
    ],
    access: {
      create: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) return true
        return false
      },
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } }
        }
        return false
      },
      update: () => false, // Surveys are immutable once submitted
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    timestamps: true,
  }
}
