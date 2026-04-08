import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createWebhookEndpointsCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.webhookEndpoints,
    labels: {
      singular: 'Webhook',
      plural: 'Webhooks',
    },
    admin: {
      useAsTitle: 'name',
      group: 'Support',
      defaultColumns: ['name', 'url', 'events', 'active', 'lastTriggeredAt', 'lastStatus'],
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      {
        name: 'name',
        type: 'text',
        required: true,
        label: 'Nom',
        admin: {
          description: 'Ex: Slack notifications, n8n workflow…',
        },
      },
      {
        name: 'url',
        type: 'text',
        required: true,
        label: 'URL',
        admin: {
          description: 'URL du webhook à appeler (POST)',
        },
      },
      {
        name: 'secret',
        type: 'text',
        label: 'Secret HMAC',
        admin: {
          description: 'Secret optionnel pour signer les payloads (HMAC-SHA256, header X-Webhook-Signature)',
        },
      },
      {
        name: 'events',
        type: 'select',
        hasMany: true,
        required: true,
        label: 'Événements',
        options: [
          { label: 'Ticket créé', value: 'ticket_created' },
          { label: 'Ticket résolu', value: 'ticket_resolved' },
          { label: 'Réponse au ticket', value: 'ticket_replied' },
          { label: 'Ticket assigné', value: 'ticket_assigned' },
          { label: 'SLA dépassé', value: 'sla_breached' },
        ],
        admin: {
          description: 'Événements qui déclenchent ce webhook',
        },
      },
      {
        name: 'active',
        type: 'checkbox',
        defaultValue: true,
        label: 'Actif',
      },
      {
        name: 'lastTriggeredAt',
        type: 'date',
        label: 'Dernier déclenchement',
        admin: {
          readOnly: true,
          date: { displayFormat: 'dd/MM/yyyy HH:mm' },
          position: 'sidebar',
        },
      },
      {
        name: 'lastStatus',
        type: 'number',
        label: 'Dernier statut HTTP',
        admin: {
          readOnly: true,
          position: 'sidebar',
        },
      },
    ],
    timestamps: true,
  }
}
