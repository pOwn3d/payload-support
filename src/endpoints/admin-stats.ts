import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * GET /api/support/admin-stats
 * Admin-only endpoint returning support analytics.
 */
export function createAdminStatsEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/admin-stats',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch tickets in batches
        const PAGE_SIZE = 500
        const MAX_PAGES = 50
        let page = 1
        let hasMore = true
        const tickets: Array<Record<string, unknown>> = []

        while (hasMore && page <= MAX_PAGES) {
          const batch = await payload.find({
            collection: slugs.tickets as any,
            limit: PAGE_SIZE,
            page,
            depth: 0,
            overrideAccess: true,
            select: {
              status: true,
              priority: true,
              category: true,
              firstResponseAt: true,
              resolvedAt: true,
              createdAt: true,
              totalTimeMinutes: true,
            },
          })
          tickets.push(...batch.docs)
          hasMore = batch.hasNextPage ?? false
          page++
        }

        const byStatus: Record<string, number> = {}
        const byPriority: Record<string, number> = {}
        const byCategory: Record<string, number> = {}
        let totalResponseTimeMs = 0
        let responseTimeCount = 0
        let totalResolutionTimeMs = 0
        let resolutionTimeCount = 0

        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        let createdLast7Days = 0
        let createdLast30Days = 0
        let totalTimeMinutes = 0

        for (const t of tickets) {
          const status = String(t.status || 'open')
          byStatus[status] = (byStatus[status] || 0) + 1

          const priority = String(t.priority || 'normal')
          byPriority[priority] = (byPriority[priority] || 0) + 1

          if (t.category) {
            const cat = String(t.category)
            byCategory[cat] = (byCategory[cat] || 0) + 1
          }

          if (t.firstResponseAt && t.createdAt) {
            const responseTime = new Date(String(t.firstResponseAt)).getTime() - new Date(String(t.createdAt)).getTime()
            if (responseTime > 0) { totalResponseTimeMs += responseTime; responseTimeCount++ }
          }

          if (t.resolvedAt && t.createdAt) {
            const resolutionTime = new Date(String(t.resolvedAt)).getTime() - new Date(String(t.createdAt)).getTime()
            if (resolutionTime > 0) { totalResolutionTimeMs += resolutionTime; resolutionTimeCount++ }
          }

          const createdAt = t.createdAt ? new Date(String(t.createdAt)) : null
          if (createdAt) {
            if (createdAt >= sevenDaysAgo) createdLast7Days++
            if (createdAt >= thirtyDaysAgo) createdLast30Days++
          }

          totalTimeMinutes += (t.totalTimeMinutes as number) || 0
        }

        // Satisfaction
        const surveys = await payload.find({
          collection: slugs.satisfactionSurveys as any,
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })

        let satisfactionAvg = 0
        if (surveys.docs.length > 0) {
          const totalRating = surveys.docs.reduce((sum: number, s: any) => sum + (s.rating || 0), 0)
          satisfactionAvg = Math.round((totalRating / surveys.docs.length) * 10) / 10
        }

        const clientCount = await payload.count({
          collection: slugs.supportClients as any,
          overrideAccess: true,
        })

        const pendingEmailsCount = await payload.count({
          collection: slugs.pendingEmails as any,
          where: { status: { equals: 'pending' } },
          overrideAccess: true,
        })

        return new Response(JSON.stringify({
          total: tickets.length,
          byStatus,
          byPriority,
          byCategory,
          createdLast7Days,
          createdLast30Days,
          avgResponseTimeHours: responseTimeCount > 0
            ? Math.round((totalResponseTimeMs / responseTimeCount / (1000 * 60 * 60)) * 10) / 10
            : null,
          avgResolutionTimeHours: resolutionTimeCount > 0
            ? Math.round((totalResolutionTimeMs / resolutionTimeCount / (1000 * 60 * 60)) * 10) / 10
            : null,
          totalTimeMinutes,
          satisfactionAvg,
          satisfactionCount: surveys.docs.length,
          clientCount: clientCount.totalDocs,
          pendingEmailsCount: pendingEmailsCount.totalDocs,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          },
        })
      } catch (error) {
        console.error('[admin-stats] Error:', error)
        return Response.json({ error: 'Internal error' }, { status: 500 })
      }
    },
  }
}
