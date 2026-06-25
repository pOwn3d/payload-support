import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createAdminStatsEndpoint } from '../../endpoints/admin-stats'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/**
 * NPS (P2): satisfaction surveys can carry an NPS score (0-10), and admin-stats
 * computes the Net Promoter Score = %promoters(9-10) − %detractors(0-6).
 */
describe('NPS (P2)', () => {
  it('stores NPS scores and computes the NPS in admin-stats', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'nps@example.com', password: PW, firstName: 'N', lastName: 'P', company: 'C' }, overrideAccess: true })

    // 3 promoters (10,9,9), 1 passive (7), 2 detractors (3,5) → (3-2)/6 = 16.67% ≈ 17
    for (const nps of [10, 9, 9, 7, 3, 5]) {
      await payload.create({ collection: 'satisfaction-surveys', data: { source: 'ticket', client: c.id, nps }, overrideAccess: true })
    }

    const admin = await payload.create({ collection: 'users', data: { email: 'nps-admin@example.com', password: PW } as never, overrideAccess: true })
    const ep = createAdminStatsEndpoint(slugs)
    const req = {
      payload,
      user: { ...admin, collection: 'users' },
      url: 'http://localhost/api/support/admin-stats',
      headers: new Headers({}),
    }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    const json = await res.json()

    expect(json.npsCount).toBe(6)
    expect(json.npsScore).toBe(17)
  }, 60_000)
})
