import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * Support teams / workspaces. Agents belong to teams; tickets can be assigned to
 * a team. When `SUPPORT_TEAM_SCOPING` is enabled, agents only see the tickets of
 * their teams (plus team-less tickets) — see the Tickets read access.
 */
export function createSupportTeamCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.supportTeams,
    labels: { singular: 'Équipe support', plural: 'Équipes support' },
    admin: { useAsTitle: 'name', group: 'Support', defaultColumns: ['name', 'members'] },
    access: {
      read: ({ req }) => req.user?.collection === slugs.users,
      create: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      { name: 'name', type: 'text', required: true, label: 'Nom' },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'members', type: 'relationship', relationTo: slugs.users, hasMany: true, index: true, label: 'Membres (agents)' },
    ],
    timestamps: true,
  }
}
