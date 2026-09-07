import type { CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * Collaborators (viewers/contributors) added to a ticket by the primary client owner.
 *
 * Created via the `/api/support/tickets/:id/invite` endpoint. Each row links a
 * ticket to a `support-clients` (the invitee) with a role: `viewer` (read-only)
 * or `collaborator` (can post messages, when wired up later).
 *
 * Access logic on Tickets/TicketMessages should OR this table to grant access
 * to invited clients without losing existing ownership-based rules.
 */
export function createTicketCollaboratorsCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: 'ticket-collaborators',
    labels: {
      singular: 'Collaborateur ticket',
      plural: 'Collaborateurs tickets',
    },
    admin: {
      useAsTitle: 'email',
      group: 'Support',
      defaultColumns: ['email', 'ticket', 'client', 'role', 'invitedBy', 'createdAt'],
    },
    access: {
      // Admins always; clients only see rows that reference them.
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } }
        }
        return false
      },
      // Staff only. This collection is the source of truth for
      // resolveAccessibleTicketIds(), which widens `read` on tickets, messages
      // and the activity log — so letting any authenticated principal POST here
      // let a support client grant themselves access to any ticket by id.
      // The /invite endpoint is unaffected: it writes with overrideAccess: true.
      create: ({ req }) => req.user?.collection === slugs.users,
      update: () => false,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      {
        name: 'ticket',
        type: 'relationship',
        relationTo: slugs.tickets,
        required: true,
        hasMany: false,
        label: 'Ticket',
      },
      {
        name: 'client',
        type: 'relationship',
        relationTo: slugs.supportClients,
        required: true,
        label: 'Client invité',
      },
      {
        name: 'email',
        type: 'email',
        index: true,
        label: 'Email invité',
        admin: { description: 'Cache de l\'email du client invité au moment de l\'invitation' },
      },
      {
        name: 'role',
        type: 'select',
        defaultValue: 'viewer',
        options: [
          { label: 'Lecteur', value: 'viewer' },
          { label: 'Collaborateur', value: 'collaborator' },
        ],
        label: 'Rôle',
      },
      {
        name: 'invitedBy',
        type: 'relationship',
        relationTo: [slugs.users, slugs.supportClients],
        required: true,
        label: 'Invité par',
      },
      {
        name: 'acceptedAt',
        type: 'date',
        label: 'Accepté le',
      },
      {
        name: 'invitationToken',
        type: 'text',
        index: true,
        admin: { hidden: true },
      },
    ],
    timestamps: true,
  }
}
