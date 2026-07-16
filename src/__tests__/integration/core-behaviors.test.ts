import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

async function makeClient(payload: Awaited<ReturnType<typeof buildTestPayload>>, email: string) {
  return payload.create({ collection: 'support-clients', data: { email, password: PW, firstName: 'C', lastName: 'C', company: 'C' }, overrideAccess: true })
}

/**
 * Regression coverage for core ticketing behaviours that the P2 features will be
 * built on top of: ticket numbering, auto-status transitions on reply, and SLA
 * deadline assignment.
 */
describe('core ticketing behaviours', () => {
  it('auto-assigns a unique TK- number to each ticket', async () => {
    const payload = await buildTestPayload()
    const c = await makeClient(payload, 'num@example.com')
    const t1 = await payload.create({ collection: 'tickets', data: { subject: 'one', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    const t2 = await payload.create({ collection: 'tickets', data: { subject: 'two', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    expect(t1.ticketNumber).toMatch(/^TK-\d{4}/)
    expect(t2.ticketNumber).toMatch(/^TK-\d{4}/)
    expect(t1.ticketNumber).not.toBe(t2.ticketNumber)
  }, 60_000)

  it('allocates sequential numbers under concurrent creation and after deletion', async () => {
    const payload = await buildTestPayload()
    const c = await makeClient(payload, 'concurrent-num@example.com')
    const tickets = await Promise.all(
      Array.from({ length: 12 }, (_, index) => payload.create({
        collection: 'tickets',
        data: { subject: `concurrent-${index}`, client: c.id, status: 'open', priority: 'normal' },
        overrideAccess: true,
      })),
    )
    const numbers = tickets.map((ticket) => Number(String(ticket.ticketNumber).replace('TK-', '')))
    expect(new Set(numbers)).toHaveLength(12)

    const highest = Math.max(...numbers)
    await payload.delete({ collection: 'tickets', id: tickets[0].id, overrideAccess: true })
    const next = await payload.create({
      collection: 'tickets',
      data: { subject: 'after-delete', client: c.id, status: 'open', priority: 'normal' },
      overrideAccess: true,
    })
    expect(Number(String(next.ticketNumber).replace('TK-', ''))).toBe(highest + 1)
  }, 60_000)

  it('moves status to waiting_client on admin reply and back to open on client reply', async () => {
    const payload = await buildTestPayload()
    const c = await makeClient(payload, 'status@example.com')
    const t = await payload.create({ collection: 'tickets', data: { subject: 'flow', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    await payload.create({ collection: 'ticket-messages', data: { ticket: t.id, body: 'admin reply', authorType: 'admin' }, overrideAccess: true })
    let reread = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    expect(reread.status).toBe('waiting_client')

    await payload.create({ collection: 'ticket-messages', data: { ticket: t.id, body: 'client reply', authorType: 'client', authorClient: c.id }, overrideAccess: true })
    reread = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    expect(reread.status).toBe('open')
  }, 60_000)

  it('assigns SLA deadlines on create from the default policy', async () => {
    const payload = await buildTestPayload()
    await payload.create({
      collection: 'sla-policies',
      data: { name: 'Default', priority: 'normal', firstResponseTime: 60, resolutionTime: 240, businessHoursOnly: false, isDefault: true },
      overrideAccess: true,
    })
    const c = await makeClient(payload, 'sla@example.com')
    const t = await payload.create({ collection: 'tickets', data: { subject: 'sla', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const reread = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    expect(reread.slaFirstResponseDue).toBeTruthy()
    expect(reread.slaResolutionDue).toBeTruthy()
    // resolution deadline must be later than the first-response deadline
    expect(new Date(reread.slaResolutionDue as string).getTime()).toBeGreaterThan(
      new Date(reread.slaFirstResponseDue as string).getTime(),
    )
  }, 60_000)
})
