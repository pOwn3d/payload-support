import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { createChatMessagesCollection } from '../collections/ChatMessages'
import { createChatbotEndpoint } from '../endpoints/chatbot'
import { createEmailStatsEndpoint } from '../endpoints/email-stats'
import { createTransferTicketEndpoint } from '../endpoints/transfer-ticket'
import { renderPlainMessageBody, safeHttpUrl } from '../portal/auth/tickets/detail/MessageBody'
import {
  DEFAULT_SETTINGS,
  invalidateSupportSettingsCache,
  readSupportSettingsState,
  readUserPrefs,
} from '../utils/readSettings'
import { resolveSlugs } from '../utils/slugs'
import { resolveAccessibleTicketIds } from '../utils/ticketAccess'
import { dispatchWebhook } from '../utils/webhookDispatcher'
import {
  BlockedRequestError,
  isBlockedHost,
  safeFetch,
  validateWebhookUrl,
} from '../utils/urlSafety'

const slugs = resolveSlugs()

/**
 * Non-regression suite for the confirmed security findings.
 * Each block names the door it keeps shut; deleting a test re-opens it silently.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SUP/prefs — plugin settings poisoned through an unscoped payload-preferences row
// ─────────────────────────────────────────────────────────────────────────────

interface PrefRow { key: string; relationTo: string; value: unknown }

/** Fake Payload honouring BOTH the `key` and the `user.relationTo` clause. */
function prefsPayload(rows: PrefRow[]): Payload {
  return {
    config: { admin: { user: 'users' } },
    find: vi.fn(async ({ where }: any) => {
      const key = where?.key?.equals
      const relationTo = where?.['user.relationTo']?.equals
      const docs = rows
        // No relationTo clause at all = the vulnerable query; the fake returns
        // every row so the assertion below actually fails if the clause is lost.
        .filter((r) => r.key === key && (relationTo === undefined || r.relationTo === relationTo))
        .map((r) => ({ value: r.value }))
      return { docs }
    }),
  } as unknown as Payload
}

