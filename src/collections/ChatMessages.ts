import { APIError } from 'payload'
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFind } from '../utils/db'

/**
 * Cross-tenant write guard for support-clients.
 *
 * `access.create` used to be `!!req.user`, which any principal of ANY auth
 * collection satisfies — including a front-office member of the host app. With
 * no hook validating the row, an attacker could POST a message attributed to
 * someone else's `client` and flagged `senderType: 'agent'` with an arbitrary
 * `agent` relation: the agent console and the targeted client both render it as
 * a genuine conversation (phishing over a trusted channel).
 *
 * Mirrors `createRestrictClientTicketTarget` on ticket-messages: the client's
 * own identity is FORCED onto the row instead of being trusted from the body.
 * Internal writers (endpoints/chat.ts, endpoints/admin-chat.ts,
 * collections/TicketMessages.ts) all write with `overrideAccess: true` and carry
 * no support-client user, so they are untouched.
 */
function createRestrictClientChatWrite(slugs: CollectionSlugs): CollectionBeforeChangeHook {
  return async ({ data, req }) => {
    if (req.user?.collection !== slugs.supportClients) return data
    data.client = req.user.id
    data.senderType = 'client'
    delete data.agent

    // …and the SESSION has to be theirs too. Forcing `client` alone still let a
    // client drop a line INTO someone else's conversation: the agent console
    // loads a thread by session id with `overrideAccess: true`
    // (endpoints/admin-chat.ts), so the injected message surfaces in the target's
    // thread even though `access.read` hides it from the target themselves.
    // Session ids are 16 random bytes, so this is depth rather than a reachable
    // hole — and it costs one indexed lookup on a path no internal writer takes
    // (chat.ts / admin-chat.ts write without a support-client `req`).
    const session = typeof data.session === 'string' ? data.session : null
    if (!session) return data

    const existing = await dbFind(req.payload, slugs.chatMessages, {
      where: { session: { equals: session } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const owner = existing.docs[0]?.client
    const ownerId = owner && typeof owner === 'object' ? (owner as { id?: unknown }).id : owner
    if (ownerId !== undefined && ownerId !== null && String(ownerId) !== String(req.user.id)) {
      throw new APIError('Session inaccessible.', 403)
    }
    return data
  }
}

// ─── Collection factory ──────────────────────────────────

export function createChatMessagesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.chatMessages,
    labels: {
      singular: 'Message Chat',
      plural: 'Messages Chat',
    },
    admin: {
      hidden: true,
      useAsTitle: 'message',
      group: 'Support',
      defaultColumns: ['session', 'senderType', 'message', 'createdAt'],
    },
    access: {
      read: ({ req }) => {
        if (req.user?.collection === slugs.users) return true
        if (req.user?.collection === slugs.supportClients) {
          return { client: { equals: req.user.id } }
        }
        return false
      },
      // Staff and support-clients only — NOT "any authenticated principal":
      // a user of any other auth collection of the host app satisfied `!!req.user`.
      create: ({ req }) =>
        req.user?.collection === slugs.users || req.user?.collection === slugs.supportClients,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    fields: [
      {
        name: 'session',
        type: 'text',
        required: true,
        index: true,
        label: 'Session ID',
        admin: { description: 'Identifiant unique de la session de chat' },
      },
      {
        name: 'client',
        type: 'relationship',
        relationTo: slugs.supportClients,
        required: true,
        label: 'Client',
      },
      {
        name: 'senderType',
        type: 'select',
        required: true,
        defaultValue: 'client',
        options: [
          { label: 'Client', value: 'client' },
          { label: 'Agent', value: 'agent' },
          { label: 'Système', value: 'system' },
        ],
        label: 'Type d\'expéditeur',
      },
      {
        name: 'agent',
        type: 'relationship',
        relationTo: slugs.users,
        label: 'Agent',
        admin: {
          condition: (data) => data?.senderType === 'agent',
        },
      },
      {
        name: 'message',
        type: 'textarea',
        required: true,
        label: 'Message',
      },
      {
        name: 'status',
        type: 'select',
        defaultValue: 'active',
        options: [
          { label: 'Actif', value: 'active' },
          { label: 'Fermé', value: 'closed' },
        ],
        label: 'Statut de la session',
        admin: { position: 'sidebar' },
      },
      {
        name: 'ticket',
        type: 'relationship',
        relationTo: slugs.tickets,
        label: 'Ticket lié',
        admin: {
          position: 'sidebar',
          description: 'Ticket créé automatiquement pour cette session',
        },
      },
    ],
    hooks: {
      beforeChange: [createRestrictClientChatWrite(slugs)],
    },
    timestamps: true,
  }
}
