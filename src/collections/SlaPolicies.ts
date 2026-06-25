import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Collection factory ──────────────────────────────────

export function createSlaPoliciesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.slaPolicies,
    labels: {
      singular: 'Politique SLA',
      plural: 'Politiques SLA',
    },
    admin: {
      useAsTitle: 'name',
      group: 'Support',
      defaultColumns: ['name', 'priority', 'firstResponseTime', 'resolutionTime', 'businessHoursOnly', 'isDefault'],
    },
    fields: [
      {
        name: 'name',
        type: 'text',
        required: true,
        label: 'Nom',
        admin: {
          description: 'Ex: Standard, Premium, Urgence',
        },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'firstResponseTime',
            type: 'number',
            required: true,
            label: 'Délai 1ère réponse (min)',
            min: 1,
            admin: {
              width: '50%',
              description: 'Temps cible en minutes pour la première réponse',
            },
          },
          {
            name: 'resolutionTime',
            type: 'number',
            required: true,
            label: 'Délai résolution (min)',
            min: 1,
            admin: {
              width: '50%',
              description: 'Temps cible en minutes pour la résolution complète',
            },
          },
        ],
      },
      {
        name: 'priority',
        type: 'select',
        required: true,
        label: 'Priorité',
        options: [
          { label: 'Basse', value: 'low' },
          { label: 'Normale', value: 'normal' },
          { label: 'Haute', value: 'high' },
          { label: 'Urgente', value: 'urgent' },
        ],
        admin: {
          description: 'Priorité de ticket à laquelle cette politique s\'applique',
        },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'businessHoursOnly',
            type: 'checkbox',
            defaultValue: true,
            label: 'Heures ouvrées uniquement',
            admin: {
              width: '50%',
              description: 'Compter uniquement les heures ouvrées (lun-ven, 9h-18h)',
            },
          },
          {
            name: 'escalateOnBreach',
            type: 'checkbox',
            defaultValue: false,
            label: 'Escalade auto sur dépassement',
            admin: {
              width: '50%',
              description: 'Notifier automatiquement en cas de dépassement SLA',
            },
          },
        ],
      },
      {
        name: 'escalateTo',
        type: 'relationship',
        relationTo: slugs.users,
        label: 'Escalader à',
        admin: {
          description: 'Utilisateur à notifier en cas de dépassement SLA',
          condition: (data) => data?.escalateOnBreach === true,
        },
      },
      {
        name: 'isDefault',
        type: 'checkbox',
        defaultValue: false,
        label: 'Politique par défaut',
        admin: {
          description: 'Utiliser cette politique pour les tickets sans SLA spécifique (par priorité)',
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
