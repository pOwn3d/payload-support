import type { CollectionConfig, CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'
import type { Payload } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

// ─── Hooks ───────────────────────────────────────────────

/**
 * `req` is forwarded to every operation so the rollup joins the caller's
 * transaction. Reading or writing outside it would see a stale total and, on
 * SQLite, contend with the very transaction that triggered the hook.
 */
async function recalculateTicketTime(
  payload: Payload,
  slugs: CollectionSlugs,
  ticketId: number | string,
  req?: PayloadRequest,
): Promise<void> {
  // Sum all time entries for this ticket, paginating to avoid loading all at once
  let totalMinutes = 0
  let page = 1
  let hasMore = true

  while (hasMore) {
    const entries = await payload.find({
      collection: slugs.timeEntries,
      where: { ticket: { equals: ticketId } },
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
      select: { duration: true },
      req,
    })

    for (const entry of entries.docs) {
      totalMinutes += ((entry.duration as number) || 0)
    }

    hasMore = entries.hasNextPage ?? false
    page++
  }

  await payload.update({
    collection: slugs.tickets,
    id: ticketId,
    data: { totalTimeMinutes: totalMinutes },
    overrideAccess: true,
    req,
  })
}

function createRecalculateTicketTime(slugs: CollectionSlugs): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    if (!doc.ticket) return
    const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
    await recalculateTicketTime(req.payload, slugs, ticketId, req)
  }
}

/**
 * Deleting a time entry has to re-roll the ticket total too. Without this the
 * rollup only ever grows: `tickets.totalTimeMinutes` is what the invoice endpoint
 * and the CRM view bill on, so a removed entry stayed billed forever.
 */
function createRecalculateTicketTimeOnDelete(slugs: CollectionSlugs): CollectionAfterDeleteHook {
  return async ({ doc, req }) => {
    if (!doc?.ticket) return
    const ticketId = typeof doc.ticket === 'object' ? doc.ticket.id : doc.ticket
    try {
      await recalculateTicketTime(req.payload, slugs, ticketId, req)
    } catch (err) {
      // The entry is already gone; never fail the delete on the rollup refresh.
      console.error('[support] Failed to recalculate ticket time after delete:', err)
    }
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
      {
        name: 'billable',
        type: 'checkbox',
        defaultValue: true,
        label: 'Facturable',
      },
      {
        name: 'agent',
        type: 'relationship',
        relationTo: slugs.users,
        label: 'Agent',
      },
    ],
    hooks: {
      afterChange: [createRecalculateTicketTime(slugs)],
      afterDelete: [createRecalculateTicketTimeOnDelete(slugs)],
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
