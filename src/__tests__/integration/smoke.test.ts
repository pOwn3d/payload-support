import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

describe('integration harness', () => {
  it('boots Payload with the support plugin and round-trips a ticket', async () => {
    const payload = await buildTestPayload()

    const client = await payload.create({
      collection: 'support-clients',
      data: { email: 'smoke@example.com', password: 'pw-smoke-123', firstName: 'Smoke', lastName: 'Test', company: 'ACME' },
      overrideAccess: true,
    })

    const ticket = await payload.create({
      collection: 'tickets',
      data: { subject: 'Smoke ticket', client: client.id, status: 'open', priority: 'normal' },
      overrideAccess: true,
    })

    expect(ticket.id).toBeTruthy()
    expect(ticket.ticketNumber).toMatch(/^TK-/)

    const reread = await payload.findByID({ collection: 'tickets', id: ticket.id, overrideAccess: true })
    expect(reread.subject).toBe('Smoke ticket')
  }, 60_000)
})
