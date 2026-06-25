import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createProcessDigestsEndpoint } from '../../endpoints/process-digests'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/**
 * Digest notifications (P2 #5): clients on daily/weekly frequency have their reply
 * notifications queued instead of emailed immediately, then drained as one recap
 * by the process-digests cron. Immediate-frequency clients are never queued.
 */
describe('digest notifications (P2 #5)', () => {
  it('queues reply notifications for daily clients and drains them via the cron', async () => {
    const payload = await buildTestPayload()
    process.env.CRON_SECRET = 'test-cron-secret'
    const c = await payload.create({ collection: 'support-clients', data: { email: 'digest@example.com', password: PW, firstName: 'D', lastName: 'G', company: 'C', notificationFrequency: 'daily' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'digest', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    // Admin reply → queued (client is on daily cadence), not emailed.
    await payload.create({ collection: 'ticket-messages', data: { ticket: t.id, body: 'admin reply', authorType: 'admin' }, overrideAccess: true })

    const queued = await payload.find({ collection: 'notification-queue', where: { client: { equals: c.id } }, overrideAccess: true })
    expect(queued.totalDocs).toBe(1)

    // Daily digest cron drains the queue.
    const ep = createProcessDigestsEndpoint(slugs)
    const req = { payload, headers: new Headers({ 'x-cron-secret': 'test-cron-secret' }), json: async () => ({ frequency: 'daily' }) }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.items).toBeGreaterThanOrEqual(1)

    const after = await payload.find({ collection: 'notification-queue', where: { client: { equals: c.id } }, overrideAccess: true })
    expect(after.totalDocs).toBe(0)
  }, 60_000)

  it('does not queue for immediate-frequency clients', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'imm@example.com', password: PW, firstName: 'I', lastName: 'M', company: 'C' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'imm', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    await payload.create({ collection: 'ticket-messages', data: { ticket: t.id, body: 'admin reply', authorType: 'admin' }, overrideAccess: true })

    const queued = await payload.find({ collection: 'notification-queue', where: { client: { equals: c.id } }, overrideAccess: true })
    expect(queued.totalDocs).toBe(0)
  }, 60_000)
})
