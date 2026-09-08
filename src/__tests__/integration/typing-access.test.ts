import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import {
  __resetTypingStateForTests,
  createTypingGetEndpoint,
  createTypingPostEndpoint,
} from '../../endpoints/typing'
import { resolveSlugs } from '../../utils/slugs'

const PW = 'test-pw-12345'
const slugs = resolveSlugs()

/**
 * Non-regression — SUP2-02, against a REAL Payload + SQLite.
 *
 * `/support/typing` only asked for *a* session: any authenticated principal
 * could write an entry for any ticket id (unbounded, caller-shaped keys), and
 * read back the first name of the agent typing on any ticket.
 *
 * The guard delegates to the `tickets` collection access rules rather than
 * reimplementing ownership — this test pins that the delegation really enforces
 * anything: `findByID` with `overrideAccess: false` + `user` must refuse a
 * ticket the caller does not own. If Payload ever returned the doc anyway, the
 * unit tests (which mock the payload) would keep passing and this one would not.
 */
describe('typing endpoint ticket scope', () => {
  it('refuses a support-client signalling on someone else\'s ticket', async () => {
    __resetTypingStateForTests()
    const payload = await buildTestPayload()

    const owner = await payload.create({
      collection: 'support-clients',
      data: { email: 'typing-owner@example.com', password: PW, firstName: 'Own', lastName: 'Er', company: 'O' },
      overrideAccess: true,
    })
    const stranger = await payload.create({
      collection: 'support-clients',
      data: { email: 'typing-stranger@example.com', password: PW, firstName: 'Str', lastName: 'Anger', company: 'S' },
      overrideAccess: true,
    })
    const ticket = await payload.create({
      collection: 'tickets',
      data: { subject: 'Typing ticket', client: owner.id, status: 'open', priority: 'normal' },
      overrideAccess: true,
    })

    const post = createTypingPostEndpoint(slugs).handler
    const get = createTypingGetEndpoint(slugs).handler
    const asUser = (user: Record<string, unknown>, collection: string) => ({ ...user, collection })

    // The stranger is refused…
    const refused = await post({
      user: asUser(stranger, 'support-clients'),
      payload,
      json: async () => ({ ticketId: ticket.id }),
    } as never)
    expect(refused.status).toBe(403)

    // …and the owner is not.
    const accepted = await post({
      user: asUser(owner, 'support-clients'),
      payload,
      json: async () => ({ ticketId: ticket.id }),
    } as never)
    expect(accepted.status).toBe(200)

    // The stranger cannot read the state back either — same body as an idle
    // ticket, so nothing leaks and no existence oracle is offered.
    const peeked = await get({
      user: asUser(stranger, 'support-clients'),
      payload,
      url: `https://acme.tld/api/support/typing?ticketId=${ticket.id}`,
    } as never)
    expect(await peeked.json()).toEqual({ typing: false, name: null })

    // An agent on the same ticket does see it.
    const agent = await payload.create({
      collection: 'users',
      data: { email: 'typing-agent@example.com', password: PW } as never,
      overrideAccess: true,
    })
    const seen = await get({
      user: asUser(agent, 'users'),
      payload,
      url: `https://acme.tld/api/support/typing?ticketId=${ticket.id}`,
    } as never)
    expect(await seen.json()).toEqual({ typing: true, name: 'Own' })

    __resetTypingStateForTests()
  }, 60_000)
})
