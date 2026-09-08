import { APIError } from 'payload'
import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { WEBHOOK_URL_MESSAGES, validateWebhookUrl } from '../utils/urlSafety'

/**
 * First SSRF layer: the value is fetched by the SERVER on every ticket event, so
 * a loopback / private / link-local target (or a non-https scheme) must never be
 * SAVED. The send path re-checks the resolved address and every redirect hop —
 * see `utils/urlSafety.ts`.
 *
 * Why a collection hook rather than a field `validate`: Payload re-validates the
 * MERGED document on every write, so a field-level guard also fires on partial
 * updates that never mention `url`. A row saved before this guard existed (or
 * seeded through `payload.db`, which runs no hooks) then became totally
 * immutable — impossible to rename, to re-scope its events, even to set
 * `active: false` — and the dispatcher's own bookkeeping write (`lastStatus: 0`,
 * issued inside a `catch` that swallows errors) failed silently, leaving a dead
 * endpoint looking healthy in the admin.
 *
 * So only a URL actually being SET or CHANGED is checked. Leaving an existing
 * bad value alone costs nothing: the send path refuses to call it anyway.
 */
function createValidateWebhookUrl(): CollectionBeforeValidateHook {
  return ({ data, operation, originalDoc }) => {
    const incoming = (data as { url?: unknown } | undefined)?.url
    if (incoming === undefined || incoming === null) return data

    const previous = (originalDoc as { url?: unknown } | undefined)?.url
    if (operation === 'update' && incoming === previous) return data

    const result = validateWebhookUrl(incoming)
    if (!result.ok) {
      throw new APIError(WEBHOOK_URL_MESSAGES[result.reason || 'invalid_url'], 400)
    }
    return data
  }
}

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
        // The SSRF check lives in the collection `beforeValidate` above, NOT in a
        // field `validate`: the latter re-runs on the merged document and would
        // freeze every pre-existing row on any unrelated edit.
        admin: {
          description: 'URL https:// du webhook à appeler (POST). Les adresses privées et loopback sont refusées.',
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
    hooks: {
      beforeValidate: [createValidateWebhookUrl()],
    },
    timestamps: true,
  }
}
