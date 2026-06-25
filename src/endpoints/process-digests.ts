import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFind, dbFindByID, dbDelete } from '../utils/db'
import { emailWrapper, emailParagraph, escapeHtml } from '../utils/emailTemplate'
import { readSupportSettings } from '../utils/readSettings'

/**
 * POST /api/support/process-digests   body: { frequency?: 'daily' | 'weekly' }
 *
 * Drains the notification queue for clients whose `notificationFrequency` matches
 * the requested cadence, sending each one a single recap email. Run a daily job
 * with `frequency=daily` and a weekly job with `frequency=weekly`.
 * Protected by the x-cron-secret header.
 */
export function createProcessDigestsEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/process-digests',
    method: 'post',
    handler: async (req) => {
      const secret = req.headers.get('x-cron-secret')
      if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return Response.json({ error: 'Non autorisé' }, { status: 401 })
      }

      try {
        const payload = req.payload
        let body: { frequency?: string } = {}
        try { body = (await req.json!()) as { frequency?: string } } catch { /* no body */ }
        const frequency = body.frequency === 'weekly' ? 'weekly' : 'daily'

        const settings = await readSupportSettings(payload)
        const replyTo = settings.email.replyToAddress || process.env.SUPPORT_EMAIL || ''
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || ''

        // Gather all queued items, grouped by client.
        type Item = { id: number | string; title?: string; message?: string }
        const itemsByClient = new Map<string, Item[]>()
        let page = 1
        let hasMore = true
        while (hasMore && page <= 50) {
          const batch = await dbFind(payload, slugs.notificationQueue, { limit: 200, page, depth: 0, overrideAccess: true, sort: 'createdAt' })
          for (const it of batch.docs) {
            const raw = it as { client?: number | string | { id?: number | string } } & Item
            const clientId = typeof raw.client === 'object' ? raw.client?.id : raw.client
            if (clientId === undefined || clientId === null) continue
            const key = String(clientId)
            if (!itemsByClient.has(key)) itemsByClient.set(key, [])
            itemsByClient.get(key)!.push({ id: raw.id, title: raw.title, message: raw.message })
          }
          hasMore = batch.hasNextPage ?? false
          page++
        }

        const results = { clients: 0, items: 0, errors: 0 }
        for (const [clientId, items] of itemsByClient) {
          try {
            const client = await dbFindByID(payload, slugs.supportClients, { id: clientId, depth: 0, overrideAccess: true })
            // Only deliver for clients whose cadence matches this run.
            if (!client || client.notificationFrequency !== frequency) continue

            if (client.email) {
              const rows = items
                .map((i) => `<tr><td style="padding:8px 0;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;"><strong>${escapeHtml(i.title || '')}</strong><br/><span style="color:#64748b;font-size:13px;">${escapeHtml(i.message || '')}</span></td></tr>`)
                .join('')
              const html = emailWrapper('Recapitulatif de vos tickets', [
                emailParagraph(`Bonjour <strong>${escapeHtml(client.firstName || '')}</strong>,`),
                emailParagraph(`Voici le recapitulatif de l'activite sur vos tickets (${items.length} notification${items.length > 1 ? 's' : ''}) :`),
                `<table cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>`,
                ...(baseUrl ? [emailParagraph(`<a href="${baseUrl}/support/dashboard">Acceder a votre espace support</a>`)] : []),
              ].join(''), { kind: 'system' })
              await payload.sendEmail({ to: client.email, ...(replyTo ? { replyTo } : {}), subject: `Recapitulatif support (${items.length})`, html })
            }

            // Drain the queue regardless of email success (avoid resend loops).
            for (const i of items) {
              try { await dbDelete(payload, slugs.notificationQueue, { id: i.id, overrideAccess: true }) } catch { /* ignore */ }
            }
            results.clients++
            results.items += items.length
          } catch (err) {
            console.error('[process-digests] client error:', err)
            results.errors++
          }
        }

        return Response.json({ ok: true, frequency, ...results })
      } catch (err) {
        console.error('[process-digests] Error:', err)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
