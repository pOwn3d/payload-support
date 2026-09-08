import { describe, it, expect } from 'vitest'
import type { PayloadRequest } from 'payload'
import { buildTestPayload } from './buildTestPayload'
import { createExportDataEndpoint } from '../../endpoints/export-data'
import { DEFAULT_SLUGS, FIXED_SLUGS } from '../../utils/slugs'

/**
 * RGPD art. 15 / 20. The export used to stop at profile + tickets + messages +
 * surveys, so the CSAT feedback, the logged time and the AI client summary
 * were invisible to the person they describe. The summary is derived data, so
 * it belongs to a separate section: art. 20 portability does not cover it.
 */
describe('GET /support/export-data', () => {
  it('includes the derived AI summary in its own section, and the rest under portability', async () => {
    const payload = await buildTestPayload()
    const slugs = DEFAULT_SLUGS

    const client = await payload.create({
      collection: 'support-clients',
      data: { email: 'export@example.com', password: 'test-pw-12345', firstName: 'X', lastName: 'P', company: 'C' },
      overrideAccess: true,
    })

    const ticket = await payload.create({
      collection: slugs.tickets,
      data: { subject: 'Exported', description: 'x', client: client.id, status: 'open' },
      overrideAccess: true,
    })

    await payload.create({
      collection: slugs.timeEntries,
      data: { ticket: ticket.id, duration: 42, date: new Date().toISOString(), description: 'work' },
      overrideAccess: true,
    })
    await payload.create({
      collection: FIXED_SLUGS.ticketFeedback,
      data: { ticket: ticket.id, client: client.id, rating: 3, comment: 'meh' },
      overrideAccess: true,
    })
    await payload.create({
      collection: FIXED_SLUGS.clientSummaries,
      data: { client: client.id, clientName: 'X P', summary: 'Derived profile of the client' },
      overrideAccess: true,
    })

    const req = {
      payload,
      user: { ...client, collection: slugs.supportClients },
    } as unknown as PayloadRequest

    const response = await createExportDataEndpoint(slugs).handler!(req)
    expect(response.status).toBe(200)

    const body = JSON.parse(await response.text())

    expect(body.providedByYou.legalBasis).toContain('Art. 20')
    expect(body.providedByYou.profile.email).toBe('export@example.com')
    expect(body.providedByYou.timeEntries).toHaveLength(1)
    expect(body.providedByYou.timeEntries[0].duration).toBe(42)
    expect(body.providedByYou.feedback).toHaveLength(1)
    expect(body.providedByYou.feedback[0].comment).toBe('meh')

    expect(body.derivedData.legalBasis).toContain('Art. 15')
    expect(body.derivedData.clientSummaries).toHaveLength(1)
    expect(body.derivedData.clientSummaries[0].summary).toBe('Derived profile of the client')

    // The derived summary must NOT be filed under portability.
    expect(JSON.stringify(body.providedByYou)).not.toContain('Derived profile of the client')
  }, 120_000)

  it('does not break when a feature-flagged collection is absent', async () => {
    const payload = await buildTestPayload()
    // chat is off in the test config, so `chat-messages` is not registered.
    expect((payload.collections as Record<string, unknown>)['chat-messages']).toBeUndefined()

    const client = await payload.create({
      collection: 'support-clients',
      data: { email: 'export2@example.com', password: 'test-pw-12345', firstName: 'Y', lastName: 'P', company: 'C' },
      overrideAccess: true,
    })

    const response = await createExportDataEndpoint(DEFAULT_SLUGS).handler!({
      payload,
      user: { ...client, collection: DEFAULT_SLUGS.supportClients },
    } as unknown as PayloadRequest)

    expect(response.status).toBe(200)
    expect(JSON.parse(await response.text()).providedByYou.chatMessages).toEqual([])
  }, 120_000)
})
