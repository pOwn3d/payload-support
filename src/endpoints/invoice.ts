import type { Endpoint, Where } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { requireAdmin, handleAuthError } from '../utils/auth'
import { dbFind } from '../utils/db'
import { escapeHtml } from '../utils/emailTemplate'
import { generateInvoicePdf, type InvoiceLine } from '../utils/invoicePdf'

/**
 * GET /api/support/billing/invoice?from=YYYY-MM-DD&to=YYYY-MM-DD&projectId=...&format=html|pdf
 *
 * Admin-only. Renders an invoice for the billable tickets active in the period.
 * `format=pdf` returns a real binary PDF (pdfkit); otherwise a self-contained,
 * print-ready HTML document. Defaults to HTML.
 */
export function createInvoiceEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/billing/invoice',
    method: 'get',
    handler: async (req) => {
      try {
        requireAdmin(req, slugs)
        const payload = req.payload
        const url = new URL(req.url!)
        const from = url.searchParams.get('from')
        const to = url.searchParams.get('to')
        const projectId = url.searchParams.get('projectId')
        const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'html'
        if (!from || !to) {
          return Response.json({ error: 'Paramètres from et to requis.' }, { status: 400 })
        }

        const toExclusive = new Date(to)
        toExclusive.setDate(toExclusive.getDate() + 1)
        const toIso = toExclusive.toISOString()

        const where: Where = {
          and: [
            { billable: { equals: true } },
            ...(projectId ? [{ project: { equals: Number(projectId) } } as Where] : []),
            {
              or: [
                { and: [{ updatedAt: { greater_than_equal: from } }, { updatedAt: { less_than: toIso } }] },
                { and: [{ createdAt: { greater_than_equal: from } }, { createdAt: { less_than: toIso } }] },
                { and: [{ resolvedAt: { greater_than_equal: from } }, { resolvedAt: { less_than: toIso } }] },
              ],
            },
          ],
        }

        const tickets: Array<Record<string, unknown>> = []
        let page = 1
        let hasMore = true
        while (hasMore && page <= 50) {
          const batch = await dbFind(payload, slugs.tickets, {
            where, limit: 500, page, depth: 2, overrideAccess: true,
            select: { ticketNumber: true, subject: true, billedAmount: true, totalTimeMinutes: true, project: true, client: true },
          })
          tickets.push(...(batch.docs as Array<Record<string, unknown>>))
          hasMore = batch.hasNextPage ?? false
          page++
        }

        // Shared structured lines (used by both HTML and PDF renderers).
        let totalAmount = 0
        let totalMinutes = 0
        const lines: InvoiceLine[] = tickets.map((t) => {
          const amount = typeof t.billedAmount === 'number' ? t.billedAmount : 0
          const minutes = typeof t.totalTimeMinutes === 'number' ? t.totalTimeMinutes : 0
          totalAmount += amount
          totalMinutes += minutes
          const client = typeof t.client === 'object' && t.client ? (t.client as { company?: string }).company || '' : ''
          return { ticketNumber: String(t.ticketNumber || ''), subject: String(t.subject || ''), client, minutes, amount }
        })

        if (format === 'pdf') {
          const pdf = await generateInvoicePdf({ from, to, projectId, lines, totalMinutes, totalAmount })
          return new Response(new Uint8Array(pdf), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="invoice-${from}_${to}.pdf"`,
            },
          })
        }

        const fmtAmount = (n: number) => `${n.toFixed(2)} €`
        const fmtTime = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
        const rows = lines.map((l) => `<tr>
            <td>${escapeHtml(l.ticketNumber)}</td>
            <td>${escapeHtml(l.subject)}</td>
            <td>${escapeHtml(l.client)}</td>
            <td style="text-align:right;">${fmtTime(l.minutes)}</td>
            <td style="text-align:right;">${fmtAmount(l.amount)}</td>
          </tr>`).join('')

        const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Facture ${escapeHtml(from)} → ${escapeHtml(to)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; max-width: 820px; margin: 32px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .period { color: #64748b; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
  tfoot td { font-weight: 700; border-top: 2px solid #0f172a; border-bottom: none; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <h1>Facture / Pré-facture</h1>
  <div class="period">Période : ${escapeHtml(from)} → ${escapeHtml(to)}${projectId ? ` · Projet #${escapeHtml(projectId)}` : ''}</div>
  <table>
    <thead><tr><th>Ticket</th><th>Sujet</th><th>Client</th><th style="text-align:right;">Temps</th><th style="text-align:right;">Montant</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="color:#94a3b8;">Aucun ticket facturable sur la période.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="3">Total (${lines.length} ticket${lines.length > 1 ? 's' : ''})</td><td style="text-align:right;">${fmtTime(totalMinutes)}</td><td style="text-align:right;">${fmtAmount(totalAmount)}</td></tr></tfoot>
  </table>
</body></html>`

        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      } catch (error) {
        const authResponse = handleAuthError(error)
        if (authResponse) return authResponse
        console.error('[invoice] Error:', error)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
