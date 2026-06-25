import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createChatMessagesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.chatMessages,
    labels: {
      singular: 'Message Chat',
      plural: 'Messages Chat',
    },
    admin: {
      hidden: true,
      useAsTitle: 'message',
      group: 'Support',
      defaultColumns: ['session', 'senderType', 'message', 'createdAt'],
    },
    access: {
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } }
        }
        return false
      },
      create: ({ req }) => !!req.user,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      {
        name: 'session',
        type: 'text',
        required: true,
        index: true,
        label: 'Session ID',
        admin: { description: 'Identifiant unique de la session de chat' },
      },
      {
        name: 'client',
        type: 'relationship',
        relationTo: slugs.supportClients,
        required: true,
        label: 'Client',
      },
      {
        name: 'senderType',
        type: 'select',
        required: true,
        defaultValue: 'client',
        options: [
          { label: 'Client', value: 'client' },
          { label: 'Agent', value: 'agent' },
          { label: 'Système', value: 'system' },
        ],
        label: 'Type d\'expéditeur',
      },
      {
        name: 'agent',
        type: 'relationship',
        relationTo: slugs.users,
        label: 'Agent',
        admin: {
          condition: (data) => data?.senderType === 'agent',
        },
      },
      {
        name: 'message',
        type: 'textarea',
        required: true,
        label: 'Message',
      },
      {
        name: 'status',
        type: 'select',
        defaultValue: 'active',
        options: [
          { label: 'Actif', value: 'active' },
          { label: 'Fermé', value: 'closed' },
        ],
        label: 'Statut de la session',
        admin: { position: 'sidebar' },
      },
      {
        name: 'ticket',
        type: 'relationship',
        relationTo: slugs.tickets,
        label: 'Ticket lié',
        admin: {
          position: 'sidebar',
          description: 'Ticket créé automatiquement pour cette session',
        },
      },
    ],
    timestamps: true,
  }
}
