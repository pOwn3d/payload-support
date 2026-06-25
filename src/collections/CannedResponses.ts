import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createCannedResponsesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.cannedResponses,
    labels: {
      singular: 'Réponse pré-enregistrée',
      plural: 'Réponses pré-enregistrées',
    },
    admin: {
      hidden: true,
      useAsTitle: 'title',
      group: 'Gestion',
      defaultColumns: ['title', 'category', 'updatedAt'],
    },
    fields: [
      {
        name: 'title',
        type: 'text',
        required: true,
        label: 'Titre',
        admin: {
          description: 'Nom court pour identifier la réponse (ex: "Accusé réception")',
        },
      },
      {
        name: 'category',
        type: 'select',
        label: 'Catégorie',
        options: [
          { label: 'Général', value: 'general' },
          { label: 'Bug', value: 'bug' },
          { label: 'Contenu', value: 'content' },
          { label: 'Fonctionnalité', value: 'feature' },
          { label: 'Hébergement', value: 'hosting' },
          { label: 'Clôture', value: 'closing' },
        ],
      },
      {
        name: 'body',
        type: 'textarea',
        required: true,
        label: 'Contenu',
        admin: {
          description: 'Utilisez {{clientName}} pour le prénom du client, {{ticketNumber}} pour le numéro',
        },
      },
      {
        name: 'sortOrder',
        type: 'number',
        label: 'Ordre',
        defaultValue: 0,
        admin: {
          position: 'sidebar',
        },
      },
    ],
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    timestamps: true,
  }
}
