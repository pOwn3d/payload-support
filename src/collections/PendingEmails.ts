import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createPendingEmailsCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.pendingEmails,
    admin: {
      group: 'Support',
      useAsTitle: 'subject',
      defaultColumns: ['status', 'senderEmail', 'subject', 'createdAt'],
      hidden: true, // Managed via custom admin view
    },
    access: {
      read: ({ req }) => Boolean(req.user?.collection === slugs.users),
      update: ({ req }) => Boolean(req.user?.collection === slugs.users),
      delete: ({ req }) => Boolean(req.user?.collection === slugs.users),
      create: ({ req }) => {
        // Allow admin users or webhook calls with secret header
        if (req.user?.collection === slugs.users) return true
        const webhookSecret = req.headers.get('x-webhook-secret')
        if (webhookSecret && process.env.SUPPORT_WEBHOOK_SECRET && webhookSecret === process.env.SUPPORT_WEBHOOK_SECRET) return true
        return false
      },
    },
    fields: [
      {
        name: 'senderEmail',
        type: 'email',
        required: true,
        index: true,
      },
      {
        name: 'senderName',
        type: 'text',
      },
      {
        name: 'subject',
        type: 'text',
        required: true,
      },
      {
        name: 'rawSubject',
        type: 'text',
        admin: { readOnly: true },
      },
      {
        name: 'body',
        type: 'textarea',
        required: true,
      },
      {
        name: 'bodyHtml',
        type: 'textarea',
        admin: { readOnly: true },
      },
      {
        name: 'client',
        type: 'relationship',
        relationTo: slugs.supportClients,
      },
      {
        name: 'attachments',
        type: 'array',
        fields: [
          {
            name: 'file',
            type: 'upload',
            relationTo: slugs.media,
            required: true,
          },
        ],
      },
      {
        name: 'status',
        type: 'select',
        defaultValue: 'pending',
        index: true,
        options: [
          { label: 'En attente', value: 'pending' },
          { label: 'Traité', value: 'processed' },
          { label: 'Ignoré', value: 'ignored' },
        ],
      },
      {
        name: 'processedAction',
        type: 'select',
        options: [
          { label: 'Ticket créé', value: 'ticket_created' },
          { label: 'Message ajouté', value: 'message_added' },
          { label: 'Ignoré', value: 'ignored' },
        ],
        admin: { condition: (data) => data?.status !== 'pending' },
      },
      {
        name: 'processedTicket',
        type: 'relationship',
        relationTo: slugs.tickets,
        admin: { condition: (data) => data?.processedAction === 'ticket_created' || data?.processedAction === 'message_added' },
      },
      {
        name: 'processedAt',
        type: 'date',
        admin: { condition: (data) => data?.status !== 'pending' },
      },
      {
        name: 'suggestedTickets',
        type: 'json',
        admin: { readOnly: true },
      },
      {
        name: 'cc',
        type: 'text',
      },
      {
        name: 'recipientEmail',
        type: 'text',
      },
    ],
  }
}
