import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { dbFind, dbCount } from '../utils/db'

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

        // Optional per-team dashboard scoping (?teamId=) — applied to ticket counts.
        const teamId = new URL(req.url!).searchParams.get('teamId')
        const teamAnd = teamId ? [{ team: { equals: Number(teamId) } }] : []

        // ── Status counts via individual count queries ──
        const statuses = ['open', 'waiting_client', 'resolved'] as const
        const statusCounts = await Promise.all(
          statuses.map(async (status) => {
            const result = await dbCount(payload, slugs.tickets, {
              where: { and: [{ status: { equals: status } }, ...teamAnd] },
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
            const result = await dbCount(payload, slugs.tickets, {
              where: { and: [{ priority: { equals: priority } }, ...teamAnd] },
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
            const result = await dbCount(payload, slugs.tickets, {
              where: { and: [{ category: { equals: category } }, ...teamAnd] },
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
          dbCount(payload, slugs.tickets, {
            where: { createdAt: { greater_than_equal: sevenDaysAgo.toISOString() } },
            overrideAccess: true,
          }),
          dbCount(payload, slugs.tickets, {
            where: { createdAt: { greater_than_equal: thirtyDaysAgo.toISOString() } },
            overrideAccess: true,
          }),
        ])

        // Real per-day ticket volume for the last 7 days (chronological), replacing
        // the previous synthetic distribution in the dashboard chart.
        const volumeByDay = await Promise.all(
          Array.from({ length: 7 }, (_, i) => i).map(async (offset) => {
            const dayStart = new Date(now)
            dayStart.setHours(0, 0, 0, 0)
            dayStart.setDate(dayStart.getDate() - (6 - offset))
            const dayEnd = new Date(dayStart)
            dayEnd.setDate(dayEnd.getDate() + 1)
            const r = await dbCount(payload, slugs.tickets, {
              where: {
                and: [
                  { createdAt: { greater_than_equal: dayStart.toISOString() } },
                  { createdAt: { less_than: dayEnd.toISOString() } },
                ],
              },
              overrideAccess: true,
            })
            return { date: dayStart.toISOString(), count: r.totalDocs }
          }),
        )

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
          const batch = await dbFind(payload, slugs.tickets, {
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

        // ── Satisfaction (CSAT) + NPS: count + paginated aggregation ──
        const surveyCount = await dbCount(payload, slugs.satisfactionSurveys, {
          overrideAccess: true,
        })

        let satisfactionAvg = 0
        let satisfactionCount = 0
        let npsScore: number | null = null
        let npsCount = 0
        if (surveyCount.totalDocs > 0) {
          let ratingSum = 0
          let ratingN = 0
          let promoters = 0
          let detractors = 0
          let npsN = 0
          let surveyPage = 1
          let surveyHasMore = true
          while (surveyHasMore && surveyPage <= MAX_PAGES) {
            const batch = await dbFind(payload, slugs.satisfactionSurveys, {
              limit: PAGE_SIZE,
              page: surveyPage,
              depth: 0,
              overrideAccess: true,
              select: { rating: true, nps: true },
            })
            for (const s of batch.docs) {
              const r = (s as { rating?: number }).rating
              if (typeof r === 'number' && r > 0) { ratingSum += r; ratingN++ }
              const n = (s as { nps?: number }).nps
              if (typeof n === 'number') {
                npsN++
                if (n >= 9) promoters++
                else if (n <= 6) detractors++
              }
            }
            surveyHasMore = batch.hasNextPage ?? false
            surveyPage++
          }
          satisfactionAvg = ratingN > 0 ? Math.round((ratingSum / ratingN) * 10) / 10 : 0
          satisfactionCount = ratingN
          if (npsN > 0) {
            // NPS = %promoters - %detractors, on a -100..100 scale.
            npsScore = Math.round(((promoters - detractors) / npsN) * 100)
            npsCount = npsN
          }
        }

        const clientCount = await dbCount(payload, slugs.supportClients, { overrideAccess: true })
        // pendingEmails is an optional feature — tolerate its collection being absent
        // (otherwise the whole stats endpoint 500s on installs without it).
        let pendingEmailsTotal = 0
        try {
          const pe = await dbCount(payload, slugs.pendingEmails, {
            where: { status: { equals: 'pending' } },
            overrideAccess: true,
          })
          pendingEmailsTotal = pe.totalDocs
        } catch { /* pendingEmails feature disabled — count stays 0 */ }

        return new Response(JSON.stringify({
          total,
          byStatus,
          byPriority,
          byCategory,
          createdLast7Days: created7.totalDocs,
          createdLast30Days: created30.totalDocs,
          volumeByDay,
          avgResponseTimeHours: responseTimeCount > 0
            ? Math.round((totalResponseTimeMs / responseTimeCount / (1000 * 60 * 60)) * 10) / 10
            : null,
          avgResolutionTimeHours: resolutionTimeCount > 0
            ? Math.round((totalResolutionTimeMs / resolutionTimeCount / (1000 * 60 * 60)) * 10) / 10
            : null,
          totalTimeMinutes,
          satisfactionAvg,
          satisfactionCount,
          npsScore,
          npsCount,
          clientCount: clientCount.totalDocs,
          pendingEmailsCount: pendingEmailsTotal,
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
