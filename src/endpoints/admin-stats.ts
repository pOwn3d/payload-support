import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'

/**
 * GET /api/support/admin-stats
 * Admin-only endpoint returning support analytics.
 * Uses count queries and paginated aggregation to avoid loading all tickets in memory.
 */
export function createAdminStatsEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/admin-stats',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        requireAdmin(req, slugs)

        // ── Status counts via individual count queries ──
        const statuses = ['open', 'waiting_client', 'resolved'] as const
        const statusCounts = await Promise.all(
          statuses.map(async (status) => {
            const result = await payload.count({
              collection: slugs.tickets as any,
              where: { status: { equals: status } },
              overrideAccess: true,
            })
            return [status, result.totalDocs] as const
          }),
        )
        const byStatus: Record<string, number> = Object.fromEntries(statusCounts)
        const total = statusCounts.reduce((sum, [, count]) => sum + count, 0)

        // ── Priority counts ──
        const priorities = ['low', 'normal', 'high', 'urgent'] as const
        const priorityCounts = await Promise.all(
          priorities.map(async (priority) => {
            const result = await payload.count({
              collection: slugs.tickets as any,
              where: { priority: { equals: priority } },
              overrideAccess: true,
            })
            return [priority, result.totalDocs] as const
          }),
        )
        const byPriority: Record<string, number> = Object.fromEntries(priorityCounts)

        // ── Category counts ──
        const categories = ['bug', 'content', 'feature', 'question', 'hosting'] as const
        const categoryCounts = await Promise.all(
          categories.map(async (category) => {
            const result = await payload.count({
              collection: slugs.tickets as any,
              where: { category: { equals: category } },
              overrideAccess: true,
            })
            return [category, result.totalDocs] as const
          }),
        )
        const byCategory: Record<string, number> = Object.fromEntries(
          categoryCounts.filter(([, count]) => count > 0),
        )

        // ── Time-based counts ──
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const [created7, created30] = await Promise.all([
          payload.count({
            collection: slugs.tickets as any,
            where: { createdAt: { greater_than_equal: sevenDaysAgo.toISOString() } },
            overrideAccess: true,
          }),
          payload.count({
            collection: slugs.tickets as any,
            where: { createdAt: { greater_than_equal: thirtyDaysAgo.toISOString() } },
            overrideAccess: true,
          }),
        ])

        // ── Averages: paginate with limit:100, only fetch needed fields ──
        const PAGE_SIZE = 100
        const MAX_PAGES = 50
        let totalResponseTimeMs = 0
        let responseTimeCount = 0
        let totalResolutionTimeMs = 0
        let resolutionTimeCount = 0
        let totalTimeMinutes = 0

        let page = 1
        let hasMore = true

        while (hasMore && page <= MAX_PAGES) {
          const batch = await payload.find({
            collection: slugs.tickets as any,
            limit: PAGE_SIZE,
            page,
            depth: 0,
            overrideAccess: true,
            select: {
              firstResponseAt: true,
              resolvedAt: true,
              createdAt: true,
              totalTimeMinutes: true,
            },
          })

          for (const t of batch.docs) {
            const doc = t as Record<string, unknown>
            if (doc.firstResponseAt && doc.createdAt) {
              const responseTime = new Date(String(doc.firstResponseAt)).getTime() - new Date(String(doc.createdAt)).getTime()
              if (responseTime > 0) { totalResponseTimeMs += responseTime; responseTimeCount++ }
            }
            if (doc.resolvedAt && doc.createdAt) {
              const resolutionTime = new Date(String(doc.resolvedAt)).getTime() - new Date(String(doc.createdAt)).getTime()
              if (resolutionTime > 0) { totalResolutionTimeMs += resolutionTime; resolutionTimeCount++ }
            }
            totalTimeMinutes += (doc.totalTimeMinutes as number) || 0
          }

          hasMore = batch.hasNextPage ?? false
          page++
        }

        // ── Satisfaction: use count + paginated average ──
        const surveyCount = await payload.count({
          collection: slugs.satisfactionSurveys as any,
          overrideAccess: true,
        })

        let satisfactionAvg = 0
        if (surveyCount.totalDocs > 0) {
          let totalRating = 0
          let surveyPage = 1
          let surveyHasMore = true
          while (surveyHasMore && surveyPage <= MAX_PAGES) {
            const batch = await payload.find({
              collection: slugs.satisfactionSurveys as any,
              limit: PAGE_SIZE,
              page: surveyPage,
              depth: 0,
              overrideAccess: true,
              select: { rating: true },
            })
            for (const s of batch.docs) {
              totalRating += ((s as any).rating || 0)
            }
            surveyHasMore = batch.hasNextPage ?? false
            surveyPage++
          }
          satisfactionAvg = Math.round((totalRating / surveyCount.totalDocs) * 10) / 10
        }

        const [clientCount, pendingEmailsCount] = await Promise.all([
          payload.count({
            collection: slugs.supportClients as any,
            overrideAccess: true,
          }),
          payload.count({
            collection: slugs.pendingEmails as any,
            where: { status: { equals: 'pending' } },
            overrideAccess: true,
          }),
        ])

        return new Response(JSON.stringify({
          total,
          byStatus,
          byPriority,
          byCategory,
          createdLast7Days: created7.totalDocs,
          createdLast30Days: created30.totalDocs,
          avgResponseTimeHours: responseTimeCount > 0
            ? Math.round((totalResponseTimeMs / responseTimeCount / (1000 * 60 * 60)) * 10) / 10
            : null,
          avgResolutionTimeHours: resolutionTimeCount > 0
            ? Math.round((totalResolutionTimeMs / resolutionTimeCount / (1000 * 60 * 60)) * 10) / 10
            : null,
          totalTimeMinutes,
          satisfactionAvg,
          satisfactionCount: surveyCount.totalDocs,
          clientCount: clientCount.totalDocs,
          pendingEmailsCount: pendingEmailsCount.totalDocs,
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
          },
        })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[admin-stats] Error:', error)
        return Response.json({ error: 'Internal error' }, { status: 500 })
      }
    },
  }
}
