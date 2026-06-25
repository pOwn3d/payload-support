import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createVapidKeyEndpoint, createPushSubscribeEndpoint } from '../../endpoints/push'
import { sendPushToUser } from '../../utils/push'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/** Native push / browser notifications (roadmap). */
describe('push notifications (roadmap)', () => {
  it('subscribe stores a subscription row for the agent', async () => {
    const payload = await buildTestPayload()
    const admin = await payload.create({ collection: 'users', data: { email: 'push-admin@example.com', password: PW } as never, overrideAccess: true })
    const ep = createPushSubscribeEndpoint(slugs)
    const req = {
      payload,
      user: { ...admin, collection: 'users' },
      headers: new Headers({ 'user-agent': 'vitest' }),
      json: async () => ({ subscription: { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'pk', auth: 'ak' } } }),
    }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    expect(res.status).toBe(200)

    const stored = await payload.find({ collection: 'push-subscriptions', where: { endpoint: { equals: 'https://push.example.com/abc' } }, overrideAccess: true })
    expect(stored.docs.length).toBe(1)
    expect((stored.docs[0] as { auth?: string }).auth).toBe('ak')
  }, 60_000)

  it('subscribe is idempotent on endpoint (upsert, no duplicate)', async () => {
    const payload = await buildTestPayload()
    const admin = await payload.create({ collection: 'users', data: { email: 'push-admin2@example.com', password: PW } as never, overrideAccess: true })
    const ep = createPushSubscribeEndpoint(slugs)
    const mk = (auth: string) => ({
      payload,
      user: { ...admin, collection: 'users' },
      headers: new Headers({}),
      json: async () => ({ subscription: { endpoint: 'https://push.example.com/dup', keys: { p256dh: 'pk', auth } } }),
    })
    await (ep.handler as (r: unknown) => Promise<Response>)(mk('first'))
    await (ep.handler as (r: unknown) => Promise<Response>)(mk('second'))
    const stored = await payload.find({ collection: 'push-subscriptions', where: { endpoint: { equals: 'https://push.example.com/dup' } }, overrideAccess: true })
    expect(stored.docs.length).toBe(1)
    expect((stored.docs[0] as { auth?: string }).auth).toBe('second')
  }, 60_000)

  it('subscribe rejects an anonymous request', async () => {
    const payload = await buildTestPayload()
    const ep = createPushSubscribeEndpoint(slugs)
    const req = {
      payload,
      user: null,
      headers: new Headers({}),
      json: async () => ({ subscription: { endpoint: 'https://push.example.com/x', keys: { p256dh: 'pk', auth: 'ak' } } }),
    }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)
    expect(res.status).toBe(401)
  }, 60_000)

  it('vapid-public-key returns null when VAPID is not configured', async () => {
    delete process.env.VAPID_PUBLIC_KEY
    const ep = createVapidKeyEndpoint()
    const res = await (ep.handler as (r: unknown) => Promise<Response>)({})
    const json = await res.json()
    expect(json.publicKey).toBeNull()
  })

  it('sendPushToUser no-ops without VAPID keys', async () => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    const payload = await buildTestPayload()
    const result = await sendPushToUser(payload, slugs, 1, { title: 'Hi', body: 'There' })
    expect(result.sent).toBe(0)
  }, 60_000)
})
