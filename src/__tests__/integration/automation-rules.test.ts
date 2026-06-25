import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * Automation rules engine (P2 #7): when a ticket event fires and the rule's
 * conditions match, its actions are applied — in a single guarded update (no loop).
 */
describe('automation rules engine (P2 #7)', () => {
  it('applies actions when conditions match, leaves non-matching tickets untouched', async () => {
    const payload = await buildTestPayload()
    await payload.create({
      collection: 'automation-rules',
      data: {
        name: 'Bugs are urgent',
        enabled: true,
        event: 'ticket_created',
        matchType: 'all',
        order: 0,
        conditions: [{ field: 'category', operator: 'equals', value: 'bug' }],
        actions: [{ type: 'set_priority', value: 'urgent' }],
      },
      overrideAccess: true,
    })
    const c = await payload.create({ collection: 'support-clients', data: { email: 'auto@example.com', password: PW, firstName: 'A', lastName: 'U', company: 'C' }, overrideAccess: true })

    // Matching ticket → priority upgraded to urgent by the rule.
    const bug = await payload.create({ collection: 'tickets', data: { subject: 'crash', client: c.id, status: 'open', priority: 'normal', category: 'bug' }, overrideAccess: true })
    const bugRead = await payload.findByID({ collection: 'tickets', id: bug.id, overrideAccess: true })
    expect(bugRead.priority).toBe('urgent')

    // Non-matching ticket → unchanged.
    const q = await payload.create({ collection: 'tickets', data: { subject: 'how to', client: c.id, status: 'open', priority: 'normal', category: 'question' }, overrideAccess: true })
    const qRead = await payload.findByID({ collection: 'tickets', id: q.id, overrideAccess: true })
    expect(qRead.priority).toBe('normal')
  }, 60_000)

  it('supports multiple actions and the "any" match type', async () => {
    const payload = await buildTestPayload()
    await payload.create({
      collection: 'automation-rules',
      data: {
        name: 'Triage hosting/feature',
        enabled: true,
        event: 'ticket_created',
        matchType: 'any',
        order: 0,
        conditions: [
          { field: 'category', operator: 'equals', value: 'hosting' },
          { field: 'subject', operator: 'contains', value: 'urgent' },
        ],
        actions: [
          { type: 'set_status', value: 'escalated' },
          { type: 'set_priority', value: 'high' },
        ],
      },
      overrideAccess: true,
    })
    const c = await payload.create({ collection: 'support-clients', data: { email: 'auto2@example.com', password: PW, firstName: 'A', lastName: 'U', company: 'C' }, overrideAccess: true })

    // Matches via subject contains "urgent" (any) → both actions applied.
    const t = await payload.create({ collection: 'tickets', data: { subject: 'this is URGENT please', client: c.id, status: 'open', priority: 'low', category: 'question' }, overrideAccess: true })
    const r = await payload.findByID({ collection: 'tickets', id: t.id, overrideAccess: true })
    expect(r.status).toBe('escalated')
    expect(r.priority).toBe('high')
  }, 60_000)
})
