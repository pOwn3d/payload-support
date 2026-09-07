import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * `tickets.totalTimeMinutes` is a rollup maintained by the TimeEntries hooks, and
 * it is what the invoice endpoint and the CRM view bill on. It only had an
 * afterChange hook, so a deleted entry stayed billed forever.
 */
describe('time entries → ticket rollup', () => {
  it('recomputes totalTimeMinutes on create AND on delete', async () => {
    const payload = await buildTestPayload()

    const client = await payload.create({ collection: 'support-clients', data: { email: 'time@example.com', password: PW, firstName: 'T', lastName: 'E', company: 'T' }, overrideAccess: true })
    const ticket = await payload.create({ collection: 'tickets', data: { subject: 'time rollup', client: client.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const first = await payload.create({ collection: 'time-entries', data: { ticket: ticket.id, duration: 30, date: new Date().toISOString() }, overrideAccess: true })
    await payload.create({ collection: 'time-entries', data: { ticket: ticket.id, duration: 20, date: new Date().toISOString() }, overrideAccess: true })

    const afterCreate = await payload.findByID({ collection: 'tickets', id: ticket.id, depth: 0, overrideAccess: true })
    expect((afterCreate as { totalTimeMinutes?: number }).totalTimeMinutes).toBe(50)

    await payload.delete({ collection: 'time-entries', id: first.id, overrideAccess: true })

    const afterDelete = await payload.findByID({ collection: 'tickets', id: ticket.id, depth: 0, overrideAccess: true })
    expect((afterDelete as { totalTimeMinutes?: number }).totalTimeMinutes).toBe(20)
  }, 60_000)
})
