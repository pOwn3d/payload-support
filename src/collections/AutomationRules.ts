import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

const CONDITION_FIELDS = ['status', 'priority', 'category', 'source', 'subject'] as const
const ACTION_TYPES = [
  { label: 'Définir le statut', value: 'set_status' },
  { label: 'Définir la priorité', value: 'set_priority' },
  { label: 'Définir la catégorie', value: 'set_category' },
  { label: 'Assigner à (id agent)', value: 'assign' },
  { label: 'Ajouter un tag', value: 'add_tag' },
]

/**
 * Visual automation rules (Zendesk-style triggers): when an event fires, if the
 * conditions match the ticket, the actions are applied. Evaluated by the
 * `createApplyAutomationRules` hook on the Tickets collection.
 */
export function createAutomationRulesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.automationRules,
    labels: { singular: 'Règle d\'automatisation', plural: 'Règles d\'automatisation' },
    admin: { useAsTitle: 'name', group: 'Support', defaultColumns: ['name', 'event', 'enabled', 'order'] },
    access: {
      read: ({ req }) => req.user?.collection === slugs.users,
      create: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      { name: 'name', type: 'text', required: true, label: 'Nom' },
      { name: 'enabled', type: 'checkbox', defaultValue: true, label: 'Active', index: true },
      {
        name: 'event', type: 'select', defaultValue: 'ticket_created', index: true, label: 'Déclencheur',
        options: [
          { label: 'Ticket créé', value: 'ticket_created' },
          { label: 'Ticket mis à jour', value: 'ticket_updated' },
          { label: 'Changement de statut', value: 'ticket_status_changed' },
        ],
      },
      {
        name: 'matchType', type: 'select', defaultValue: 'all', label: 'Correspondance',
        options: [{ label: 'Toutes les conditions (ET)', value: 'all' }, { label: 'Au moins une (OU)', value: 'any' }],
      },
      { name: 'order', type: 'number', defaultValue: 0, label: 'Ordre d\'évaluation' },
      {
        name: 'conditions', type: 'array', label: 'Conditions',
        fields: [
          { name: 'field', type: 'select', required: true, options: CONDITION_FIELDS.map((v) => ({ label: v, value: v })) },
          {
            name: 'operator', type: 'select', defaultValue: 'equals', required: true,
            options: [{ label: '= égal', value: 'equals' }, { label: '≠ différent', value: 'not_equals' }, { label: 'contient', value: 'contains' }],
          },
          { name: 'value', type: 'text', required: true },
        ],
      },
      {
        name: 'actions', type: 'array', label: 'Actions',
        fields: [
          { name: 'type', type: 'select', required: true, options: ACTION_TYPES },
          { name: 'value', type: 'text', required: true },
        ],
      },
    ],
    timestamps: true,
  }
}
