import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createKnowledgeBaseCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.knowledgeBase,
    labels: {
      singular: 'Article FAQ',
      plural: 'Base de connaissances',
    },
    admin: {
      hidden: true,
      useAsTitle: 'title',
      group: 'Support',
      defaultColumns: ['title', 'category', 'published', 'sortOrder', 'updatedAt'],
    },
    fields: [
      {
        name: 'title',
        type: 'text',
        required: true,
        label: 'Titre / Question',
      },
      {
        name: 'slug',
        type: 'text',
        required: true,
        unique: true,
        label: 'Slug',
        admin: {
          description: 'URL-friendly identifier (auto-generated from title if empty)',
        },
      },
      {
        name: 'category',
        type: 'select',
        required: true,
        label: 'Catégorie',
        options: [
          { label: 'Premiers pas', value: 'getting-started' },
          { label: 'Tickets & Support', value: 'tickets' },
          { label: 'Compte & Profil', value: 'account' },
          { label: 'Facturation', value: 'billing' },
          { label: 'Technique', value: 'technical' },
          { label: 'Général', value: 'general' },
        ],
      },
      {
        name: 'body',
        type: 'richText',
        required: true,
        label: 'Contenu',
      },
      {
        name: 'published',
        type: 'checkbox',
        defaultValue: true,
        label: 'Publié',
        admin: { position: 'sidebar' },
      },
      {
        name: 'sortOrder',
        type: 'number',
        defaultValue: 0,
        label: 'Ordre',
        admin: { position: 'sidebar' },
      },
    ],
    hooks: {
      beforeChange: [
        async ({ data, operation }) => {
          // Auto-generate slug from title if not set
          if (operation === 'create' && !data.slug && data.title) {
            data.slug = data.title
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
          }
          return data
        },
      ],
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
      // Public read for published articles (support-clients + unauthenticated)
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        return { published: { equals: true } }
      },
    },
    timestamps: true,
  }
}
