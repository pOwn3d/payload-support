import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createAdminStatsEndpoint } from '../../endpoints/admin-stats'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/**
 * Dashboard real volume series (P2 #4): admin-stats returns a real per-day ticket
 * count for the last 7 days (replacing the previous synthetic distribution).
 */
describe('dashboard real volume series (P2 #4)', () => {
  it('returns 7 chronological daily buckets, today reflecting created tickets', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'vol@example.com', password: PW, firstName: 'V', lastName: 'O', company: 'C' }, overrideAccess: true })
    for (let i = 0; i < 3; i++) {
      await payload.create({ collection: 'tickets', data: { subject: `v${i}`, client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    }

    const admin = await payload.create({ collection: 'users', data: { email: 'vol-admin@example.com', password: PW } as never, overrideAccess: true })
    const ep = createAdminStatsEndpoint(slugs)
    const req = { payload, user: { ...admin, collection: 'users' }, url: 'http://localhost/api/support/admin-stats', headers: new Headers({}) }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    const json = await res.json()

    expect(Array.isArray(json.volumeByDay)).toBe(true)
    expect(json.volumeByDay).toHaveLength(7)
    expect(json.volumeByDay[6].count).toBeGreaterThanOrEqual(3) // today (last bucket)
  }, 60_000)
})
