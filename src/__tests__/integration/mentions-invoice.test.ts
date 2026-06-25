import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createInvoiceEndpoint } from '../../endpoints/invoice'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/** @mentions (P2 #6): `@email` in a message resolves to agent IDs on `mentions`. */
describe('@mentions (P2 #6)', () => {
  it('resolves @email mentions in a message body to agent IDs', async () => {
    const payload = await buildTestPayload()
    const agent = await payload.create({ collection: 'users', data: { email: 'agent@example.com', password: PW } as never, overrideAccess: true })
    const c = await payload.create({ collection: 'support-clients', data: { email: 'mc@example.com', password: PW, firstName: 'M', lastName: 'C', company: 'C' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'mention', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const m = await payload.create({
      collection: 'ticket-messages',
      data: { ticket: t.id, body: 'Hey @agent@example.com can you check this?', authorType: 'admin', isInternal: true },
      overrideAccess: true,
    })

    const reread = await payload.findByID({ collection: 'ticket-messages', id: m.id, depth: 0, overrideAccess: true })
    const mentions = (reread as { mentions?: Array<number | string> }).mentions || []
    expect(mentions.map(String)).toContain(String(agent.id))
  }, 60_000)
})

/** Invoice (P2 #6): a print-ready HTML invoice with the correct total. */
describe('printable invoice (P2 #6)', () => {
  it('renders an HTML invoice summing billable tickets', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'inv@example.com', password: PW, firstName: 'I', lastName: 'V', company: 'ACME Corp' }, overrideAccess: true })
    const t1 = await payload.create({ collection: 'tickets', data: { subject: 'inv-a', client: c.id, status: 'resolved', priority: 'normal', billable: true, billedAmount: 100 }, overrideAccess: true })
    await payload.create({ collection: 'tickets', data: { subject: 'inv-b', client: c.id, status: 'resolved', priority: 'normal', billable: true, billedAmount: 50 }, overrideAccess: true })

    const admin = await payload.create({ collection: 'users', data: { email: 'inv-admin@example.com', password: PW } as never, overrideAccess: true })
    const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const ep = createInvoiceEndpoint(slugs)
    const req = { payload, user: { ...admin, collection: 'users' }, url: `http://localhost/api/support/billing/invoice?from=${from}&to=${to}`, headers: new Headers({}) }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)

    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    const body = await res.text()
    expect(body).toContain('150.00 €') // 100 + 50
    expect(body).toContain(String(t1.ticketNumber))
    expect(body).toContain('ACME Corp')
  }, 60_000)
})
