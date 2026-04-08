import type { Endpoint, Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

const PAGE_SIZE = 500
const MAX_PAGES = 50

/**
 * GET /api/support/billing?from=...&to=...&projectId=...
 * Admin-only endpoint returning billing data.
 */
export function createBillingEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/billing',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        const url = new URL(req.url!)
        const from = url.searchParams.get('from')
        const to = url.searchParams.get('to')

        if (!from || !to) {
          return Response.json({ error: 'Missing from/to params' }, { status: 400 })
        }

        const projectId = url.searchParams.get('projectId')

        const ticketWhere: Where = {
          billable: { equals: true },
          ...(projectId ? { project: { equals: Number(projectId) } } : {}),
        }

        // Paginate tickets instead of limit:0
        const allTickets: Array<Record<string, unknown>> = []
        let ticketPage = 1
        let ticketHasMore = true

        while (ticketHasMore && ticketPage <= MAX_PAGES) {
          const batch = await payload.find({
            collection: slugs.tickets as any,
            where: ticketWhere,
            limit: PAGE_SIZE,
            page: ticketPage,
            depth: 2,
            overrideAccess: true,
          })
          allTickets.push(...batch.docs as any[])
          ticketHasMore = batch.hasNextPage ?? false
          ticketPage++
        }

        // Paginate time entries instead of limit:0
        const allEntries: Array<Record<string, unknown>> = []
        let entryPage = 1
        let entryHasMore = true

        while (entryHasMore && entryPage <= MAX_PAGES) {
          const batch = await payload.find({
            collection: slugs.timeEntries as any,
            where: {
              and: [
                { date: { greater_than_equal: from } },
                { date: { less_than_equal: to } },
              ],
            },
            limit: PAGE_SIZE,
            page: entryPage,
            depth: 0,
            overrideAccess: true,
          })
          allEntries.push(...batch.docs as any[])
          entryHasMore = batch.hasNextPage ?? false
          entryPage++
        }

        // Index entries by ticket ID
        const entriesByTicket = new Map<number, Array<{ duration: number; description: string; date: string }>>()
        for (const entry of allEntries) {
          const e = entry as any
          const ticketId = typeof e.ticket === 'object' ? e.ticket.id : e.ticket
          if (!entriesByTicket.has(ticketId)) entriesByTicket.set(ticketId, [])
          entriesByTicket.get(ticketId)!.push({
            duration: e.duration || 0,
            description: e.description || '',
            date: e.date || '',
          })
        }

        // Group by project
        const projectGroups = new Map<string, {
          project: { id: number; name: string } | null
          client: { company: string } | null
          tickets: Array<{ id: number; ticketNumber: string; subject: string; entries: any[]; totalMinutes: number; billedAmount: number | null }>
          totalMinutes: number
          totalBilledAmount: number
        }>()

        for (const ticket of allTickets) {
          const t = ticket as any
          const ticketEntries = entriesByTicket.get(t.id)
          if (!ticketEntries || ticketEntries.length === 0) continue

          const project = typeof t.project === 'object' && t.project
            ? { id: t.project.id, name: t.project.name || 'Sans nom' }
            : null

          const projectKey = project ? String(project.id) : 'no-project'

          if (!projectGroups.has(projectKey)) {
            let clientInfo: { company: string } | null = null
            if (project && typeof t.project === 'object' && t.project) {
              const proj = t.project as any
              if (typeof proj.client === 'object' && proj.client) {
                clientInfo = { company: proj.client.company || '' }
              }
            }
            if (!clientInfo && typeof t.client === 'object' && t.client) {
              clientInfo = { company: t.client.company || '' }
            }

            projectGroups.set(projectKey, {
              project,
              client: clientInfo,
              tickets: [],
              totalMinutes: 0,
              totalBilledAmount: 0,
            })
          }

          const ticketTotalMinutes = ticketEntries.reduce((sum, e) => sum + e.duration, 0)
          const billedAmount = t.billedAmount || null

          projectGroups.get(projectKey)!.tickets.push({
            id: t.id,
            ticketNumber: t.ticketNumber || '',
            subject: t.subject || '',
            entries: ticketEntries,
            totalMinutes: ticketTotalMinutes,
            billedAmount,
          })
          projectGroups.get(projectKey)!.totalMinutes += ticketTotalMinutes
          if (billedAmount) projectGroups.get(projectKey)!.totalBilledAmount += billedAmount
        }

        const groups = Array.from(projectGroups.values())
        const grandTotalMinutes = groups.reduce((sum, g) => sum + g.totalMinutes, 0)
        const grandTotalBilledAmount = groups.reduce((sum, g) => sum + g.totalBilledAmount, 0)

        return new Response(JSON.stringify({ groups, grandTotalMinutes, grandTotalBilledAmount }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          },
        })
      } catch (err) {
        const authResponse = handleAuthError(err)
        if (authResponse) return authResponse
        console.error('[billing] Error:', err)
        return Response.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
  }
}
