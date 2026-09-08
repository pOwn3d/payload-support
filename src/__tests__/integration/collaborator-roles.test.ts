import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * Non-regression — SUP/collab-viewer.
 *
 * `/support/tickets/:id/invite` offers two roles and the invitation email spells
 * them out ("lecteur (consultation)" vs "collaborateur (peut répondre)"), but
 * nothing ever read `role` back: `resolveAccessibleTicketIds` added the ticket as
 * soon as a collaborator row existed, and the write guard on `ticket-messages`
 * only checked membership in that set. A viewer could therefore post into the
 * thread and fan out the whole notification chain.
 */
describe('ticket collaborator roles', () => {
  async function seed(role: 'viewer' | 'collaborator' | undefined, tag: string) {
    const payload = await buildTestPayload()

    const owner = await payload.create({
      collection: 'support-clients',
      data: { email: `owner-${tag}@example.com`, password: PW, firstName: 'O', lastName: 'W', company: 'O' },
      overrideAccess: true,
    })
    const invitee = await payload.create({
      collection: 'support-clients',
      data: { email: `guest-${tag}@example.com`, password: PW, firstName: 'G', lastName: 'U', company: 'G' },
      overrideAccess: true,
    })
    const ticket = await payload.create({
      collection: 'tickets',
      data: { subject: `collab ${tag}`, client: owner.id, status: 'open', priority: 'normal' },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'ticket-collaborators',
      data: {
        ticket: ticket.id,
        client: invitee.id,
        email: `guest-${tag}@example.com`,
        invitedBy: { relationTo: 'support-clients', value: owner.id },
        ...(role ? { role } : {}),
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'ticket-messages',
      data: { ticket: ticket.id, body: `THREAD-${tag}`, authorType: 'admin' },
      overrideAccess: true,
    })

    return { payload, invitee, ticket }
  }

  it('a viewer reads the thread but cannot post into it', async () => {
    const { payload, invitee, ticket } = await seed('viewer', 'viewer')
    const asInvitee = { ...invitee, collection: 'support-clients' } as never

    // Read scope is unchanged — the invitation would be pointless otherwise.
    const visible = await payload.find({
      collection: 'ticket-messages',
      overrideAccess: false,
      user: asInvitee,
      limit: 50,
    })
    expect(visible.docs.map((m) => (m as { body?: string }).body)).toContain('THREAD-viewer')

    // Write scope is not.
    await expect(
      payload.create({
        collection: 'ticket-messages',
        data: { ticket: ticket.id, body: 'VIEWER-SHOULD-NOT-POST' },
        overrideAccess: false,
        user: asInvitee,
      }),
    ).rejects.toThrow()
  }, 60_000)

  it('a row with no explicit role is treated as read-only', async () => {
    const { payload, invitee, ticket } = await seed(undefined, 'norole')
    await expect(
      payload.create({
        collection: 'ticket-messages',
        data: { ticket: ticket.id, body: 'NO-ROLE-SHOULD-NOT-POST' },
        overrideAccess: false,
        user: { ...invitee, collection: 'support-clients' } as never,
      }),
    ).rejects.toThrow()
  }, 60_000)

  it('an actual collaborator can still post', async () => {
    const { payload, invitee, ticket } = await seed('collaborator', 'collab')
    const created = await payload.create({
      collection: 'ticket-messages',
      data: { ticket: ticket.id, body: 'COLLABORATOR-REPLY' },
      overrideAccess: false,
      user: { ...invitee, collection: 'support-clients' } as never,
    })
    expect((created as { body?: string }).body).toBe('COLLABORATOR-REPLY')
  }, 60_000)

  it('the ticket owner is never affected by the collaborator role', async () => {
    const payload = await buildTestPayload()
    const owner = await payload.create({
      collection: 'support-clients',
      data: { email: 'owner-plain@example.com', password: PW, firstName: 'O', lastName: 'P', company: 'O' },
      overrideAccess: true,
    })
    const ticket = await payload.create({
      collection: 'tickets',
      data: { subject: 'owned', client: owner.id, status: 'open', priority: 'normal' },
      overrideAccess: true,
    })
    const created = await payload.create({
      collection: 'ticket-messages',
      data: { ticket: ticket.id, body: 'OWNER-REPLY' },
      overrideAccess: false,
      user: { ...owner, collection: 'support-clients' } as never,
    })
    expect((created as { body?: string }).body).toBe('OWNER-REPLY')
  }, 60_000)
})
