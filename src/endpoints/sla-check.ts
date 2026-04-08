import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * GET /api/support/sla-check
 * Returns tickets currently breaching or at risk of breaching SLA. Admin-only.
 */
export function createSlaCheckEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/sla-check',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const now = new Date()
        const nowISO = now.toISOString()

        const { docs: tickets } = await payload.find({
          collection: slugs.tickets as any,
          where: {
            and: [
              { status: { in: ['open', 'waiting_client'] } },
              {
                or: [
                  { slaFirstResponseDue: { exists: true } },
                  { slaResolutionDue: { exists: true } },
                ],
              },
            ],
          },
          limit: 500,
          depth: 1,
          overrideAccess: true,
          select: {
            ticketNumber: true,
            subject: true,
            status: true,
            priority: true,
            client: true,
            assignedTo: true,
            slaPolicy: true,
            slaFirstResponseDue: true,
            slaResolutionDue: true,
            slaFirstResponseBreached: true,
            slaResolutionBreached: true,
            firstResponseAt: true,
            createdAt: true,
          },
        })

        const breached: Array<Record<string, unknown>> = []
        const atRisk: Array<Record<string, unknown>> = []

        for (const ticket of tickets) {
          const t = ticket as any
          const ticketData = {
            id: t.id,
            ticketNumber: t.ticketNumber,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            client: t.client,
            assignedTo: t.assignedTo,
            createdAt: t.createdAt,
            breachTypes: [] as string[],
            riskTypes: [] as string[],
          }

          // Check first response SLA
          if (t.slaFirstResponseDue && !t.firstResponseAt) {
            const deadline = new Date(t.slaFirstResponseDue)
            if (now > deadline) {
              ticketData.breachTypes.push('first_response')
            } else {
              const created = new Date(t.createdAt)
              const totalWindow = deadline.getTime() - created.getTime()
              const elapsed = now.getTime() - created.getTime()
              if (totalWindow > 0 && elapsed / totalWindow >= 0.8) {
                ticketData.riskTypes.push('first_response')
              }
            }
          }

          // Check resolution SLA
          if (t.slaResolutionDue) {
            const deadline = new Date(t.slaResolutionDue)
            if (now > deadline) {
              ticketData.breachTypes.push('resolution')
            } else {
              const created = new Date(t.createdAt)
              const totalWindow = deadline.getTime() - created.getTime()
              const elapsed = now.getTime() - created.getTime()
              if (totalWindow > 0 && elapsed / totalWindow >= 0.8) {
                ticketData.riskTypes.push('resolution')
              }
            }
          }

          if (ticketData.breachTypes.length > 0) {
            breached.push(ticketData)
          } else if (ticketData.riskTypes.length > 0) {
            atRisk.push(ticketData)
          }
        }

        return new Response(JSON.stringify({ breached, atRisk, checkedAt: nowISO, totalChecked: tickets.length }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
          },
        })
      } catch (error) {
        console.error('[sla-check] Error:', error)
        return Response.json({ error: 'Internal error' }, { status: 500 })
      }
    },
  }
}
