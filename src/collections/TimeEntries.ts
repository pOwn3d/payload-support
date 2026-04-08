import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Hooks ───────────────────────────────────────────────

function createRecalculateTicketTime(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    if (!doc.ticket) return

    const { payload } = req
    const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket

    // Sum all time entries for this ticket
    const entries = await payload.find({
      collection: slugs.timeEntries,
      where: { ticket: { equals: ticketId } },
      limit: 0, // all entries
      depth: 0,
      overrideAccess: true,
    })

    const totalMinutes = entries.docs.reduce((sum, entry) => {
      return sum + ((entry.duration as number) || 0)
    }, 0)

    await payload.update({
      collection: slugs.tickets,
      id: ticketId,
      data: { totalTimeMinutes: totalMinutes },
      overrideAccess: true,
    })
  }
}

// ─── Collection factory ──────────────────────────────────

export function createTimeEntriesCollection(slugs: CollectionSlugs): CollectionConfig {
  return {
    slug: slugs.timeEntries,
    labels: {
      singular: 'Entrée de temps',
      plural: 'Entrées de temps',
    },
    admin: {
      group: 'Gestion',
      defaultColumns: ['ticket', 'duration', 'description', 'date'],
    },
    fields: [
      {
        name: 'ticket',
        type: 'relationship',
        relationTo: slugs.tickets,
        required: true,
        label: 'Ticket',
      },
      {
        type: 'row',
        fields: [
          {
            name: 'duration',
            type: 'number',
            required: true,
            label: 'Durée (minutes)',
            min: 1,
            admin: { width: '50%' },
          },
          {
            name: 'date',
            type: 'date',
            required: true,
            label: 'Date',
            defaultValue: () => new Date().toISOString(),
            admin: { width: '50%', date: { displayFormat: 'dd/MM/yyyy' } },
          },
        ],
      },
      {
        name: 'description',
        type: 'textarea',
        label: 'Description du travail',
      },
    ],
    hooks: {
      afterChange: [createRecalculateTicketTime(slugs)],
    },
    access: {
      create: ({ req }) => req.user?.collection === slugs.users,
      read: ({ req }) => req.user?.collection === slugs.users,
      update: ({ req }) => req.user?.collection === slugs.users,
      delete: ({ req }) => req.user?.collection === slugs.users,
    },
    timestamps: true,
  }
}
