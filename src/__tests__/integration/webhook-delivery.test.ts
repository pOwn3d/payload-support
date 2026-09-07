import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'
const HOOK = 'https://hook.invalid/support'

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Non-regression: `createFireMessageWebhooks` and `createDispatchWebhookOnReply`
 * were both registered on the ticket-messages afterChange hook with identical
 * guards, so a single reply produced TWO POSTs to every subscriber — with two
 * incompatible body shapes and two auth schemes. One reply must yield one call.
 */
describe('outbound webhook delivery', () => {
  it('fires exactly one POST per subscribed endpoint for one reply', async () => {
    const payload = await buildTestPayload()

    const realFetch = globalThis.fetch
    const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = []
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url.startsWith(HOOK)) {
        calls.push({
          url,
          body: String(init?.body ?? ''),
          headers: (init?.headers ?? {}) as Record<string, string>,
        })
        return new Response(null, { status: 200 })
      }
      return realFetch(input as RequestInfo, init)
    }) as typeof fetch)

    await payload.create({
      collection: 'webhook-endpoints',
      data: { name: 'hook', url: HOOK, secret: 'hmac-secret', events: ['ticket_replied'], active: true },
      overrideAccess: true,
    })

    const client = await payload.create({ collection: 'support-clients', data: { email: 'hook@example.com', password: PW, firstName: 'H', lastName: 'K', company: 'H' }, overrideAccess: true })
    const ticket = await payload.create({ collection: 'tickets', data: { subject: 'hook ticket', client: client.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    await payload.create({ collection: 'ticket-messages', data: { ticket: ticket.id, body: 'a reply', authorType: 'admin' }, overrideAccess: true })

    // Delivery is fire-and-forget: wait for the first call, then leave a settle
    // window wide enough for a duplicate dispatcher to show up.
    const deadline = Date.now() + 10_000
    while (calls.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50))
    }
    await new Promise((r) => setTimeout(r, 750))

    expect(calls).toHaveLength(1)
    expect(calls[0].headers['X-Webhook-Signature']).toBeTruthy()
    expect(calls[0].headers['X-Webhook-Secret']).toBeUndefined()
    expect(JSON.parse(calls[0].body).event).toBe('ticket_replied')
  }, 60_000)
})
