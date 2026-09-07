import { describe, it, expect, vi, afterEach } from 'vitest'
import crypto from 'crypto'
import { dispatchWebhook } from '../utils/webhookDispatcher'
import type { CollectionSlugs } from '../utils/slugs'

const slugs = { webhookEndpoints: 'webhook-endpoints' } as unknown as CollectionSlugs

function buildPayloadStub(endpoints: Array<Record<string, unknown>>) {
  return {
    find: vi.fn(async () => ({ docs: endpoints })),
    update: vi.fn(async () => ({})),
  } as never
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * Outbound webhooks had zero test coverage while TWO dispatchers were wired onto
 * the same afterChange hooks — every subscriber got two POSTs, one of them
 * shipping the endpoint secret in clear. These tests pin the surviving contract.
 */
describe('dispatchWebhook', () => {
  it('sends exactly one signed POST per active endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = buildPayloadStub([
      { id: 1, url: 'https://hook.example/one', secret: 'sup3r-s3cret', name: 'one' },
    ])

    await dispatchWebhook({ ticketId: 42, messageId: 7 }, 'ticket_replied', payload, slugs)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hook.example/one')
    expect(init.method).toBe('POST')

    const body = init.body as string
    const parsed = JSON.parse(body)
    expect(parsed.event).toBe('ticket_replied')
    expect(parsed.data).toMatchObject({ ticketId: 42, messageId: 7 })

    const headers = init.headers as Record<string, string>
    const expectedSignature = crypto.createHmac('sha256', 'sup3r-s3cret').update(body).digest('hex')
    expect(headers['X-Webhook-Signature']).toBe(expectedSignature)
    // The legacy transport shipped the raw secret in this header — it must be gone.
    expect(headers['X-Webhook-Secret']).toBeUndefined()
  })

  it('queries the endpoints subscribed to the event, including ticket_assigned', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = buildPayloadStub([{ id: 2, url: 'https://hook.example/two', name: 'two' }])
    await dispatchWebhook({ ticketId: 1, assignedTo: 9 }, 'ticket_assigned', payload, slugs)

    const findArgs = (payload as unknown as { find: { mock: { calls: unknown[][] } } }).find.mock.calls[0][0] as {
      where: { and: Array<Record<string, unknown>> }
    }
    expect(findArgs.where.and).toContainEqual({ events: { contains: 'ticket_assigned' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('omits the signature header when the endpoint has no secret', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = buildPayloadStub([{ id: 3, url: 'https://hook.example/three', name: 'three' }])
    await dispatchWebhook({ ticketId: 1 }, 'ticket_created', payload, slugs)

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-Webhook-Signature']).toBeUndefined()
  })
})
