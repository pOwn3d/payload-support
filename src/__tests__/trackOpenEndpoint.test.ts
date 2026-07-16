import { describe, expect, it, vi } from 'vitest'
import { createTrackOpenEndpoint, generateTrackingToken } from '../endpoints/track-open'
import { resolveSlugs } from '../utils/slugs'

const secret = 'test-payload-secret'

function createRequest(ticketId: string, messageId: string, signature: string) {
  const findByID = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'ticket-messages') {
      return { id: Number(messageId), ticket: Number(ticketId) + 1, emailOpenedAt: null }
    }
    return { id: Number(ticketId), lastClientReadAt: null }
  })
  const update = vi.fn()
  return {
    req: {
      url: `https://example.test/api/support/track-open?t=${ticketId}&m=${messageId}&sig=${signature}`,
      payload: { findByID, update },
    },
    findByID,
    update,
  }
}

describe('track-open endpoint', () => {
  it('does not query the database for signed non-numeric identifiers', async () => {
    process.env.PAYLOAD_SECRET = secret
    const ticketId = 'not-a-ticket'
    const messageId = 'not-a-message'
    const signature = generateTrackingToken(ticketId, messageId, secret)
    const { req, findByID, update } = createRequest(ticketId, messageId, signature)
    const endpoint = createTrackOpenEndpoint(resolveSlugs())

    const response = await endpoint.handler(req as never)

    expect(response.status).toBe(200)
    expect(findByID).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not mutate when the signed message belongs to another ticket', async () => {
    process.env.PAYLOAD_SECRET = secret
    const ticketId = '10'
    const messageId = '20'
    const signature = generateTrackingToken(ticketId, messageId, secret)
    const { req, update } = createRequest(ticketId, messageId, signature)
    const endpoint = createTrackOpenEndpoint(resolveSlugs())

    const response = await endpoint.handler(req as never)

    expect(response.status).toBe(200)
    expect(update).not.toHaveBeenCalled()
  })
})