describe('payload-preferences reads are scoped to the staff auth collection', () => {
  beforeEach(() => invalidateSupportSettingsCache())
  afterEach(() => {
    invalidateSupportSettingsCache()
    // `vi.spyOn` on an already-spied method hands back the SAME mock, call
    // history included — restore between tests or the warn assertions below
    // observe each other's calls.
    vi.restoreAllMocks()
  })

  it('ignores a support-settings row planted by a non-staff principal', async () => {
    // `POST /api/payload-preferences/support-settings` only requires *a* session:
    // a support-client (or any other auth collection of the host app) can write it.
    const state = await readSupportSettingsState(prefsPayload([
      {
        key: 'support-settings',
        relationTo: 'support-clients',
        value: {
          email: { replyToAddress: 'attacker@evil.tld', fromName: 'Support' },
          sla: { escalationEmail: 'attacker@evil.tld' },
        },
      },
    ]))

    expect(state.settings.email.replyToAddress).toBe(DEFAULT_SETTINGS.email.replyToAddress)
    expect(state.settings.sla.escalationEmail).toBe(DEFAULT_SETTINGS.sla.escalationEmail)
  })

  it('still reads the row written by the staff collection', async () => {
    const state = await readSupportSettingsState(prefsPayload([
      { key: 'support-settings', relationTo: 'users', value: { email: { replyToAddress: 'support@acme.tld' } } },
    ]))
    expect(state.settings.email.replyToAddress).toBe('support@acme.tld')
  })

  it('ignores a legacy round-robin row planted by a non-staff principal', async () => {
    const state = await readSupportSettingsState(prefsPayload([
      { key: 'support-settings', relationTo: 'users', value: { email: {} } },
      { key: 'support-round-robin', relationTo: 'support-clients', value: { enabled: true } },
    ]))
    expect(state.settings.features.roundRobin).toBe(false)
  })

  /**
   * The scope is the right call, but it fails SILENTLY: a row that is not
   * staff-owned — a poisoning attempt, or an install whose staff collection is
   * not `config.admin.user` — leaves the whole plugin on its defaults with the
   * `try/catch` swallowing any signal. The operator must at least be told.
   */
  it('warns when a settings row exists but none is staff-owned', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const state = await readSupportSettingsState(prefsPayload([
      { key: 'support-settings', relationTo: 'support-clients', value: { email: { replyToAddress: 'attacker@evil.tld' } } },
    ]))

    expect(state.settings.email.replyToAddress).toBe(DEFAULT_SETTINGS.email.replyToAddress)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('support-settings')
  })

  it('stays quiet on a fresh install with no preference row at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await readSupportSettingsState(prefsPayload([]))
    expect(warn).not.toHaveBeenCalled()
  })

  it('ignores a support-user-prefs row owned by a colliding id in another collection', async () => {
    // Ids collide across auth collections: support-client #7 must not own the
    // signature/locale read back for agent #7.
    const prefs = await readUserPrefs(
      prefsPayload([
        { key: 'support-user-prefs-7', relationTo: 'support-clients', value: { locale: 'en', signature: 'INJECTED' } },
      ]),
      7,
    )
    expect(prefs.signature).toBe('')
    expect(prefs.locale).toBe('fr')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP/portal-xss — [code:N](url) injected into an href without quote escaping
// ─────────────────────────────────────────────────────────────────────────────

describe('portal plain-text message rendering', () => {
  it('never emits raw HTML for a quote-breaking link payload', () => {
    const payload = '[code:1](https://a"/onmouseover="alert(1))'
    const nodes = renderPlainMessageBody(payload)

    // Whatever it decides to render, nothing may carry an event handler.
    for (const node of nodes) {
      if (React.isValidElement(node)) {
        const props = node.props as Record<string, unknown>
        expect(Object.keys(props).some((k) => k.toLowerCase().startsWith('on'))).toBe(false)
        // href, if any, stays a plain http(s) URL — React escapes the attribute.
        if (typeof props.href === 'string') {
          expect(props.href.startsWith('https://') || props.href.startsWith('http://')).toBe(true)
        }
      }
    }
  })

  it('renders angle brackets and quotes as text, not as markup', () => {
    const nodes = renderPlainMessageBody('<img src=x onerror=alert(1)> "quoted"')
    expect(nodes).toEqual(['<img src=x onerror=alert(1)> "quoted"'])
    expect(React.isValidElement(nodes[0])).toBe(false)
  })

  it('still linkifies a legitimate shared-code marker', () => {
    const nodes = renderPlainMessageBody('avant [code:12](https://acme.tld/code/12) apres')
    expect(nodes[0]).toBe('avant ')
    expect(React.isValidElement(nodes[1])).toBe(true)
    expect((nodes[1] as React.ReactElement<{ href: string }>).props.href).toBe('https://acme.tld/code/12')
    expect(nodes[2]).toBe(' apres')
  })

  it('rejects non-http schemes', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,<script>')).toBeNull()
    expect(safeHttpUrl('https://acme.tld/x')).toBe('https://acme.tld/x')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP/chat-write — chat-messages create was open to any authenticated principal
// ─────────────────────────────────────────────────────────────────────────────

describe('chat-messages write guard', () => {
  const chat = createChatMessagesCollection(slugs)
  const createAccess = chat.access!.create as (args: any) => unknown
  const beforeChange = chat.hooks!.beforeChange![0] as (args: any) => any

  /**
   * `sessionOwner`: which client already owns the target session — `undefined`
   * for a session that does not exist yet.
   */
  function chatReq(user: { id: number; collection: string }, sessionOwner?: number) {
    return {
      user,
      payload: {
        find: vi.fn(async () => ({
          docs: sessionOwner === undefined ? [] : [{ client: sessionOwner }],
        })),
      },
    }
  }

  it('refuses a create from an auth collection unrelated to the support plugin', () => {
    expect(createAccess({ req: { user: { id: 1, collection: 'front-office-members' } } })).toBe(false)
    expect(createAccess({ req: { user: null } })).toBe(false)
  })

  it('still lets staff and support-clients create', () => {
    expect(createAccess({ req: { user: { id: 1, collection: slugs.users } } })).toBe(true)
    expect(createAccess({ req: { user: { id: 1, collection: slugs.supportClients } } })).toBe(true)
  })

  it('forces the client identity and refuses an agent impersonation', async () => {
    const data = await beforeChange({
      data: { session: 'chat_x', client: 999, senderType: 'agent', agent: 42, message: 'Cliquez ici' },
      req: chatReq({ id: 7, collection: slugs.supportClients }),
      operation: 'create',
    })
    expect(data.client).toBe(7)
    expect(data.senderType).toBe('client')
    expect(data.agent).toBeUndefined()
  })

  it('leaves a staff write untouched', async () => {
    const data = await beforeChange({
      data: { session: 'chat_x', client: 999, senderType: 'agent', agent: 42, message: 'hi' },
      req: chatReq({ id: 1, collection: slugs.users }, 999),
      operation: 'create',
    })
    expect(data.client).toBe(999)
    expect(data.senderType).toBe('agent')
    expect(data.agent).toBe(42)
  })

  // Forcing `client` alone still left the SESSION free: the agent console loads a
  // thread by session id with `overrideAccess: true`, so a message dropped into
  // someone else's session is displayed there as part of their conversation.
  it('refuses a message injected into a session owned by another client', async () => {
    await expect(
      beforeChange({
        data: { session: 'chat_victim', message: 'Cliquez ici pour valider votre facture' },
        req: chatReq({ id: 7, collection: slugs.supportClients }, 999),
        operation: 'create',
      }),
    ).rejects.toThrow()
  })

  it('still accepts a client writing in their own session, or opening a new one', async () => {
    const own = await beforeChange({
      data: { session: 'chat_mine', message: 'bonjour' },
      req: chatReq({ id: 7, collection: slugs.supportClients }, 7),
      operation: 'create',
    })
    expect(own.client).toBe(7)

    const fresh = await beforeChange({
      data: { session: 'chat_new', message: 'bonjour' },
      req: chatReq({ id: 7, collection: slugs.supportClients }),
      operation: 'create',
    })
    expect(fresh.client).toBe(7)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP/chatbot-budget — per-IP key is spoofable, the AI bill must stay bounded
// ─────────────────────────────────────────────────────────────────────────────

describe('chatbot global budget ceiling', () => {
  const find = vi.fn(async () => ({ docs: [] }))

  function chatbotReq(ip: string) {
    return {
      headers: new Headers({ 'x-forwarded-for': ip }),
      json: async () => ({ question: 'comment reinitialiser mon mot de passe ?' }),
      payload: { find },
    } as never
  }

  it('stops spending the AI budget once the hourly ceiling is reached, whatever the claimed IP', async () => {
    find.mockClear()
    const endpoint = createChatbotEndpoint(slugs, undefined, 2)

    // Two accepted calls, each from a freshly forged X-Forwarded-For.
    expect((await endpoint.handler(chatbotReq('1.2.3.4'))).status).toBe(200)
    expect((await endpoint.handler(chatbotReq('5.6.7.8'))).status).toBe(200)
    expect(find).toHaveBeenCalledTimes(2)

    // Rotating the header no longer buys a new window: the request is served
    // from the deflection path and never reaches the knowledge base — hence
    // never the Anthropic call that follows it.
    const overBudget = await endpoint.handler(chatbotReq('9.9.9.9'))
    const body = await overBudget.json()
    expect(body.answer).toBeNull()
    expect(body.aiUnavailable).toBe(true)
    expect(find).toHaveBeenCalledTimes(2)
  })

  /**
   * The ceiling is deliberately keyed on nothing, so it is shared by every
   * visitor: answering 429 would have handed any anonymous caller a switch to
   * turn the chatbot off for the whole portal. Over budget it must DEGRADE —
   * a 200 pointing at the ticket form, the same shape as an empty KB.
   */
  it('degrades instead of denying service to everyone else', async () => {
    find.mockClear()
    const endpoint = createChatbotEndpoint(slugs, undefined, 1)
    await endpoint.handler(chatbotReq('1.1.1.1'))

    const victim = await endpoint.handler(chatbotReq('2.2.2.2'))
    expect(victim.status).toBe(200)
    const body = await victim.json()
    expect(body.suggestion).toBe('create_ticket')
    expect(typeof body.message).toBe('string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP/collab-viewer — the `viewer` role was never read back
// ─────────────────────────────────────────────────────────────────────────────

describe('collaborator role is enforced on the write scope', () => {
  function payloadWithCollab(role: string | undefined): Payload {
    return {
      find: vi.fn(async ({ collection }: any) => {
        if (collection === 'ticket-collaborators') {
          return { docs: [{ ticket: 77, ...(role ? { role } : {}) }] }
        }
        return { docs: [] } // owns nothing
      }),
    } as unknown as Payload
  }

  it('grants read but not write to a viewer', async () => {
    const p = payloadWithCollab('viewer')
    expect(await resolveAccessibleTicketIds(p, slugs, 5)).toEqual([77])
    expect(await resolveAccessibleTicketIds(p, slugs, 5, 'write')).toEqual([])
  })

  it('treats a row with no explicit role as read-only', async () => {
    const p = payloadWithCollab(undefined)
    expect(await resolveAccessibleTicketIds(p, slugs, 5, 'write')).toEqual([])
  })

  it('grants write to an actual collaborator', async () => {
    const p = payloadWithCollab('collaborator')
    expect(await resolveAccessibleTicketIds(p, slugs, 5, 'write')).toEqual([77])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP/email-stats — documented "Admin-only" but guarded by `!!req.user`
// ─────────────────────────────────────────────────────────────────────────────

describe('email-stats is staff-only', () => {
  function statsReq(user: unknown) {
    return {
      url: 'https://acme.tld/api/support/email-stats?days=365',
      user,
      payload: {
        find: vi.fn(async () => ({ docs: [], hasNextPage: false })),
      },
    } as never
  }

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await createEmailStatsEndpoint(slugs).handler(statsReq(null))
    expect(res.status).toBe(401)
  })

  it('rejects a support-client with 403 instead of serving the aggregate', async () => {
    const req = statsReq({ id: 3, collection: slugs.supportClients })
    const res = await createEmailStatsEndpoint(slugs).handler(req)
    expect(res.status).toBe(403)
    // The 25 000-row pagination loop never even started.
    expect((req as any).payload.find).not.toHaveBeenCalled()
  })

  it('rejects a user of an unrelated auth collection with 403', async () => {
    const res = await createEmailStatsEndpoint(slugs).handler(statsReq({ id: 4, collection: 'front-office-members' }))
    expect(res.status).toBe(403)
  })

  it('still serves staff', async () => {
    const res = await createEmailStatsEndpoint(slugs).handler(statsReq({ id: 1, collection: slugs.users }))
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP/webhook-ssrf — user-controlled URL fetched by the server
// ─────────────────────────────────────────────────────────────────────────────

describe('outbound URL safety', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('blocks loopback, private, link-local and IPv4-mapped IPv6 literals', () => {
    for (const host of [
      '127.0.0.1', 'localhost', '10.0.0.1', '172.16.0.1', '192.168.1.1',
      '169.254.169.254', '0.0.0.0', '::1', '::ffff:10.0.0.1', 'fd00::1',
      'fe80::1', 'redis.internal', 'printer.local',
    ]) {
      expect(isBlockedHost(host), host).toBe(true)
    }
  })

  it('allows a normal public host', () => {
    expect(isBlockedHost('hooks.slack.com')).toBe(false)
    expect(isBlockedHost('93.184.216.34')).toBe(false)
  })

  it('refuses non-https schemes and private targets at write time', () => {
    expect(validateWebhookUrl('http://hooks.slack.com/x').ok).toBe(false)
    expect(validateWebhookUrl('file:///etc/passwd').ok).toBe(false)
    expect(validateWebhookUrl('https://169.254.169.254/latest/meta-data/').reason).toBe('private_host')
    expect(validateWebhookUrl('https://127.0.0.1:8080/hook').reason).toBe('private_host')
    expect(validateWebhookUrl('https://hooks.slack.com/services/x').ok).toBe(true)
  })

  it('does not follow a redirect into the private range', async () => {
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetch('https://hook.example/one', { method: 'POST' }))
      .rejects.toBeInstanceOf(BlockedRequestError)

    // Exactly one hop was made — the metadata endpoint was never contacted.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe('manual')
  })

  it('never POSTs a webhook configured on an internal address', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const update = vi.fn(async () => ({}))
    const payload = {
      find: vi.fn(async () => ({ docs: [{ id: 1, url: 'http://127.0.0.1:8080/admin', name: 'internal' }] })),
      update,
    } as never

    await dispatchWebhook({ ticketId: 1 }, 'ticket_created', payload, slugs)

    expect(fetchMock).not.toHaveBeenCalled()
    // The failure is still recorded, so the operator sees the endpoint is dead.
    expect(update).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUP/transfer-mailer — both quotas were per TICKET, and tickets are free
// ─────────────────────────────────────────────────────────────────────────────

describe('ticket transfer is bounded per user, not only per ticket', () => {
  const CLIENT = { id: 42, collection: slugs.supportClients, email: 'client@acme.tld' }

  function transferReq(ticketId: number, user: Record<string, unknown> = CLIENT) {
    const sendEmail = vi.fn(async () => ({}))
    return {
      req: {
        user,
        routeParams: { id: String(ticketId) },
        headers: new Headers(),
        json: async () => ({ email: 'victim@target.tld', message: 'phishing' }),
        payload: {
          sendEmail,
          findByID: vi.fn(async () => ({
            id: ticketId,
            client: { id: user.id },
            ticketNumber: `TK-${ticketId}`,
            subject: 'sujet',
            status: 'open',
          })),
          count: vi.fn(async () => ({ totalDocs: 0 })),
          find: vi.fn(async () => ({ docs: [] })),
          create: vi.fn(async () => ({})),
        },
      },
      sendEmail,
    }
  }

  beforeEach(() => invalidateSupportSettingsCache())
  afterEach(() => invalidateSupportSettingsCache())

  it('stops a client who rotates the ticket id to reset the per-ticket window', async () => {
    const endpoint = createTransferTicketEndpoint(slugs)

    // 15 accepted transfers, each on a brand-new ticket — the per-ticket quota
    // (5) never fires because the ticket id changes every time.
    for (let i = 1; i <= 15; i++) {
      const { req } = transferReq(i)
      const res = await endpoint.handler(req as never)
      expect(res.status, `transfer #${i}`).toBe(200)
    }

    const { req, sendEmail } = transferReq(999)
    const blocked = await endpoint.handler(req as never)
    expect(blocked.status).toBe(429)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does not apply the per-user ceiling to staff', async () => {
    const endpoint = createTransferTicketEndpoint(slugs)
    const admin = { id: 1, collection: slugs.users, email: 'agent@acme.tld' }

    for (let i = 1; i <= 20; i++) {
      const { req } = transferReq(1000 + i, admin)
      const res = await endpoint.handler(req as never)
      expect(res.status, `admin transfer #${i}`).toBe(200)
    }
  })
})
