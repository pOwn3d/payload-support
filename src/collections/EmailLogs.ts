import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createEmailLogsCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.emailLogs,
    labels: {
      singular: 'Journal email',
      plural: 'Journal des emails',
    },
    admin: {
      group: 'Support',
      defaultColumns: ['status', 'action', 'senderEmail', 'subject', 'createdAt'],
      useAsTitle: 'subject',
      enableRichTextRelationship: false,
    },
    access: {
      read: ({ req: { user } }) => Boolean(user),
      create: () => false, // Logs are system-generated (server-side uses overrideAccess)
      update: () => false,
      delete: ({ req: { user } }) => Boolean(user),
    },
    fields: [
      {
        name: 'status',
        type: 'select',
        required: true,
        index: true,
        options: [
          { label: 'Succès', value: 'success' },
          { label: 'Ignoré', value: 'ignored' },
          { label: 'Erreur', value: 'error' },
        ],
      },
      {
        name: 'action',
        type: 'text',
        index: true,
        admin: { description: 'Action effectuée (ticket_created, message_added, ignored, error...)' },
      },
      {
        name: 'senderEmail',
        type: 'email',
        index: true,
      },
      {
        name: 'senderName',
        type: 'text',
      },
      {
        name: 'subject',
        type: 'text',
      },
      {
        name: 'recipientEmail',
        type: 'text',
        admin: { description: 'Champ TO (peut être vide)' },
      },
      {
        name: 'cc',
        type: 'text',
        admin: { description: 'Champ CC' },
      },
      {
        name: 'ticketNumber',
        type: 'text',
        admin: { description: 'Numéro du ticket créé ou mis à jour' },
      },
      {
        name: 'errorMessage',
        type: 'textarea',
        admin: { description: 'Message d\'erreur si échec' },
      },
      {
        name: 'attachments',
        type: 'json',
        admin: { description: 'Métadonnées des pièces jointes [{filename, size, contentType}]' },
      },
      {
        name: 'httpStatus',
        type: 'number',
        admin: { description: 'Code HTTP de la réponse' },
      },
      {
        name: 'processingTimeMs',
        type: 'number',
        admin: { description: 'Temps de traitement en ms' },
      },
    ],
    timestamps: true,
  }
}
