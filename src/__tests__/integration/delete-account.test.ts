import { describe, it, expect } from 'vitest'
import type { PayloadRequest } from 'payload'
import { buildTestPayload } from './buildTestPayload'
import { createDeleteAccountEndpoint } from '../../endpoints/delete-account'
import { DEFAULT_SLUGS, FIXED_SLUGS } from '../../utils/slugs'

const PW = 'test-pw-12345'

/**
 * RGPD art. 17. The endpoint used to leave behind the auth journal, the email
 * journal, the AI summaries, the CSAT feedback, the collaborator invitations,
 * the notification queue and every uploaded attachment. This test plants a row
 * in each of those and asserts the account leaves nothing.
 */
describe('POST /support/delete-account erases every collection that holds the client', () => {
  it('leaves no row and no attachment behind', async () => {
    const payload = await buildTestPayload()
    const slugs = DEFAULT_SLUGS
    const email = 'erase-me@example.com'

    const client = await payload.create({
      collection: 'support-clients',
      data: { email, password: PW, firstName: 'E', lastName: 'M', company: 'C' },
      overrideAccess: true,
    })

    const other = await payload.create({
      collection: 'support-clients',
      data: { email: 'keep-me@example.com', password: PW, firstName: 'K', lastName: 'M', company: 'C' },
      overrideAccess: true,
    })

    const media = await payload.create({
      collection: 'media',
      data: { alt: 'attachment' },
      file: {
        name: 'erase-me.txt',
        data: Buffer.from('attachment body'),
        mimetype: 'text/plain',
        size: 15,
      },
      overrideAccess: true,
    })

    const ticket = await payload.create({
      collection: slugs.tickets,
      data: { subject: 'To erase', description: 'x', client: client.id, status: 'open' },
      overrideAccess: true,
    })

    const otherTicket = await payload.create({
      collection: slugs.tickets,
      data: { subject: 'To keep', description: 'x', client: other.id, status: 'open' },
      overrideAccess: true,
    })

    await payload.create({
      collection: slugs.ticketMessages,
      data: {
        ticket: ticket.id,
        body: 'hello',
        authorType: 'client',
        attachments: [{ file: media.id }],
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: slugs.timeEntries,
      data: { ticket: ticket.id, duration: 10, date: new Date().toISOString() },
      overrideAccess: true,
    })
    await payload.create({
      collection: slugs.satisfactionSurveys,
      data: { ticket: ticket.id, client: client.id, rating: 5 },
      overrideAccess: true,
    })
    await payload.create({
      collection: slugs.authLogs,
      data: { email, success: true, action: 'login' },
      overrideAccess: true,
    })
    await payload.create({
      collection: slugs.emailLogs,
      data: { status: 'success', senderEmail: email, subject: 'hi' },
      overrideAccess: true,
    })
    await payload.create({
      collection: slugs.emailLogs,
      data: { status: 'success', recipientEmail: email, subject: 'hi again' },
      overrideAccess: true,
    })
    await payload.create({
      collection: slugs.notificationQueue,
      data: { client: client.id, type: 'ticket', title: 'x', message: 'y' },
      overrideAccess: true,
    })
    await payload.create({
      collection: FIXED_SLUGS.clientSummaries,
      data: { client: client.id, clientName: 'E M', summary: 'derived' },
      overrideAccess: true,
    })
    await payload.create({
      collection: FIXED_SLUGS.ticketFeedback,
      data: { ticket: ticket.id, client: client.id, rating: 4 },
      overrideAccess: true,
    })
    const staff = await payload.create({
      collection: 'users',
      data: { email: 'staff@example.com', password: PW, name: 'Staff' },
      overrideAccess: true,
    })
    await payload.create({
      collection: FIXED_SLUGS.ticketCollaborators,
      data: {
        ticket: ticket.id,
        client: client.id,
        email,
        role: 'viewer',
        invitedBy: { relationTo: 'users', value: staff.id },
      },
      overrideAccess: true,
    })

    // Rows belonging to somebody else, to prove the erasure is scoped.
    await payload.create({
      collection: slugs.authLogs,
      data: { email: 'keep-me@example.com', success: true, action: 'login' },
      overrideAccess: true,
    })

    const req = {
      payload,
      user: { ...client, collection: slugs.supportClients },
      json: async () => ({ confirmPassword: PW }),
    } as unknown as PayloadRequest

    const response = await createDeleteAccountEndpoint(slugs).handler!(req)
    expect(response.status).toBe(200)

    const countWhere = async (collection: string, where: object) =>
      (await payload.count({ collection: collection as never, where: where as never, overrideAccess: true })).totalDocs

    expect(await countWhere(slugs.tickets, { client: { equals: client.id } })).toBe(0)
    expect(await countWhere(slugs.ticketMessages, { ticket: { equals: ticket.id } })).toBe(0)
    expect(await countWhere(slugs.timeEntries, { ticket: { equals: ticket.id } })).toBe(0)
    expect(await countWhere(slugs.satisfactionSurveys, { client: { equals: client.id } })).toBe(0)
    expect(await countWhere(slugs.authLogs, { email: { equals: email } })).toBe(0)
    expect(await countWhere(slugs.emailLogs, { senderEmail: { equals: email } })).toBe(0)
    expect(await countWhere(slugs.emailLogs, { recipientEmail: { equals: email } })).toBe(0)
    expect(await countWhere(slugs.notificationQueue, { client: { equals: client.id } })).toBe(0)
    expect(await countWhere(FIXED_SLUGS.clientSummaries, { client: { equals: client.id } })).toBe(0)
    expect(await countWhere(FIXED_SLUGS.ticketFeedback, { client: { equals: client.id } })).toBe(0)
    expect(await countWhere(FIXED_SLUGS.ticketCollaborators, { email: { equals: email } })).toBe(0)
    expect(await countWhere(slugs.supportClients, { id: { equals: client.id } })).toBe(0)

    // The uploaded file is gone from the host's media collection.
    expect(await countWhere('media', { id: { equals: media.id } })).toBe(0)

    // Everybody else is untouched.
    expect(await countWhere(slugs.tickets, { id: { equals: otherTicket.id } })).toBe(1)
    expect(await countWhere(slugs.authLogs, { email: { equals: 'keep-me@example.com' } })).toBe(1)
    expect(await countWhere(slugs.supportClients, { id: { equals: other.id } })).toBe(1)
  }, 120_000)
})
