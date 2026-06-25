import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createProcessSnoozeEndpoint } from '../../endpoints/process-snooze'
import { resolveSlugs } from '../../utils/slugs'

const PW = 'test-pw-12345'
const slugs = resolveSlugs({ users: 'users' })

async function makeClient(payload: Awaited<ReturnType<typeof buildTestPayload>>, email: string) {
  return payload.create({ collection: 'support-clients', data: { email, password: PW, firstName: 'S', lastName: 'N', company: 'C' }, overrideAccess: true })
}

/**
 * Snooze wake-up cron (P2): a snoozed ticket must be hidden from the inbox while
 * `snoozeUntil` is in the future, resurface once it passes, and the cron must
 * clear expired snoozes (audit trail) while leaving future ones untouched.
 */
describe('snooze wake-up cron + inbox hide (P2)', () => {
  it('cron clears expired snoozeUntil and leaves future ones', async () => {
    const payload = await buildTestPayload()
    process.env.CRON_SECRET = 'test-cron-secret'
    const c = await makeClient(payload, 'snz@example.com')
    const past = new Date(Date.now() - 3_600_000).toISOString()
    const future = new Date(Date.now() + 3_600_000).toISOString()
    const tPast = await payload.create({ collection: 'tickets', data: { subject: 'past', client: c.id, status: 'open', priority: 'normal', snoozeUntil: past }, overrideAccess: true })
    const tFuture = await payload.create({ collection: 'tickets', data: { subject: 'future', client: c.id, status: 'open', priority: 'normal', snoozeUntil: future }, overrideAccess: true })

    const ep = createProcessSnoozeEndpoint(slugs)
    const req = { payload, headers: new Headers({ 'x-cron-secret': 'test-cron-secret' }) }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.processed).toBeGreaterThanOrEqual(1)

    const rePast = await payload.findByID({ collection: 'tickets', id: tPast.id, overrideAccess: true })
    const reFuture = await payload.findByID({ collection: 'tickets', id: tFuture.id, overrideAccess: true })
    expect(rePast.snoozeUntil).toBeFalsy() // woken up
    expect(reFuture.snoozeUntil).toBeTruthy() // still snoozed
  }, 60_000)

  it('rejects the cron without the secret', async () => {
    const payload = await buildTestPayload()
    process.env.CRON_SECRET = 'test-cron-secret'
    const ep = createProcessSnoozeEndpoint(slugs)
    const req = { payload, headers: new Headers({}) }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    expect(res.status).toBe(401)
  }, 60_000)

  it('the inbox snooze-hide query excludes future-snoozed tickets', async () => {
    const payload = await buildTestPayload()
    const c = await makeClient(payload, 'snz2@example.com')
    const visible = await payload.create({ collection: 'tickets', data: { subject: 'visible', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    const hidden = await payload.create({ collection: 'tickets', data: { subject: 'hidden', client: c.id, status: 'open', priority: 'normal', snoozeUntil: new Date(Date.now() + 3_600_000).toISOString() }, overrideAccess: true })

    const nowIso = new Date().toISOString()
    // Same where the inbox builds via query params.
    const found = await payload.find({
      collection: 'tickets',
      where: { and: [{ or: [{ snoozeUntil: { exists: false } }, { snoozeUntil: { less_than_equal: nowIso } }] }] },
      limit: 200,
      overrideAccess: true,
    })
    const ids = found.docs.map((t) => t.id)
    expect(ids).toContain(visible.id)
    expect(ids).not.toContain(hidden.id)
  }, 60_000)
})
