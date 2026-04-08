import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'

/**
 * GET /api/support/export-csv
 * Admin-only endpoint to export all tickets as CSV.
 */
export function createExportCsvEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/export-csv',
    method: 'get',
    handler: async (req) => {
      try {
        const payload = req.payload

        if (!req.user || req.user.collection !== slugs.users) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const PAGE_SIZE = 500
        let page = 1
        let hasMore = true
        const allDocs: Array<Record<string, unknown>> = []

        while (hasMore) {
          const batch = await payload.find({
            collection: slugs.tickets as any,
            limit: PAGE_SIZE,
            page,
            depth: 1,
            sort: '-createdAt',
            overrideAccess: true,
          })
          allDocs.push(...(batch.docs as unknown as Array<Record<string, unknown>>))
          hasMore = batch.hasNextPage ?? false
          page++
        }

        const csvHeaders = [
          'N° Ticket', 'Sujet', 'Statut', 'Priorité', 'Catégorie',
          'Client', 'Email Client', 'Projet', 'Tags', 'Assigné à',
          'Temps (min)', 'Créé le', 'Première réponse', 'Résolu le',
        ]

        const csvRows = allDocs.map((t) => {
          const client = typeof t.client === 'object' ? (t.client as Record<string, unknown>) : null
          const project = typeof t.project === 'object' ? (t.project as Record<string, unknown>) : null
          const assignedTo = typeof t.assignedTo === 'object' ? (t.assignedTo as Record<string, unknown>) : null
          const tags = Array.isArray(t.tags) ? t.tags.join(', ') : ''

          return [
            String(t.ticketNumber || ''),
            `"${String(t.subject || '').replace(/"/g, '""')}"`,
            String(t.status || ''),
            String(t.priority || ''),
            String(t.category || ''),
            client ? `"${String(client.company || '').replace(/"/g, '""')}"` : '',
            client ? String(client.email || '') : '',
            project ? `"${String(project.name || '').replace(/"/g, '""')}"` : '',
            `"${tags}"`,
            assignedTo ? String(assignedTo.email || '') : '',
            String(t.totalTimeMinutes || 0),
            t.createdAt ? new Date(String(t.createdAt)).toISOString() : '',
            t.firstResponseAt ? new Date(String(t.firstResponseAt)).toISOString() : '',
            t.resolvedAt ? new Date(String(t.resolvedAt)).toISOString() : '',
          ].join(',')
        })

        const csv = [csvHeaders.join(','), ...csvRows].join('\n')

        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="tickets-export-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        })
      } catch (error) {
        console.error('[export-csv] Error:', error)
        return Response.json({ error: 'Internal error' }, { status: 500 })
      }
    },
  }
}
