import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFind, dbUpdate, dbCreate } from '../utils/db'
import { verifySecret } from '../utils/webhookSecurity'

/**
 * POST /api/support/process-snooze
 *
 * Wakes up tickets whose snooze deadline has passed: clears `snoozeUntil` so the
 * ticket stops being filtered out of the inbox, and records a `snooze_expired`
 * activity entry. Tickets also resurface automatically once `snoozeUntil` is in
 * the past (the inbox query hides only future snoozes) — this cron just cleans up
 * the stale field and leaves an audit trail.
 *
 * Protected by the `x-cron-secret` header (same pattern as process-scheduled).
 */
export function createProcessSnoozeEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/process-snooze',
    method: 'post',
    handler: async (req) => {
      const secret = req.headers.get('x-cron-secret')
      const expectedSecret = process.env.CRON_SECRET
      if (!verifySecret(secret, expectedSecret)) {
        return Response.json({ error: 'Non autorisé' }, { status: 401 })
      }

      try {
        const payload = req.payload
        const nowIso = new Date().toISOString()
        const results = { processed: 0, errors: 0 }

        const due = await dbFind(payload, slugs.tickets, {
          where: {
            and: [
              { snoozeUntil: { exists: true } },
              { snoozeUntil: { less_than_equal: nowIso } },
            ],
          },
          limit: 500,
          depth: 0,
          overrideAccess: true,
          select: { id: true, ticketNumber: true },
        })

        for (const ticket of due.docs) {
          try {
            await dbUpdate(payload, slugs.tickets, {
              id: (ticket as { id: number | string }).id,
              data: { snoozeUntil: null },
              overrideAccess: true,
            })
            // Audit trail — best-effort (activity-log may be unavailable).
            try {
              await dbCreate(payload, slugs.ticketActivityLog, {
                data: {
                  ticket: (ticket as { id: number | string }).id,
                  action: 'snooze_expired',
                  detail: 'Snooze échu — ticket réactivé',
                  actorType: 'system',
                },
                overrideAccess: true,
              })
            } catch { /* activity log optional */ }
            results.processed++
          } catch (err) {
            console.error('[support] Failed to wake snoozed ticket:', err)
            results.errors++
          }
        }

        return Response.json({ ok: true, ...results })
      } catch (err) {
        console.error('[process-snooze] Error:', err)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
