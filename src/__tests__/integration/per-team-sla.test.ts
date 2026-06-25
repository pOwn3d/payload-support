import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createAdminStatsEndpoint } from '../../endpoints/admin-stats'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/** Per-team SLA policies & dashboards (roadmap). */
describe('per-team SLA & dashboards (roadmap)', () => {
  it('uses the team-specific SLA policy over the global default', async () => {
    const payload = await buildTestPayload()
    const team = await payload.create({ collection: 'support-teams', data: { name: 'Team SLA' }, overrideAccess: true })
    // Team policy: 2h resolution. Global default: 24h.
    await payload.create({ collection: 'sla-policies', data: { name: 'Team', priority: 'normal', firstResponseTime: 30, resolutionTime: 120, businessHoursOnly: false, team: team.id }, overrideAccess: true })
    await payload.create({ collection: 'sla-policies', data: { name: 'Default', priority: 'normal', firstResponseTime: 120, resolutionTime: 1440, businessHoursOnly: false, isDefault: true }, overrideAccess: true })

    const c = await payload.create({ collection: 'support-clients', data: { email: 'pts@example.com', password: PW, firstName: 'P', lastName: 'T', company: 'C' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'team sla', client: c.id, status: 'open', priority: 'normal', team: team.id }, overrideAccess: true })

    const reread = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    const created = new Date(reread.createdAt as string).getTime()
    const diffMin = (new Date(reread.slaResolutionDue as string).getTime() - created) / 60000
    expect(diffMin).toBeGreaterThan(110) // ~120 (team policy), NOT 1440 (default)
    expect(diffMin).toBeLessThan(130)
  }, 60_000)

  it('scopes the dashboard counts to a team via ?teamId', async () => {
    const payload = await buildTestPayload()
    const teamC = await payload.create({ collection: 'support-teams', data: { name: 'Team C' }, overrideAccess: true })
    const teamD = await payload.create({ collection: 'support-teams', data: { name: 'Team D' }, overrideAccess: true })
    const c = await payload.create({ collection: 'support-clients', data: { email: 'ptd@example.com', password: PW, firstName: 'P', lastName: 'D', company: 'C' }, overrideAccess: true })
    await payload.create({ collection: 'tickets', data: { subject: 'c1', client: c.id, status: 'open', priority: 'normal', team: teamC.id }, overrideAccess: true })
    await payload.create({ collection: 'tickets', data: { subject: 'c2', client: c.id, status: 'open', priority: 'normal', team: teamC.id }, overrideAccess: true })
    await payload.create({ collection: 'tickets', data: { subject: 'd1', client: c.id, status: 'open', priority: 'normal', team: teamD.id }, overrideAccess: true })

    const admin = await payload.create({ collection: 'users', data: { email: 'pt-admin@example.com', password: PW } as never, overrideAccess: true })
    const ep = createAdminStatsEndpoint(slugs)
    const req = { payload, user: { ...admin, collection: 'users' }, url: `http://localhost/api/support/admin-stats?teamId=${teamC.id}`, headers: new Headers({}) }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    const json = await res.json()
    expect(json.total).toBe(2) // only Team C's tickets
  }, 60_000)
})
