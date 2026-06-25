import type { Endpoint } from 'payload'
import type { CollectionSlugs } from '../utils/slugs'
import { dbFind, dbCreate } from '../utils/db'
import { randomBytes } from 'crypto'

const PROVIDERS = ['whatsapp', 'messenger'] as const
type Provider = (typeof PROVIDERS)[number]

/**
 * POST /api/support/channels/webhook
 *
 * Inbound social-channel webhook (WhatsApp / Messenger). Accepts a NORMALIZED
 * payload `{ provider, from, name?, text }` — a thin adapter maps the provider's
 * raw webhook (Meta X-Hub-Signature-256 etc.) to this shape at the edge. Creates
 * or appends the client's open ticket for that channel.
 *
 * Protected by the `x-channel-secret` header (`CHANNELS_WEBHOOK_SECRET`).
 */
export function createChannelsWebhookEndpoint(slugs: CollectionSlugs): Endpoint {
  return {
    path: '/support/channels/webhook',
    method: 'post',
    handler: async (req) => {
      const secret = req.headers.get('x-channel-secret')
      if (!process.env.CHANNELS_WEBHOOK_SECRET || secret !== process.env.CHANNELS_WEBHOOK_SECRET) {
        return Response.json({ error: 'Non autorisé' }, { status: 401 })
      }

      let body: { provider?: string; from?: string; name?: string; text?: string }
      try {
        body = (await req.json!()) as typeof body
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      const provider = body.provider as Provider
      const from = (body.from || '').trim()
      const text = (body.text || '').trim()
      if (!PROVIDERS.includes(provider) || !from || !text) {
        return Response.json({ error: 'provider, from et text requis.' }, { status: 400 })
      }

      try {
        const payload = req.payload
        // Resolve (or create) the channel client by a synthetic, stable identity.
        const email = `${from}@${provider}.channel`
        const existing = await dbFind(payload, slugs.supportClients, { where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
        let clientId: number | string
        if (existing.docs.length > 0) {
          clientId = (existing.docs[0] as { id: number | string }).id
        } else {
          const created = await dbCreate(payload, slugs.supportClients, {
            data: { email, firstName: body.name || provider, lastName: from.slice(0, 40), company: provider, password: randomBytes(16).toString('hex') },
            overrideAccess: true,
          })
          clientId = (created as { id: number | string }).id
        }

        // Find an open ticket for this client + channel, else open a new one.
        const open = await dbFind(payload, slugs.tickets, {
          where: { and: [{ client: { equals: clientId } }, { source: { equals: provider } }, { status: { in: ['open', 'waiting_client'] } }] },
          sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true,
        })
        let ticketId: number | string
        let createdTicket = false
        if (open.docs.length > 0) {
          ticketId = (open.docs[0] as { id: number | string }).id
        } else {
          const t = await dbCreate(payload, slugs.tickets, {
            data: { subject: text.slice(0, 80), client: clientId, status: 'open', priority: 'normal', source: provider },
            overrideAccess: true,
          })
          ticketId = (t as { id: number | string }).id
          createdTicket = true
        }

        const msg = await dbCreate(payload, slugs.ticketMessages, {
          data: { ticket: ticketId, body: text, authorType: 'client', authorClient: clientId },
          overrideAccess: true,
        })

        return Response.json({ ok: true, ticketId, createdTicket, messageId: (msg as { id: number | string }).id })
      } catch (err) {
        console.error('[channels] Error:', err)
        return Response.json({ error: 'Erreur interne' }, { status: 500 })
      }
    },
  }
}
