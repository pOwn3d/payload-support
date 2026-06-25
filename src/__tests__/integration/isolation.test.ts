import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * Validates the cross-client isolation fix (P0-4): a support-client must never
 * read another client's ticket messages / activity, and field-level access
 * (P0-7) must hide admin-only fields from the client's own doc.
 */
describe('cross-client isolation (P0-4 / P0-7)', () => {
  it('a client cannot read another client\'s ticket messages', async () => {
    const payload = await buildTestPayload()

    const a = await payload.create({ collection: 'support-clients', data: { email: 'iso-a@example.com', password: PW, firstName: 'A', lastName: 'A', company: 'A' }, overrideAccess: true })
    const b = await payload.create({ collection: 'support-clients', data: { email: 'iso-b@example.com', password: PW, firstName: 'B', lastName: 'B', company: 'B' }, overrideAccess: true })

    const ta = await payload.create({ collection: 'tickets', data: { subject: 'A ticket', client: a.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    const tb = await payload.create({ collection: 'tickets', data: { subject: 'B ticket', client: b.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    await payload.create({ collection: 'ticket-messages', data: { ticket: ta.id, body: 'SECRET-A-MESSAGE', authorType: 'admin' }, overrideAccess: true })
    await payload.create({ collection: 'ticket-messages', data: { ticket: tb.id, body: 'SECRET-B-MESSAGE', authorType: 'admin' }, overrideAccess: true })

    // Read messages AS client A, with access control enforced.
    const asA = await payload.find({
      collection: 'ticket-messages',
      overrideAccess: false,
      user: { ...a, collection: 'support-clients' } as never,
      limit: 200,
    })
    const bodies = asA.docs.map((m) => (m as { body?: string }).body)

    expect(bodies).toContain('SECRET-A-MESSAGE')
    expect(bodies).not.toContain('SECRET-B-MESSAGE') // ← the cross-client boundary
  }, 60_000)

  it('a client cannot read another client\'s activity log', async () => {
    const payload = await buildTestPayload()

    const a = await payload.create({ collection: 'support-clients', data: { email: 'act-a@example.com', password: PW, firstName: 'A', lastName: 'A', company: 'A' }, overrideAccess: true })
    const b = await payload.create({ collection: 'support-clients', data: { email: 'act-b@example.com', password: PW, firstName: 'B', lastName: 'B', company: 'B' }, overrideAccess: true })
    const ta = await payload.create({ collection: 'tickets', data: { subject: 'A', client: a.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    const tb = await payload.create({ collection: 'tickets', data: { subject: 'B', client: b.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    await payload.create({ collection: 'ticket-activity-log', data: { ticket: ta.id, action: 'status_changed', detail: 'ACT-A' }, overrideAccess: true })
    await payload.create({ collection: 'ticket-activity-log', data: { ticket: tb.id, action: 'status_changed', detail: 'ACT-B' }, overrideAccess: true })

    const asA = await payload.find({
      collection: 'ticket-activity-log',
      overrideAccess: false,
      user: { ...a, collection: 'support-clients' } as never,
      limit: 200,
    })
    const details = asA.docs.map((m) => (m as { detail?: string }).detail)
    expect(details).toContain('ACT-A')
    expect(details).not.toContain('ACT-B')
  }, 60_000)

  it('does not serialize admin-only opportunities/notes to the client (P0-7)', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'fa@example.com', password: PW, firstName: 'F', lastName: 'A', company: 'C', opportunities: 'SECRET-DEAL', notes: 'INTERNAL-NOTE' }, overrideAccess: true })

    const asClient = await payload.findByID({
      collection: 'support-clients',
      id: c.id,
      overrideAccess: false,
      user: { ...c, collection: 'support-clients' } as never,
    })
    expect((asClient as { opportunities?: string }).opportunities).toBeFalsy()
    expect((asClient as { notes?: string }).notes).toBeFalsy()

    // Admin (users collection) still sees them.
    const admin = await payload.create({ collection: 'users', data: { email: 'admin-fa@example.com', password: PW } as never, overrideAccess: true })
    const asAdmin = await payload.findByID({
      collection: 'support-clients',
      id: c.id,
      overrideAccess: false,
      user: { ...admin, collection: 'users' } as never,
    })
    expect((asAdmin as { opportunities?: string }).opportunities).toBe('SECRET-DEAL')
  }, 60_000)
})
