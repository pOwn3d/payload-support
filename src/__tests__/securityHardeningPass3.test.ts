import { beforeEach, describe, expect, it, vi } from 'vitest'

// `assertPublicHost` resolves names itself; the sandbox answers ENOTFOUND for
// everything, which the guard tolerates. Drive the resolution explicitly.
vi.mock('dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}))
import { lookup } from 'dns/promises'

import { createAuth2faEndpoint } from '../endpoints/auth-2fa'
import { createLoginEndpoint } from '../endpoints/login'
import { createPushSubscribeEndpoint } from '../endpoints/push'
import { createStatusesEndpoint } from '../endpoints/statuses'
import { sendPushToUser } from '../utils/push'
import { MemoryRateLimitStore, clientIpRateKey, normalizeIpKey } from '../utils/rateLimiter'
import { resolveSlugs } from '../utils/slugs'
import { issueTwoFactorChallenge } from '../utils/twoFactorChallenge'
import { validatePushEndpoint } from '../utils/urlSafety'

const slugs = resolveSlugs()
const PUBLIC_ADDRESSES = [{ address: '93.184.216.34', family: 4 }]

beforeEach(() => {
  vi.mocked(lookup).mockImplementation((async () => PUBLIC_ADDRESSES) as never)
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP3-01 — `POST /support/2fa {action:'verify'}` consumed a quota keyed on the
// VICTIM's email with no proof of the password step. Only `send` got that guard
// in the previous pass; `verify` is the other half of the same door, and it is
// the ONE route that clears the 2FA gate.
// ─────────────────────────────────────────────────────────────────────────────

describe('2FA code verification requires proof of the password step', () => {
  const EMAIL = 'victim@example.com'

  function twoFaPayload() {
    return {
      find: vi.fn(async () => ({ docs: [{ id: 1, email: EMAIL, firstName: 'V' }] })),
      update: vi.fn(async () => ({})),
      sendEmail: vi.fn(async () => ({})),
    }
  }

  function verifyReq(payload: ReturnType<typeof twoFaPayload>, body: Record<string, unknown>) {
    return { payload, headers: new Headers(), json: async () => body } as never
  }

  beforeEach(() => {
    process.env.PAYLOAD_SECRET = 'test-secret-2fa-pass3'
  })

  it('refuses an anonymous verification attempt on an address the caller merely knows', async () => {
    const endpoint = createAuth2faEndpoint(slugs)
    const payload = twoFaPayload()

    const res = await endpoint.handler(verifyReq(payload, { action: 'verify', email: EMAIL, code: '000000' }))

    expect(res.status).toBe(401)
    // The account is never even looked up, so no code state is touched.
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  /**
   * The finding itself: five anonymous POSTs used to exhaust `2fa:verify:<email>`
   * and the victim — right password, right code — then got 429 on the only route
   * that clears the gate, renewably, every 15 minutes.
   */
  it('does not let refused attempts lock the victim out of their own verification', async () => {
    const endpoint = createAuth2faEndpoint(slugs)
    const payload = twoFaPayload()

    for (let i = 0; i < 10; i++) {
      await endpoint.handler(verifyReq(payload, { action: 'verify', email: EMAIL, code: '000000' }))
    }

    // The legitimate owner, freshly authenticated, still gets a verdict on their code.
    const res = await endpoint.handler(verifyReq(payload, {
      action: 'verify',
      email: EMAIL,
      code: '123456',
      challenge: issueTwoFactorChallenge(EMAIL),
    }))

    expect(res.status).not.toBe(429)
    expect(payload.find).toHaveBeenCalled()
  })

  it('refuses a challenge minted for another address, expired, or forged', async () => {
    const endpoint = createAuth2faEndpoint(slugs)
    const payload = twoFaPayload()
    const attempt = (challenge: string) =>
      endpoint.handler(verifyReq(payload, { action: 'verify', email: EMAIL, code: '123456', challenge }))

    expect((await attempt(issueTwoFactorChallenge('someone-else@example.com'))).status).toBe(401)
    expect((await attempt(issueTwoFactorChallenge(EMAIL, Date.now() - 60 * 60 * 1000))).status).toBe(401)
    expect((await attempt(`${Date.now() + 60_000}.${'a'.repeat(64)}`)).status).toBe(401)
    expect(payload.find).not.toHaveBeenCalled()
  })

  /**
   * The budget is keyed on the same normalized address the challenge is signed
   * over. Signed normalized but keyed raw, one challenge bought a fresh set of
   * five attempts per casing variant of the address.
   */
  it('spends one budget per address, not one per casing variant', async () => {
    const store = new MemoryRateLimitStore()
    const endpoint = createAuth2faEndpoint(slugs, store)
    const payload = twoFaPayload()
    const challenge = issueTwoFactorChallenge(EMAIL)

    for (const casing of ['victim@example.com', 'Victim@Example.com', 'VICTIM@EXAMPLE.COM']) {
      for (let i = 0; i < 3; i++) {
        await endpoint.handler(verifyReq(payload, { action: 'verify', email: casing, code: '000000', challenge }))
      }
    }

    // 9 attempts over one address: past the 5/15min budget whatever the casing.
    const res = await endpoint.handler(verifyReq(payload, {
      action: 'verify', email: EMAIL, code: '000000', challenge,
    }))
    expect(res.status).toBe(429)
  })

  /**
   * `verifyLimiter.reset()` used to be called with no context. With
   * `rateLimitStore: 'payload'` that throws, and the throw landed AFTER the
   * marker was written: the caller saw a 500 on a verification that had in fact
   * succeeded, and never got past the login screen.
   */
  it('clears the attempt budget through the configured store, not by throwing', async () => {
    const store = {
      increment: vi.fn(async (_key: string, windowMs: number) => ({ count: 1, resetAt: Date.now() + windowMs })),
      // What PayloadRateLimitStore does when it is handed no context.
      reset: vi.fn(async (_key: string, context?: unknown) => {
        if (!context) throw new Error('PayloadRateLimitStore requires the current Payload request or instance')
      }),
    }
    const endpoint = createAuth2faEndpoint(slugs, store)

    const { createHmac } = await import('crypto')
    const storedCode = createHmac('sha256', process.env.PAYLOAD_SECRET!).update('123456').digest('hex')
    const payload = {
      find: vi.fn(async () => ({
        docs: [{
          id: 1,
          email: EMAIL,
          twoFactorCode: storedCode,
          twoFactorExpiry: new Date(Date.now() + 60_000).toISOString(),
        }],
      })),
      update: vi.fn(async () => ({})),
    }

    const res = await endpoint.handler({
      payload,
      headers: new Headers(),
      json: async () => ({ action: 'verify', email: EMAIL, code: '123456', challenge: issueTwoFactorChallenge(EMAIL) }),
    } as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ verified: true })
    // The context is REQUIRED, and the call must be awaited: unawaited, the
    // store's throw became an unhandled rejection instead of a caught error.
    expect(store.reset).toHaveBeenCalledWith(expect.stringContaining('2fa:verify'), expect.anything())
    await expect(store.reset.mock.results[0]!.value).resolves.toBeUndefined()
  })

  /**
   * `send` refreshes the proof so it lives exactly as long as the code it just
   * minted — otherwise a resend late in the window produced a valid code whose
   * challenge had already expired, and `verify` answered 401 on it. The refresh
   * is on EVERY send reply, so the shape never reveals whether the account exists.
   */
  it('refreshes the proof on send, and identically for a known and an unknown address', async () => {
    const endpoint = createAuth2faEndpoint(slugs)
    const known = twoFaPayload()
    const unknown = { ...twoFaPayload(), find: vi.fn(async () => ({ docs: [] })) }

    const knownRes = await endpoint.handler(verifyReq(known, {
      action: 'send', email: EMAIL, challenge: issueTwoFactorChallenge(EMAIL),
    }))
    const unknownRes = await endpoint.handler(verifyReq(unknown as never, {
      action: 'send', email: EMAIL, challenge: issueTwoFactorChallenge(EMAIL),
    }))

    const knownBody = await knownRes.json()
    const unknownBody = await unknownRes.json()
    expect(typeof knownBody.challenge).toBe('string')
    expect(Object.keys(knownBody).sort()).toEqual(Object.keys(unknownBody).sort())

    // And the refreshed proof is accepted by verify.
    const res = await endpoint.handler(verifyReq(known, {
      action: 'verify', email: EMAIL, code: '000000', challenge: knownBody.challenge,
    }))
    expect(res.status).not.toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP3-02 — the rate-limit key was the raw `x-forwarded-for` header, written
// into a Map with no ceiling, no expiry sweep and no eviction. One anonymous
// curl loop rotating that header grew the process until it died.
// ─────────────────────────────────────────────────────────────────────────────

describe('rate-limit keys are bounded in size and in number', () => {
  it('refuses to turn a forged header into an unbounded key', () => {
    expect(normalizeIpKey('A'.repeat(8000))).toBe('unknown')
    expect(normalizeIpKey('not-an-ip')).toBe('unknown')
    expect(normalizeIpKey('999.1.1.1')).toBe('unknown')
    expect(normalizeIpKey('')).toBe('unknown')
    // Legitimate literals still key on themselves — the limiter keeps working.
    expect(normalizeIpKey('203.0.113.7')).toBe('203.0.113.7')
    expect(normalizeIpKey('2001:db8::1')).toBe('2001:db8::1')
    expect(normalizeIpKey('[2001:db8::1]')).toBe('2001:db8::1')
  })

  it('reads the client IP off the request without trusting its length', () => {
    const long = new Headers({ 'x-forwarded-for': `${'9'.repeat(4000)}, 10.0.0.1` })
    expect(clientIpRateKey({ headers: long })).toBe('unknown')

    const normal = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    expect(clientIpRateKey({ headers: normal })).toBe('203.0.113.7')

    const real = new Headers({ 'x-real-ip': '198.51.100.4' })
    expect(clientIpRateKey({ headers: real })).toBe('198.51.100.4')
  })

  /** The end-to-end version: the flood used to mint one permanent entry per header value. */
  it('does not grow the store one permanent entry per forged header', async () => {
    const store = new MemoryRateLimitStore()
    const login = createLoginEndpoint(slugs, store)

    for (let i = 0; i < 300; i++) {
      await login.handler({
        headers: new Headers({ 'x-forwarded-for': `${'x'.repeat(500)}-${i}` }),
        json: async () => ({ email: 'someone@example.com', password: 'pw' }),
        payload: {
          login: vi.fn(async () => { throw new Error('Invalid credentials') }),
          create: vi.fn(async () => ({})),
        },
      } as never)
    }

    // 300 distinct forged values, all malformed: one shared bucket, not 300.
    expect(store.size).toBe(1)
  })

  it('keeps a hard ceiling even on well-formed keys', async () => {
    const store = new MemoryRateLimitStore(50)
    for (let i = 0; i < 500; i++) {
      await store.increment(`login:203.0.113.${i % 256}-${i}`, 60_000)
    }
    expect(store.size).toBeLessThanOrEqual(50)
  })

  it('reclaims closed windows before evicting a live one', async () => {
    const store = new MemoryRateLimitStore(3)
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    await store.increment('a', 1_000)
    await store.increment('b', 1_000)
    await store.increment('c', 1_000)
    expect(store.size).toBe(3)

    vi.spyOn(Date, 'now').mockReturnValue(now + 5_000) // every window closed
    const entry = await store.increment('d', 1_000)
    vi.mocked(Date.now).mockRestore()

    expect(entry.count).toBe(1)
    expect(store.size).toBe(1) // swept, not evicted one-by-one
  })

  it('truncates the user-agent it persists on a failed anonymous login', async () => {
    type LogArgs = { data: { success: boolean; userAgent: string; ipAddress: string } }
    const create = vi.fn(async (_args: LogArgs) => ({}))
    const login = createLoginEndpoint(slugs)
    await login.handler({
      headers: new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'U'.repeat(9000) }),
      json: async () => ({ email: 'someone@example.com', password: 'pw' }),
      payload: { login: vi.fn(async () => { throw new Error('Invalid credentials') }), create },
    } as never)

    const logged = create.mock.calls.find(([args]) => args?.data?.success === false)?.[0]
    expect(logged).toBeDefined()
    expect(logged!.data.userAgent.length).toBeLessThanOrEqual(256)
    expect(logged!.data.ipAddress).toBe('203.0.113.9')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP3-03 — `GET /support/statuses` stopped at `!!req.user` and then read with
// `overrideAccess: true`, serving the support workflow taxonomy to a principal
// that `ticket-statuses.access.read` refuses.
// ─────────────────────────────────────────────────────────────────────────────

describe('the statuses endpoint mirrors the collection ACL', () => {
  const rows = [{ id: 1, name: 'Escalated', slug: 'escalated', color: '#f00', type: 'open', isDefault: false, sortOrder: 3 }]
  const statusPayload = () => ({ find: vi.fn(async () => ({ docs: rows })) })

  function get(user: unknown, payload: ReturnType<typeof statusPayload>) {
    return createStatusesEndpoint(slugs).handler({ payload, user, headers: new Headers() } as never)
  }

  it('refuses a principal from an auth collection unrelated to the plugin', async () => {
    const payload = statusPayload()
    const res = await get({ id: 9, collection: 'front-office-members' }, payload)

    expect(res.status).toBe(403)
    // Refused before the read, so `overrideAccess` never gets a chance to leak.
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('still refuses an anonymous caller with 401', async () => {
    expect((await get(null, statusPayload())).status).toBe(401)
  })

  it('still serves staff and support-clients — the two the ACL grants', async () => {
    for (const collection of [slugs.users, slugs.supportClients]) {
      const res = await get({ id: 1, collection }, statusPayload())
      expect(res.status).toBe(200)
      expect((await res.json()).statuses).toHaveLength(1)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP3-04 — `POST /support/push/subscribe` took any URL as a push endpoint.
// `web-push` hands its host and port to `https.request` with no allowlist, so a
// staff account could aim outbound requests at any internal service — the exact
// actor `utils/urlSafety` already models as hostile for webhook URLs.
// ─────────────────────────────────────────────────────────────────────────────

describe('push subscription endpoints go through the SSRF guard', () => {
  const staff = { id: 4, collection: slugs.users }

  function subscribeReq(endpoint: string, payload: unknown) {
    return {
      payload,
      user: staff,
      headers: new Headers(),
      json: async () => ({ subscription: { endpoint, keys: { p256dh: 'pk', auth: 'ak' } } }),
    } as never
  }

  it('rejects private, loopback, link-local and non-https targets at write time', async () => {
    const ep = createPushSubscribeEndpoint(slugs)
    const payload = { find: vi.fn(async () => ({ docs: [] })), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) }

    for (const target of [
      'https://127.0.0.1:8443/push',
      'https://10.0.0.5:8443/push',
      'https://169.254.169.254/latest/meta-data/',
      'https://192.168.1.10/push',
      'https://[::1]:8443/push',
      'https://localhost/push',
      'http://push.example.com/abc',
      'file:///etc/passwd',
      'not-a-url',
    ]) {
      const res = await ep.handler(subscribeReq(target, payload))
      expect(res.status, target).toBe(400)
    }
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('still accepts a real push service endpoint', async () => {
    const ep = createPushSubscribeEndpoint(slugs)
    const payload = { find: vi.fn(async () => ({ docs: [] })), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) }

    const res = await ep.handler(subscribeReq('https://fcm.googleapis.com/fcm/send/abc123', payload))

    expect(res.status).toBe(200)
    expect(payload.create).toHaveBeenCalled()
  })

  it('caps the length of the value it persists', () => {
    expect(validatePushEndpoint(`https://push.example.com/${'a'.repeat(4000)}`).ok).toBe(false)
    expect(validatePushEndpoint('https://push.example.com/abc').ok).toBe(true)
  })

  /**
   * Second layer: rows written before this guard existed, and names whose DNS
   * record is flipped to a private address after the row was accepted.
   */
  it('refuses to send to a row already in the database that points at a private host', async () => {
    process.env.VAPID_PUBLIC_KEY = 'BJ_test_public_key'
    process.env.VAPID_PRIVATE_KEY = 'test_private_key'
    const sendNotification = vi.fn(async () => ({}))
    vi.doMock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }))
    vi.resetModules()
    const { sendPushToUser: freshSend } = await import('../utils/push')

    const payload = {
      find: vi.fn(async () => ({
        docs: [{ id: 1, endpoint: 'https://10.0.0.5:8443/push', p256dh: 'pk', auth: 'ak' }],
      })),
      delete: vi.fn(async () => ({})),
    }

    const result = await freshSend(payload as never, slugs, 4, { title: 'x', body: 'y' })

    expect(result.sent).toBe(0)
    expect(sendNotification).not.toHaveBeenCalled()
    // Skipped, not pruned: a guard refusal must not delete a subscription.
    expect(payload.delete).not.toHaveBeenCalled()
    vi.doUnmock('web-push')
    vi.resetModules()
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
  })

  it('refuses a public NAME that resolves to a private address', async () => {
    vi.mocked(lookup).mockImplementation((async () => [{ address: '10.0.0.5', family: 4 }]) as never)
    process.env.VAPID_PUBLIC_KEY = 'BJ_test_public_key'
    process.env.VAPID_PRIVATE_KEY = 'test_private_key'
    const sendNotification = vi.fn(async () => ({}))
    vi.doMock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }))
    vi.resetModules()
    const { sendPushToUser: freshSend } = await import('../utils/push')

    const payload = {
      find: vi.fn(async () => ({
        docs: [{ id: 1, endpoint: 'https://rebind.example.com/push', p256dh: 'pk', auth: 'ak' }],
      })),
      delete: vi.fn(async () => ({})),
    }

    const result = await freshSend(payload as never, slugs, 4, { title: 'x', body: 'y' })

    expect(result.sent).toBe(0)
    expect(sendNotification).not.toHaveBeenCalled()
    vi.doUnmock('web-push')
    vi.resetModules()
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
  })

  it('is exported and no-ops without VAPID keys, as before', async () => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    const payload = { find: vi.fn(async () => ({ docs: [] })) }
    expect((await sendPushToUser(payload as never, slugs, 1, { title: 'a', body: 'b' })).sent).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP3-05 — the declared Payload peer range allowed versions vulnerable to
// GHSA-hp5w-3hxx-vmwf (pre-auth account takeover) and to a SQL injection, and
// claimed a compatibility nobody had ever built or tested.
// ─────────────────────────────────────────────────────────────────────────────

describe('the declared Payload peer range', () => {
  it('floors payload above the pre-auth account-takeover advisory', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'))

    for (const name of ['payload', '@payloadcms/next']) {
      const range: string = pkg.peerDependencies[name]
      const floor = range.replace(/^[^0-9]*/, '').split(' ')[0]
      const [major, minor] = floor.split('.').map(Number)
      expect(major, `${name} → ${range}`).toBe(3)
      // 3.79.1 is the advisory floor; the range must not sit below it.
      expect(minor, `${name} → ${range}`).toBeGreaterThanOrEqual(79)
    }
  })
})
