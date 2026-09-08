import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import type { Config } from 'payload'
import type { Payload } from 'payload'

// The SEND-time SSRF guard resolves the name itself; the tests below drive that
// resolution instead of the sandbox's, which answers ENOTFOUND for everything.
vi.mock('dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}))
import { lookup } from 'dns/promises'

import { supportPlugin } from '../plugin'
import { createAuth2faEndpoint } from '../endpoints/auth-2fa'
import { createChatbotEndpoint } from '../endpoints/chatbot'
import { createLoginEndpoint } from '../endpoints/login'
import {
  __resetTypingStateForTests,
  __typingStateSizeForTests,
  createTypingGetEndpoint,
  createTypingPostEndpoint,
} from '../endpoints/typing'
import { createClientSummariesCollection } from '../collections/ClientSummaries'
import {
  DEFAULT_SETTINGS,
  SUPPORT_STAFF_SLUG_CONFIG_KEY,
  invalidateSupportSettingsCache,
  readSupportSettingsState,
} from '../utils/readSettings'
import { MemoryRateLimitStore, RateLimiter, principalRateKey } from '../utils/rateLimiter'
import { resolveSlugs } from '../utils/slugs'
import { issueTwoFactorChallenge, verifyTwoFactorChallenge } from '../utils/twoFactorChallenge'
import { assertPublicHost, safeFetch, BlockedRequestError } from '../utils/urlSafety'

const slugs = resolveSlugs()
const PUBLIC_ADDRESSES = [{ address: '93.184.216.34', family: 4 }]

beforeEach(() => {
  // `mockRestore` elsewhere in the suite strips the factory implementation.
  vi.mocked(lookup).mockImplementation((async () => PUBLIC_ADDRESSES) as never)
})

/**
 * Non-regression suite for the SECOND security pass — the findings that survived
 * (or were introduced by) the first round of fixes. Each block names the door it
 * keeps shut; deleting a test re-opens it silently.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SUP2-01 — the staff scope of payload-preferences reads came from
// `config.admin.user` while the writes came from `slugs.users`: two sources of
// truth for one notion, and the settings-poisoning hole reopens when they differ
// ─────────────────────────────────────────────────────────────────────────────

interface PrefRow { key: string; relationTo: string; value: unknown }

function prefsPayload(rows: PrefRow[], config: Record<string, unknown>): Payload {
  return {
    config,
    find: vi.fn(async ({ where }: any) => {
      const key = where?.key?.equals
      const relationTo = where?.['user.relationTo']?.equals
      return {
        docs: rows
          .filter((r) => r.key === key && (relationTo === undefined || r.relationTo === relationTo))
          .map((r) => ({ value: r.value })),
      }
    }),
  } as unknown as Payload
}

describe('the staff preference scope follows the configured collection', () => {
  beforeEach(() => invalidateSupportSettingsCache())
  afterEach(() => invalidateSupportSettingsCache())

  it('publishes the resolved staff collection on config.custom', () => {
    const built = supportPlugin({ userCollectionSlug: 'agents', skipViews: true })(
      { collections: [] } as unknown as Config,
    ) as Config
    expect(built.custom?.[SUPPORT_STAFF_SLUG_CONFIG_KEY]).toBe('agents')
  })

  it('keeps the host app custom keys untouched', () => {
    const built = supportPlugin({ skipViews: true })(
      { collections: [], custom: { hostKey: 1 } } as unknown as Config,
    ) as Config
    expect(built.custom?.hostKey).toBe(1)
    expect(built.custom?.[SUPPORT_STAFF_SLUG_CONFIG_KEY]).toBe('users')
  })

  /**
   * Payload defaults `admin.user` to the FIRST auth collection of the host app.
   * On an app whose front office comes first, the read scope named `members`
   * while `requireAdmin` (the write scope) named `agents`: a front-office user
   * could plant the row the whole plugin then read.
   */
  it('ignores a row owned by admin.user when the staff collection is another one', async () => {
    const state = await readSupportSettingsState(prefsPayload(
      [
        { key: 'support-settings', relationTo: 'members', value: { email: { replyToAddress: 'attacker@evil.tld' }, sla: { escalationEmail: 'attacker@evil.tld' } } },
        { key: 'support-settings', relationTo: 'agents', value: { email: { replyToAddress: 'support@acme.tld' } } },
      ],
      { admin: { user: 'members' }, custom: { [SUPPORT_STAFF_SLUG_CONFIG_KEY]: 'agents' } },
    ))

    expect(state.settings.email.replyToAddress).toBe('support@acme.tld')
    expect(state.settings.sla.escalationEmail).toBe(DEFAULT_SETTINGS.sla.escalationEmail)
  })

  it('reads the staff row even when admin.user points elsewhere entirely', async () => {
    const state = await readSupportSettingsState(prefsPayload(
      [{ key: 'support-settings', relationTo: 'agents', value: { ai: { provider: 'ollama' } } }],
      { admin: { user: 'members' }, custom: { [SUPPORT_STAFF_SLUG_CONFIG_KEY]: 'agents' } },
    ))
    // Without the fix this row was invisible and the plugin silently ran on the
    // defaults — AI and auto-close back on, whatever the operator had saved.
    expect(state.settings.ai.provider).toBe('ollama')
  })

  it('falls back to admin.user only when nothing was registered', async () => {
    const state = await readSupportSettingsState(prefsPayload(
      [{ key: 'support-settings', relationTo: 'users', value: { email: { replyToAddress: 'legacy@acme.tld' } } }],
      { admin: { user: 'users' } },
    ))
    expect(state.settings.email.replyToAddress).toBe('legacy@acme.tld')
  })

  it('caches per scope instead of serving one install its neighbour settings', async () => {
    const first = await readSupportSettingsState(prefsPayload(
      [{ key: 'support-settings', relationTo: 'agents', value: { email: { replyToAddress: 'a@acme.tld' } } }],
      { custom: { [SUPPORT_STAFF_SLUG_CONFIG_KEY]: 'agents' } },
    ))
    const second = await readSupportSettingsState(prefsPayload(
      [{ key: 'support-settings', relationTo: 'staff', value: { email: { replyToAddress: 'b@acme.tld' } } }],
      { custom: { [SUPPORT_STAFF_SLUG_CONFIG_KEY]: 'staff' } },
    ))
    expect(first.settings.email.replyToAddress).toBe('a@acme.tld')
    expect(second.settings.email.replyToAddress).toBe('b@acme.tld')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP2-02 — /support/typing: unbounded Map, caller-chosen key, "any session" guard
// ─────────────────────────────────────────────────────────────────────────────

describe('typing endpoint', () => {
  const post = createTypingPostEndpoint(slugs).handler
  const get = createTypingGetEndpoint(slugs).handler

  /** `readable`: the ticket ids this principal may read, per the tickets access rules. */
  function typingPayload(readable: Array<string | number>) {
    return {
      findByID: vi.fn(async ({ id }: any) => {
        if (readable.map(String).includes(String(id))) return { id }
        throw new Error('Forbidden')
      }),
    }
  }

  function postReq(user: Record<string, unknown> | null, ticketId: unknown, readable: Array<string | number> = []) {
    return {
      user,
      payload: typingPayload(readable),
      json: async () => ({ ticketId }),
    } as never
  }

  function getReq(user: Record<string, unknown> | null, ticketId: string, readable: Array<string | number> = []) {
    return {
      user,
      payload: typingPayload(readable),
      url: `https://acme.tld/api/support/typing?ticketId=${ticketId}`,
    } as never
  }

  beforeEach(() => __resetTypingStateForTests())

  it('refuses a principal from an auth collection unrelated to the plugin', async () => {
    const res = await post(postReq({ id: 1, collection: 'front-office-members' }, 42, [42]))
    expect(res.status).toBe(403)
    expect(__typingStateSizeForTests()).toBe(0)
  })

  it('refuses a support-client signalling on a ticket that is not theirs', async () => {
    const res = await post(postReq({ id: 7, collection: slugs.supportClients }, 42, [1, 2]))
    expect(res.status).toBe(403)
    expect(__typingStateSizeForTests()).toBe(0)
  })

  it('refuses a key that is not shaped like a ticket id, without touching the store', async () => {
    for (const bogus of ['x'.repeat(1024), '../../etc', '', null, { a: 1 }]) {
      const req = postReq({ id: 1, collection: slugs.users }, bogus, [])
      const res = await post(req)
      expect(res.status).toBe(400)
      // Rejected on shape alone: no ticket read, no entry created.
      expect((req as any).payload.findByID).not.toHaveBeenCalled()
    }
    expect(__typingStateSizeForTests()).toBe(0)
  })

  it('still lets the owner and the agent signal on their ticket', async () => {
    expect((await post(postReq({ id: 7, collection: slugs.supportClients, firstName: 'Cli' }, 42, [42]))).status).toBe(200)
    const seenByAgent = await (await get(getReq({ id: 1, collection: slugs.users }, '42', [42]))).json()
    expect(seenByAgent).toEqual({ typing: true, name: 'Cli' })

    expect((await post(postReq({ id: 1, collection: slugs.users, firstName: 'Ada' }, 42, [42]))).status).toBe(200)
    const seenByClient = await (await get(getReq({ id: 7, collection: slugs.supportClients }, '42', [42]))).json()
    expect(seenByClient).toEqual({ typing: true, name: 'Ada' })
  })

  it('never discloses the agent name on a ticket the caller cannot read', async () => {
    await post(postReq({ id: 1, collection: slugs.users, firstName: 'Ada' }, 42, [42]))

    for (const intruder of [
      { id: 9, collection: slugs.supportClients },
      { id: 9, collection: 'front-office-members' },
    ]) {
      const body = await (await get(getReq(intruder, '42', [7]))).json()
      // Same body as an idle ticket: no name, and no existence oracle either.
      expect(body).toEqual({ typing: false, name: null })
    }
  })

  it('stays bounded when a caller signals on hundreds of tickets', async () => {
    const ids = Array.from({ length: 900 }, (_, i) => i + 1)
    for (const id of ids) {
      await post(postReq({ id: 1, collection: slugs.users, firstName: 'Ada' }, id, ids))
    }
    expect(__typingStateSizeForTests()).toBeLessThanOrEqual(500)
  })

  it('rejects an unauthenticated caller on both verbs', async () => {
    expect((await post(postReq(null, 42, [42]))).status).toBe(401)
    expect((await get(getReq(null, '42', [42]))).status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP2-03 — `POST /support/2fa {action:'send'}` consumed a quota keyed on the
// VICTIM's email, with no proof the password step ever happened
// ─────────────────────────────────────────────────────────────────────────────

describe('2FA code sending requires proof of the password step', () => {
  const EMAIL = 'victim@example.com'

  function twoFaPayload() {
    return {
      find: vi.fn(async () => ({ docs: [{ id: 1, email: EMAIL, firstName: 'V' }] })),
      update: vi.fn(async () => ({})),
      sendEmail: vi.fn(async () => ({})),
    }
  }

  function sendReq(payload: ReturnType<typeof twoFaPayload>, body: Record<string, unknown>) {
    return { payload, headers: new Headers(), json: async () => body } as never
  }

  beforeEach(() => {
    process.env.PAYLOAD_SECRET = 'test-secret-2fa'
  })

  it('refuses to send a code to an address supplied by an anonymous caller', async () => {
    const endpoint = createAuth2faEndpoint(slugs)
    const payload = twoFaPayload()

    const res = await endpoint.handler(sendReq(payload, { action: 'send', email: EMAIL }))

    expect(res.status).toBe(401)
    expect(payload.sendEmail).not.toHaveBeenCalled()
    // The code already in the victim's inbox is not overwritten either.
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('does not let the refused attempts eat the victim quota', async () => {
    const endpoint = createAuth2faEndpoint(slugs)
    const payload = twoFaPayload()

    // Ten anonymous attempts — more than the 3/hour budget.
    for (let i = 0; i < 10; i++) {
      await endpoint.handler(sendReq(payload, { action: 'send', email: EMAIL }))
    }

    // The legitimate owner, freshly authenticated, still receives their code.
    const res = await endpoint.handler(sendReq(payload, {
      action: 'send',
      email: EMAIL,
      challenge: issueTwoFactorChallenge(EMAIL),
    }))
    expect(res.status).toBe(200)
    expect(payload.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('refuses a challenge minted for another address, or an expired one', async () => {
    const endpoint = createAuth2faEndpoint(slugs)
    const payload = twoFaPayload()

    const foreign = issueTwoFactorChallenge('someone-else@example.com')
    expect((await endpoint.handler(sendReq(payload, { action: 'send', email: EMAIL, challenge: foreign }))).status).toBe(401)

    const expired = issueTwoFactorChallenge(EMAIL, Date.now() - 60 * 60 * 1000)
    expect((await endpoint.handler(sendReq(payload, { action: 'send', email: EMAIL, challenge: expired }))).status).toBe(401)

    // And a forged signature over a valid-looking expiry.
    const forged = `${Date.now() + 60_000}.${'a'.repeat(64)}`
    expect((await endpoint.handler(sendReq(payload, { action: 'send', email: EMAIL, challenge: forged }))).status).toBe(401)

    expect(payload.sendEmail).not.toHaveBeenCalled()
  })

  it('mints a usable challenge when the password was right but 2FA is pending', async () => {
    const login = createLoginEndpoint(slugs)
    const res = await login.handler({
      headers: new Headers(),
      json: async () => ({ email: EMAIL, password: 'pw' }),
      payload: {
        login: vi.fn(async () => { throw new Error('2FA_REQUIRED') }),
        create: vi.fn(async () => ({})),
      },
    } as never)

    const body = await res.json()
    expect(body.requires2FA).toBe(true)
    expect(verifyTwoFactorChallenge(EMAIL, body.challenge)).toBe(true)
  })

  it('never hands a challenge to a caller whose password was wrong', async () => {
    const login = createLoginEndpoint(slugs)
    const res = await login.handler({
      headers: new Headers(),
      json: async () => ({ email: EMAIL, password: 'wrong' }),
      payload: {
        login: vi.fn(async () => { throw new Error('Invalid credentials') }),
        create: vi.fn(async () => ({})),
      },
    } as never)

    expect(res.status).toBe(401)
    expect(JSON.stringify(await res.json())).not.toContain('challenge')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP2-04 — the SEND-time DNS guard was fail-OPEN on error and on its own timeout
// ─────────────────────────────────────────────────────────────────────────────

describe('assertPublicHost fails closed', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('blocks when the resolver errors temporarily', async () => {
    vi.mocked(lookup).mockRejectedValue(Object.assign(new Error('try again'), { code: 'EAI_AGAIN' }) as never)
    expect(await assertPublicHost('rebind.evil.tld')).toBe(false)
  })

  it('blocks on an empty answer — [].every() must not read as "all public"', async () => {
    vi.mocked(lookup).mockImplementation((async () => []) as never)
    expect(await assertPublicHost('rebind.evil.tld')).toBe(false)
  })

  it('blocks when the resolution outruns the deadline', async () => {
    vi.useFakeTimers()
    vi.mocked(lookup).mockImplementation((() => new Promise(() => {})) as never)

    const verdict = assertPublicHost('slow.evil.tld')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await verdict).toBe(false)
  })

  it('still blocks a name resolving into the private range', async () => {
    vi.mocked(lookup).mockImplementation((async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]) as never)
    expect(await assertPublicHost('rebind.evil.tld')).toBe(false)
  })

  it('lets a genuinely public name through', async () => {
    expect(await assertPublicHost('hooks.slack.com')).toBe(true)
  })

  it('tolerates only a definitive "no such host"', async () => {
    vi.mocked(lookup).mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOTFOUND' }) as never)
    // Nothing for `fetch` to reach either, so blocking would only swap one
    // failure message for another.
    expect(await assertPublicHost('does-not-exist.invalid')).toBe(true)
  })

  it('never connects when the resolution could not be verified', async () => {
    vi.useFakeTimers()
    vi.mocked(lookup).mockImplementation((() => new Promise(() => {})) as never)
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    // The rejection is captured up front: attaching the handler only after the
    // timers ran would surface as an unhandled rejection.
    const call = safeFetch('https://slow.evil.tld/hook', { method: 'POST' }).then(
      () => null,
      (err: unknown) => err,
    )
    await vi.advanceTimersByTimeAsync(10_000)

    expect(await call).toBeInstanceOf(BlockedRequestError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP2-06 — client-summaries compared against the literal 'users' slug
// ─────────────────────────────────────────────────────────────────────────────

describe('collection access never hardcodes an auth collection slug', () => {
  const custom = resolveSlugs({ users: 'agents', supportClients: 'portal-clients' })

  it('gives client-summaries to the configured staff collection, and only to it', async () => {
    const collection = createClientSummariesCollection(custom)
    for (const verb of ['create', 'read', 'update', 'delete'] as const) {
      const access = collection.access![verb] as (args: any) => unknown
      expect(await access({ req: { user: { id: 1, collection: 'agents' } } }), verb).toBe(true)
      // `users` is the DEFAULT slug — here it is the host app's front office.
      expect(await access({ req: { user: { id: 2, collection: 'users' } } }), verb).toBe(false)
      expect(await access({ req: { user: null } }), verb).toBe(false)
    }
  })

  /**
   * The same slip will come back on the next collection, so sweep them all:
   * with the staff collection renamed, NO support collection may grant anything
   * to a principal of the literal `users` collection.
   */
  it('grants nothing to the literal "users" collection when the staff slug is renamed', async () => {
    const built = supportPlugin({
      userCollectionSlug: 'agents',
      collectionSlugs: { supportClients: 'portal-clients' },
      skipViews: true,
      features: { chat: true, pendingEmails: true },
    })({ collections: [] } as unknown as Config) as Config

    const req = { user: { id: 1, collection: 'users' }, payload: { find: async () => ({ docs: [] }) } }
    for (const collection of built.collections || []) {
      for (const verb of ['create', 'read', 'update', 'delete'] as const) {
        const access = collection.access?.[verb]
        if (typeof access !== 'function') continue
        let verdict: unknown
        try {
          verdict = await access({ req } as never)
        } catch {
          verdict = false // throwing is denying
        }
        expect(verdict, `${collection.slug}.${verb}`).not.toBe(true)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP2-07 — one shared store, raw keys: `ip` and `String(user.id)` were reused
// by unrelated endpoints, and by different auth collections
// ─────────────────────────────────────────────────────────────────────────────

describe('rate-limit keys are namespaced per endpoint and per principal', () => {
  it('keeps two endpoints sharing a store from sharing a counter', async () => {
    const store = new MemoryRateLimitStore()
    const login = new RateLimiter(15 * 60_000, 1, store, 'login')
    const chatbot = new RateLimiter(60_000, 1, store, 'chatbot:ip')

    expect(await chatbot.check('203.0.113.7')).toBe(false)
    expect(await chatbot.check('203.0.113.7')).toBe(true) // chatbot budget spent
    expect(await login.check('203.0.113.7')).toBe(false) // login budget intact
  })

  it('does not let a support-client spend an agent budget through a colliding id', () => {
    expect(principalRateKey({ id: 7, collection: 'support-clients' }))
      .not.toBe(principalRateKey({ id: 7, collection: 'users' }))
    expect(principalRateKey(null)).toBe('anonymous')
  })

  /** The end-to-end version of the collision: forged chatbot traffic locked a victim out of the portal. */
  it('does not lock the portal login of an IP flooded through the chatbot', async () => {
    const store = new MemoryRateLimitStore()
    const chatbot = createChatbotEndpoint(slugs, store)
    const login = createLoginEndpoint(slugs, store)
    const VICTIM_IP = '198.51.100.4'

    for (let i = 0; i < 15; i++) {
      await chatbot.handler({
        headers: new Headers({ 'x-forwarded-for': VICTIM_IP }),
        json: async () => ({ question: 'comment reinitialiser mon mot de passe ?' }),
        payload: { find: vi.fn(async () => ({ docs: [] })) },
      } as never)
    }

    const res = await login.handler({
      headers: new Headers({ 'x-forwarded-for': VICTIM_IP }),
      json: async () => ({ email: 'victim@example.com', password: 'pw' }),
      payload: {
        login: vi.fn(async () => { throw new Error('Invalid credentials') }),
        create: vi.fn(async () => ({})),
      },
    } as never)

    // 401 (wrong password), not 429 (someone else's budget).
    expect(res.status).toBe(401)
  })

  it('gives every limiter in the codebase a namespace', () => {
    const dir = join(__dirname, '..', 'endpoints')
    const offenders: string[] = []
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      readFileSync(join(dir, file), 'utf8').split('\n').forEach((line, i) => {
        if (!line.includes('new RateLimiter(')) return
        // 4th argument, a string literal: `new RateLimiter(win, max, store, 'ns')`
        if (!/new RateLimiter\(.*,\s*'[^']+'\s*\)/.test(line)) offenders.push(`${file}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
