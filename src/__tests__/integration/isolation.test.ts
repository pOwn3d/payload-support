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

/**
 * Cross-tenant WRITE boundary. Read isolation above is worthless if a client can
 * simply grant themselves access (ticket-collaborators), post into someone else's
 * thread, open a ticket in another client's name with forged billing flags, or
 * overwrite their own privileged fields.
 */
describe('cross-client write isolation', () => {
  it('a client cannot grant themselves collaborator access to a foreign ticket', async () => {
    const payload = await buildTestPayload()

    const attacker = await payload.create({ collection: 'support-clients', data: { email: 'w-attacker@example.com', password: PW, firstName: 'W', lastName: 'A', company: 'W' }, overrideAccess: true })
    const victim = await payload.create({ collection: 'support-clients', data: { email: 'w-victim@example.com', password: PW, firstName: 'W', lastName: 'V', company: 'V' }, overrideAccess: true })
    const victimTicket = await payload.create({ collection: 'tickets', data: { subject: 'victim', client: victim.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    await expect(
      payload.create({
        collection: 'ticket-collaborators',
        data: { ticket: victimTicket.id, client: attacker.id, invitedBy: attacker.id, role: 'collaborator' },
        overrideAccess: false,
        user: { ...attacker, collection: 'support-clients' } as never,
      }),
    ).rejects.toThrow()
  }, 60_000)

  it('a client cannot post a message into a foreign ticket', async () => {
    const payload = await buildTestPayload()

    const attacker = await payload.create({ collection: 'support-clients', data: { email: 'm-attacker@example.com', password: PW, firstName: 'M', lastName: 'A', company: 'M' }, overrideAccess: true })
    const victim = await payload.create({ collection: 'support-clients', data: { email: 'm-victim@example.com', password: PW, firstName: 'M', lastName: 'V', company: 'V' }, overrideAccess: true })
    const victimTicket = await payload.create({ collection: 'tickets', data: { subject: 'victim thread', client: victim.id, status: 'open', priority: 'normal' }, overrideAccess: true })
    const ownTicket = await payload.create({ collection: 'tickets', data: { subject: 'own thread', client: attacker.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    await expect(
      payload.create({
        collection: 'ticket-messages',
        data: { ticket: victimTicket.id, body: 'PHISHING' },
        overrideAccess: false,
        user: { ...attacker, collection: 'support-clients' } as never,
      }),
    ).rejects.toThrow()

    // …but their own ticket still accepts a reply (the guard must not close the portal).
    const ok = await payload.create({
      collection: 'ticket-messages',
      data: { ticket: ownTicket.id, body: 'legit reply' },
      overrideAccess: false,
      user: { ...attacker, collection: 'support-clients' } as never,
    })
    expect((ok as { body?: string }).body).toBe('legit reply')
  }, 60_000)

  it('a client-created ticket is forced onto their own account, without forged billing flags', async () => {
    const payload = await buildTestPayload()

    const attacker = await payload.create({ collection: 'support-clients', data: { email: 't-attacker@example.com', password: PW, firstName: 'T', lastName: 'A', company: 'T' }, overrideAccess: true })
    const victim = await payload.create({ collection: 'support-clients', data: { email: 't-victim@example.com', password: PW, firstName: 'T', lastName: 'V', company: 'V' }, overrideAccess: true })

    const created = await payload.create({
      collection: 'tickets',
      data: {
        subject: 'forged',
        client: victim.id,
        priority: 'urgent',
        status: 'resolved',
        paymentStatus: 'paid',
        billable: false,
      } as never,
      overrideAccess: false,
      user: { ...attacker, collection: 'support-clients' } as never,
      depth: 0,
    })

    const doc = created as unknown as Record<string, unknown>
    expect(String(doc.client)).toBe(String(attacker.id))
    expect(doc.paymentStatus).not.toBe('paid')
    expect(doc.billable).not.toBe(false)
    expect(doc.status).toBe('open')
    // The portal legitimately lets the client pick a priority — it must survive.
    expect(doc.priority).toBe('urgent')
  }, 60_000)

  it('a client cannot self-promote their tier or write googleId on their own doc', async () => {
    const payload = await buildTestPayload()

    const client = await payload.create({ collection: 'support-clients', data: { email: 'p-self@example.com', password: PW, firstName: 'P', lastName: 'S', company: 'P', tier: 'free' }, overrideAccess: true })

    const updated = await payload.update({
      collection: 'support-clients',
      id: client.id,
      data: { firstName: 'Renamed', tier: 'enterprise', googleId: 'attacker-google-sub', notes: 'wiped', twoFactorVerifiedAt: new Date().toISOString() } as never,
      overrideAccess: false,
      user: { ...client, collection: 'support-clients' } as never,
    })

    // The legitimate self-service field went through…
    expect((updated as { firstName?: string }).firstName).toBe('Renamed')

    // …the privileged ones did not. Re-read as admin: field-level read access
    // hides notes/opportunities from the client's own serialized doc.
    const admin = await payload.create({ collection: 'users', data: { email: 'admin-priv@example.com', password: PW } as never, overrideAccess: true })
    const asAdmin = await payload.findByID({
      collection: 'support-clients',
      id: client.id,
      overrideAccess: false,
      user: { ...admin, collection: 'users' } as never,
    }) as unknown as Record<string, unknown>

    expect(asAdmin.tier).toBe('free')
    expect(asAdmin.googleId).toBeFalsy()
    expect(asAdmin.notes).toBeFalsy()
    expect(asAdmin.twoFactorVerifiedAt).toBeFalsy()
  }, 60_000)
})
