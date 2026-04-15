import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs.js'

/**
 * Client Intelligence Summaries
 * Stores AI-generated summaries per client: recurring topics, patterns, satisfaction trends.
 * Summaries are cached and refreshed on-demand or when a ticket is resolved.
 */
export function createClientSummariesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: 'client-summaries',
    labels: { singular: 'Résumé client', plural: 'Résumés clients' },
    admin: {
      group: 'Support',
      hidden: true, // Not directly editable — managed via API
      defaultColumns: ['client', 'generatedAt', 'ticketCount'],
      useAsTitle: 'clientName',
    },
    fields: [
      {
        name: 'client',
        type: 'relationship',
        relationTo: slugs.supportClients,
        required: true,
        index: true,
        label: 'Client',
      },
      {
        name: 'clientName',
        type: 'text',
        label: 'Nom client',
        admin: { readOnly: true },
      },
      // ── AI-generated content ──
      {
        name: 'summary',
        type: 'textarea',
        label: 'Résumé global',
        admin: { readOnly: true },
      },
      {
        name: 'recurringTopics',
        type: 'json',
        label: 'Sujets récurrents',
        admin: { readOnly: true },
        // Array of { topic: string, count: number, lastSeen: string }
      },
      {
        name: 'patterns',
        type: 'json',
        label: 'Patterns détectés',
        admin: { readOnly: true },
        // Array of strings: "Revient souvent pour X", "Préfère le tutoiement", etc.
      },
      {
        name: 'keyFacts',
        type: 'json',
        label: 'Faits clés',
        admin: { readOnly: true },
        // Array of strings: "Hébergé chez OVH", "Site WordPress", etc.
      },
      // ── Stats ──
      {
        name: 'ticketCount',
        type: 'number',
        label: 'Nombre de tickets analysés',
        defaultValue: 0,
        admin: { readOnly: true },
      },
      {
        name: 'messageCount',
        type: 'number',
        label: 'Nombre de messages analysés',
        defaultValue: 0,
        admin: { readOnly: true },
      },
      {
        name: 'averageSatisfaction',
        type: 'number',
        label: 'Satisfaction moyenne',
        admin: { readOnly: true },
      },
      {
        name: 'firstTicketAt',
        type: 'date',
        label: 'Premier ticket',
        admin: { readOnly: true },
      },
      {
        name: 'lastTicketAt',
        type: 'date',
        label: 'Dernier ticket',
        admin: { readOnly: true },
      },
      // ── Meta ──
      {
        name: 'generatedAt',
        type: 'date',
        label: 'Généré le',
        admin: { readOnly: true, date: { displayFormat: 'dd/MM/yyyy HH:mm' } },
      },
      {
        name: 'aiModel',
        type: 'text',
        label: 'Modèle IA utilisé',
        admin: { readOnly: true },
      },
    ],
    access: {
      create: ({ req }) => req.user?.collection === 'users',
      read: ({ req }) => req.user?.collection === 'users',
      update: ({ req }) => req.user?.collection === 'users',
      delete: ({ req }) => req.user?.collection === 'users',
    },
    timestamps: true,
  }
}
