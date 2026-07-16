import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoginEndpoint } from '../endpoints/login'
import { createOAuthGoogleEndpoint } from '../endpoints/oauth-google'
import { resolveSlugs } from '../utils/slugs'

const slugs = resolveSlugs()

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
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client'
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-secret'
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.test'
    process.env.PAYLOAD_SECRET = 'payload-secret'

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'google-token' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'google-id',
        email: 'client@example.com',
        verified_email: true,
      })))

    const endpoint = createOAuthGoogleEndpoint(slugs)
    const response = await endpoint.handler({
      json: async () => ({ code: 'code', state: 'state', cookieState: 'state' }),
      payload: {
        collections: {
          [slugs.supportClients]: {
            config: { auth: { tokenExpiration: 7200 }, fields: [] },
          },
        },
        find: vi.fn(async () => ({
          docs: [{ id: 1, email: 'client@example.com' }],
          totalDocs: 1,
        })),
      },
    } as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/^payload-token=/)
    const body = await response.json() as Record<string, unknown>
    expect(body).not.toHaveProperty('token')
    expect(body).toHaveProperty('user')
  })
})
