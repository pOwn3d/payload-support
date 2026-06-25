import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * SLA pause-on-hold (P2): time spent waiting on the client must not count against
 * the resolution SLA — the resolution deadline is pushed forward by the paused span.
 */
describe('SLA pause-on-hold (P2)', () => {
  it('extends the resolution deadline by the time spent in waiting_client', async () => {
    const payload = await buildTestPayload()
    await payload.create({ collection: 'sla-policies', data: { name: 'P', priority: 'normal', firstResponseTime: 60, resolutionTime: 240, businessHoursOnly: false, isDefault: true }, overrideAccess: true })
    const c = await payload.create({ collection: 'support-clients', data: { email: 'pause@example.com', password: PW, firstName: 'P', lastName: 'H', company: 'C' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'pause', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const before = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    const dueBefore = new Date(before.slaResolutionDue as string).getTime()
    expect(dueBefore).toBeGreaterThan(0)

    // Enter hold → the clock should pause.
    await payload.update({ collection: 'tickets', id: t.id, data: { status: 'waiting_client' }, overrideAccess: true })
    const mid = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    expect(mid.slaPausedAt).toBeTruthy()

    // Simulate ~2h of waiting by backdating the pause marker (status unchanged → hook no-op).
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
    await payload.update({ collection: 'tickets', id: t.id, data: { slaPausedAt: twoHoursAgo }, overrideAccess: true })

    // Leave hold → deadline extended, pause cleared.
    await payload.update({ collection: 'tickets', id: t.id, data: { status: 'open' }, overrideAccess: true })
    const after = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })

    expect(after.slaPausedAt).toBeFalsy()
    const extensionMs = new Date(after.slaResolutionDue as string).getTime() - dueBefore
    expect(extensionMs).toBeGreaterThan(1.9 * 3_600_000)
    expect(extensionMs).toBeLessThan(2.2 * 3_600_000)
  }, 60_000)
})
