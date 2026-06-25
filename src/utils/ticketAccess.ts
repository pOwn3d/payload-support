import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { dbFind } from './db'

/**
 * Resolve the set of ticket IDs a support-client may access: tickets they own
 * (`client = id`) plus tickets they collaborate on (`ticket-collaborators` table).
 *
 * Used as a SECURITY BOUNDARY for child collections (messages, activity log):
 * callers constrain `ticket IN (...)` instead of relying on a nested relationship
 * filter (`'ticket.client'`), whose behaviour through the SQLite/Drizzle adapter
 * is not guaranteed. Mirrors the owner/collaborator resolution in `Tickets.ts`.
 *
 * Returns an empty array when the client has no accessible tickets — callers MUST
 * treat that as "deny" (e.g. filter on a sentinel id) rather than "allow all".
 */
export async function resolveAccessibleTicketIds(
  payload: Payload,
  slugs: CollectionSlugs,
  clientId: number | string,
): Promise<Array<number | string>> {
  const ids = new Set<number | string>()

  try {
    const owned = await dbFind(payload, slugs.tickets, {
      where: { client: { equals: clientId } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    for (const t of owned.docs) ids.add(t.id as number | string)
  } catch {
    // ignore — fall through with whatever we resolved
  }

  try {
    const collab = await dbFind(payload, 'ticket-collaborators', {
      where: { client: { equals: clientId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    for (const r of collab.docs) {
      const row = r as { ticket?: number | string | { id?: number | string } }
      const tid = typeof row.ticket === 'object' ? row.ticket?.id : row.ticket
      if (tid !== undefined && tid !== null) ids.add(tid)
    }
  } catch {
    // ticket-collaborators may not exist on older deployments — owner-only fallback
  }

  return Array.from(ids)
}
