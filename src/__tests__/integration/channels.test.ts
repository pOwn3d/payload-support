import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createChannelsWebhookEndpoint } from '../../endpoints/channels'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })

/**
 * Social channels (roadmap): the inbound webhook turns a normalized WhatsApp /
 * Messenger message into a ticket (creating the channel client on first contact)
 * and appends follow-ups to the same open ticket.
 */
describe('social channels inbound webhook (roadmap)', () => {
  it('creates a ticket from a WhatsApp message, then appends follow-ups', async () => {
    const payload = await buildTestPayload()
    process.env.CHANNELS_WEBHOOK_SECRET = 'test-channel-secret'
    const ep = createChannelsWebhookEndpoint(slugs)
    const post = (payloadBody: unknown) =>
      (ep.handler as (r: unknown) => Promise<Response>)({
        payload,
        headers: new Headers({ 'x-channel-secret': 'test-channel-secret' }),
        json: async () => payloadBody,
      })

    const res1 = await post({ provider: 'whatsapp', from: '33612345678', name: 'Jean', text: "Bonjour, j'ai besoin d'aide" })
    const j1 = await res1.json()
    expect(j1.ok).toBe(true)
    expect(j1.createdTicket).toBe(true)

    const ticket = await payload.findByID({ collection: 'tickets', id: j1.ticketId, overrideAccess: true })
    expect(ticket.source).toBe('whatsapp')

    const msgs1 = await payload.find({ collection: 'ticket-messages', where: { ticket: { equals: j1.ticketId } }, overrideAccess: true })
    expect(msgs1.docs.some((m) => ((m as { body?: string }).body || '').includes("besoin d'aide"))).toBe(true)

    // Follow-up from the same sender → same ticket, no new ticket.
    const res2 = await post({ provider: 'whatsapp', from: '33612345678', text: 'Toujours bloqué' })
    const j2 = await res2.json()
    expect(j2.createdTicket).toBe(false)
    expect(String(j2.ticketId)).toBe(String(j1.ticketId))
  }, 60_000)

  it('rejects without the channel secret', async () => {
    const payload = await buildTestPayload()
    process.env.CHANNELS_WEBHOOK_SECRET = 'test-channel-secret'
    const ep = createChannelsWebhookEndpoint(slugs)
    const res = await (ep.handler as (r: unknown) => Promise<Response>)({
      payload, headers: new Headers({}), json: async () => ({ provider: 'whatsapp', from: 'x', text: 'y' }),
    })
    expect(res.status).toBe(401)
  }, 60_000)
})
