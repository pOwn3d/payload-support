import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createMacrosCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.macros,
    labels: {
      singular: 'Macro',
      plural: 'Macros',
    },
    admin: {
      useAsTitle: 'name',
      group: 'Support',
      defaultColumns: ['name', 'description', 'sortOrder', 'isActive', 'updatedAt'],
    },
    fields: [
      {
        name: 'name',
        type: 'text',
        required: true,
        label: 'Nom',
        admin: {
          description: 'Nom court pour identifier la macro (ex: "Clôturer & remercier")',
        },
      },
      {
        name: 'description',
        type: 'text',
        label: 'Description',
        admin: {
          description: 'Description optionnelle de ce que fait la macro',
        },
      },
      {
        name: 'actions',
        type: 'array',
        required: true,
        label: 'Actions',
        minRows: 1,
        admin: {
          description: 'Liste des actions exécutées dans l\'ordre',
        },
        fields: [
          {
            name: 'type',
            type: 'select',
            required: true,
            label: 'Type d\'action',
            options: [
              { label: 'Changer le statut', value: 'set_status' },
              { label: 'Changer la priorité', value: 'set_priority' },
              { label: 'Ajouter un tag', value: 'add_tag' },
              { label: 'Envoyer une réponse', value: 'send_reply' },
              { label: 'Assigner', value: 'assign' },
            ],
          },
          {
            name: 'value',
            type: 'text',
            required: true,
            label: 'Valeur',
            admin: {
              description: 'Statut, priorité, tag, corps de la réponse, ou ID utilisateur selon le type',
            },
          },
        ],
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
      {
        name: 'isActive',
        type: 'checkbox',
        defaultValue: true,
        label: 'Active',
        admin: {
          position: 'sidebar',
          description: 'Désactiver pour masquer la macro sans la supprimer',
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
