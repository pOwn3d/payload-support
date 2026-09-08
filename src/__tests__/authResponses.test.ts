import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoginEndpoint } from '../endpoints/login'
import { OAUTH_STATE_COOKIE, createOAuthGoogleEndpoint } from '../endpoints/oauth-google'
import { resolveSlugs } from '../utils/slugs'
import { verifyTwoFactorChallenge } from '../utils/twoFactorChallenge'

const slugs = resolveSlugs()

function stubGoogleEnv() {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client'
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-secret'
  process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.test'
  process.env.PAYLOAD_SECRET = 'payload-secret'
}

/** Token exchange + userinfo, in the order the endpoint calls them. */
function stubGoogleExchange() {
  return vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'google-token' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'google-id',
      email: 'client@example.com',
      verified_email: true,
    })))
}

function oauthCallbackReq(args: {
  cookie: string
  body: Record<string, unknown>
  client?: Record<string, unknown>
  update?: () => Promise<unknown>
}) {
  const client = args.client ?? { id: 1, email: 'client@example.com' }
  return {
    headers: new Headers(args.cookie ? { cookie: args.cookie } : {}),
    json: async () => args.body,
    payload: {
      collections: {
        [slugs.supportClients]: {
          config: { auth: { tokenExpiration: 7200 }, fields: [] },
        },
      },
      find: vi.fn(async () => ({ docs: [client], totalDocs: 1 })),
      findByID: vi.fn(async () => client),
      update: args.update ?? vi.fn(async () => ({})),
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('authentication responses', () => {
  it('keeps the login JWT exclusively in the HttpOnly cookie', async () => {
    const endpoint = createLoginEndpoint(slugs)
    const response = await endpoint.handler({
      headers: new Headers(),
      json: async () => ({ email: 'client@example.com', password: 'secret' }),
      payload: {
        login: vi.fn(async () => ({ token: 'jwt-secret', exp: 123, user: { id: 1 } })),
        create: vi.fn(async () => ({})),
      },
    } as never)

    expect(response.headers.get('set-cookie')).toContain('payload-token=jwt-secret')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    await expect(response.json()).resolves.toEqual({
      message: 'Login successful',
      user: { id: 1 },
      exp: 123,
    })
  })

  it('keeps the OAuth JWT exclusively in the HttpOnly cookie', async () => {
    stubGoogleEnv()
    stubGoogleExchange()

    const endpoint = createOAuthGoogleEndpoint(slugs)
    const response = await endpoint.handler(oauthCallbackReq({
      cookie: `${OAUTH_STATE_COOKIE}=state`,
      body: { code: 'code', state: 'state' },
    }) as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/^payload-token=/)
    const body = await response.json() as Record<string, unknown>
    expect(body).not.toHaveProperty('token')
    expect(body).toHaveProperty('user')

    // The state cookie is single-use: expired on the response that consumed it,
    // instead of staying replayable for the rest of its 10 minutes.
    const cookies = response.headers.getSetCookie()
    expect(cookies).toContainEqual(expect.stringContaining(`${OAUTH_STATE_COOKIE}=;`))
    expect(cookies.find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))).toContain('Max-Age=0')
  })

  /**
   * Non-regression — SUP/oauth-state.
   * The CSRF check used to compare `state` with a `cookieState` ALSO read from
   * the JSON body: any non-browser caller passed it by sending the same string
   * twice. The state must now come from the request's own Cookie header.
   */
  it('rejects an OAuth callback whose state only exists in the request body', async () => {
    stubGoogleEnv()
    const fetchSpy = stubGoogleExchange()

    const endpoint = createOAuthGoogleEndpoint(slugs)
    const response = await endpoint.handler(oauthCallbackReq({
      cookie: '',
      // The historical bypass: state === cookieState, both attacker-supplied.
      body: { code: 'code', state: 'forged', cookieState: 'forged' },
    }) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'state_mismatch' })
    // The code was never exchanged with Google.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects an OAuth callback whose state does not match the issued cookie', async () => {
    stubGoogleEnv()
    stubGoogleExchange()

    const endpoint = createOAuthGoogleEndpoint(slugs)
    const response = await endpoint.handler(oauthCallbackReq({
      cookie: `${OAUTH_STATE_COOKIE}=issued-state`,
      body: { code: 'code', state: 'other-state' },
    }) as never)

    expect(response.status).toBe(400)
  })

  it('issues the OAuth state as an HttpOnly cookie at the login step', async () => {
    stubGoogleEnv()
    const endpoint = createOAuthGoogleEndpoint(slugs)
    const response = await endpoint.handler({
      headers: new Headers(),
      json: async () => ({ action: 'login' }),
      payload: {},
    } as never)

    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).toMatch(new RegExp(`^${OAUTH_STATE_COOKIE}=`))
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  /**
   * Non-regression — SUP/oauth-2fa.
   * The OAuth path forges its session with jwtSign instead of payload.login, so
   * the `beforeLogin` 2FA hook never runs: "Sign in with Google" was a full
   * bypass of a second factor the client had switched on.
   */
  it('does not mint a session over Google OAuth when 2FA is pending', async () => {
    stubGoogleEnv()
    stubGoogleExchange()

    const endpoint = createOAuthGoogleEndpoint(slugs)
    const response = await endpoint.handler(oauthCallbackReq({
      cookie: `${OAUTH_STATE_COOKIE}=state`,
      body: { code: 'code', state: 'state' },
      client: { id: 1, email: 'client@example.com', twoFactorEnabled: true, twoFactorVerifiedAt: null },
    }) as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.requires2FA).toBe(true)
    // Google proved the identity, so the client gets the short-lived proof that
    // `POST /support/2fa {action:'send'}` now demands — and it is a real
    // signature for THIS address, not a decorative flag.
    expect(verifyTwoFactorChallenge('client@example.com', body.challenge)).toBe(true)
    expect(verifyTwoFactorChallenge('someone-else@example.com', body.challenge)).toBe(false)
    expect(Object.keys(body).sort()).toEqual(['challenge', 'requires2FA'])
    // No session is handed out…
    const cookies = response.headers.getSetCookie()
    expect(cookies.some((c) => c.startsWith('payload-token='))).toBe(false)
    // …and the consumed state is expired rather than left replayable.
    expect(cookies).toContainEqual(expect.stringContaining(`${OAUTH_STATE_COOKIE}=;`))
    expect(cookies).toContainEqual(expect.stringContaining('Max-Age=0'))
  })

  it('mints the session over Google OAuth once 2FA was verified in the window', async () => {
    stubGoogleEnv()
    stubGoogleExchange()

    const update = vi.fn(async () => ({}))
    const endpoint = createOAuthGoogleEndpoint(slugs)
    const response = await endpoint.handler(oauthCallbackReq({
      cookie: `${OAUTH_STATE_COOKIE}=state`,
      body: { code: 'code', state: 'state' },
      client: {
        id: 1,
        email: 'client@example.com',
        twoFactorEnabled: true,
        twoFactorVerifiedAt: new Date().toISOString(),
      },
      update,
    }) as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/^payload-token=/)
    // Single-use: the verified marker is consumed.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { twoFactorVerifiedAt: null } }),
    )
  })
})
