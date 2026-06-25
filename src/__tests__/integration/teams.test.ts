import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * Multi-team / workspaces (roadmap): with `SUPPORT_TEAM_SCOPING` enabled, an agent
 * only sees tickets of the teams they belong to (plus team-less tickets).
 */
describe('multi-team scoping (roadmap)', () => {
  it('scopes ticket visibility to the agent\'s teams when enabled', async () => {
    process.env.SUPPORT_TEAM_SCOPING = '1'
    const payload = await buildTestPayload()

    const agentA = await payload.create({ collection: 'users', data: { email: 'team-a@example.com', password: PW } as never, overrideAccess: true })
    const agentB = await payload.create({ collection: 'users', data: { email: 'team-b@example.com', password: PW } as never, overrideAccess: true })
    const teamA = await payload.create({ collection: 'support-teams', data: { name: 'Team A', members: [agentA.id] }, overrideAccess: true })
    const teamB = await payload.create({ collection: 'support-teams', data: { name: 'Team B', members: [agentB.id] }, overrideAccess: true })

    const c = await payload.create({ collection: 'support-clients', data: { email: 'team-c@example.com', password: PW, firstName: 'T', lastName: 'C', company: 'C' }, overrideAccess: true })
    const tA = await payload.create({ collection: 'tickets', data: { subject: 'A', client: c.id, status: 'open', priority: 'normal', team: teamA.id }, overrideAccess: true })
    const tB = await payload.create({ collection: 'tickets', data: { subject: 'B', client: c.id, status: 'open', priority: 'normal', team: teamB.id }, overrideAccess: true })
    const tNone = await payload.create({ collection: 'tickets', data: { subject: 'none', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const asA = await payload.find({
      collection: 'tickets',
      overrideAccess: false,
      user: { ...agentA, collection: 'users' } as never,
      limit: 200,
    })
    const ids = asA.docs.map((t) => String(t.id))
    expect(ids).toContain(String(tA.id))
    expect(ids).toContain(String(tNone.id)) // team-less tickets stay visible
    expect(ids).not.toContain(String(tB.id)) // other team's ticket hidden

    delete process.env.SUPPORT_TEAM_SCOPING
  }, 60_000)
})
