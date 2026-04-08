import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createAuthLogsCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.authLogs,
    labels: {
      singular: "Journal d'authentification",
      plural: "Journal d'authentification",
    },
    admin: {
      group: 'Support',
      defaultColumns: ['email', 'success', 'action', 'errorReason', 'createdAt'],
      useAsTitle: 'email',
    },
    access: {
      read: ({ req: { user } }) => Boolean(user),
      create: () => false, // Logs are system-generated (server-side uses overrideAccess)
      update: () => false,
      delete: ({ req: { user } }) => Boolean(user),
    },
    fields: [
      {
        name: 'email',
        type: 'email',
        required: true,
        index: true,
      },
      {
        name: 'success',
        type: 'checkbox',
        defaultValue: false,
        index: true,
      },
      {
        name: 'action',
        type: 'select',
        required: true,
        index: true,
        options: [
          { label: 'Connexion', value: 'login' },
          { label: 'Déconnexion', value: 'logout' },
          { label: 'Mot de passe oublié', value: 'forgot-password' },
          { label: 'Inscription', value: 'register' },
        ],
      },
      {
        name: 'errorReason',
        type: 'text',
        admin: { description: 'Raison de l\'échec (mot de passe incorrect, compte verrouillé, etc.)' },
      },
      {
        name: 'ipAddress',
        type: 'text',
      },
      {
        name: 'userAgent',
        type: 'text',
      },
    ],
    timestamps: true,
  }
}
