import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * Validates that the bodyHtml sanitization (P0-1) is actually wired into the
 * TicketMessages beforeChange hook — i.e. stored HTML is stripped of script /
 * event handlers before it can be persisted and later rendered.
 */
describe('stored-XSS sanitization on write (P0-1)', () => {
  it('strips <script> and inline handlers from bodyHtml at persistence', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'xss@example.com', password: PW, firstName: 'X', lastName: 'S', company: 'C' }, overrideAccess: true })
    const t = await payload.create({ collection: 'tickets', data: { subject: 'xss', client: c.id, status: 'open', priority: 'normal' }, overrideAccess: true })

    const m = await payload.create({
      collection: 'ticket-messages',
      data: {
        ticket: t.id,
        body: 'hello',
        bodyHtml: '<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">x</a><b>kept</b>',
        authorType: 'client',
        authorClient: c.id,
      },
      overrideAccess: true,
    })

    const stored = (m as { bodyHtml?: string }).bodyHtml || ''
    expect(stored).not.toMatch(/onerror/i)
    expect(stored).not.toMatch(/<script/i)
    expect(stored).not.toMatch(/javascript:/i)
    expect(stored).toContain('<b>kept</b>') // legitimate formatting preserved
  }, 60_000)
})
