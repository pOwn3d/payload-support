import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import {
  DEFAULT_SETTINGS,
  invalidateSupportSettingsCache,
  readSupportSettingsState,
} from '../../utils/readSettings'

const PW = 'test-pw-12345'

/**
 * Non-regression — SUP/prefs, against a REAL Payload + SQLite.
 *
 * `payload-preferences` is writable by any authenticated principal, whatever its
 * auth collection (Payload's own `POST /api/payload-preferences/:key` only checks
 * `!!req.user`). The plugin persisted its server-wide settings there and read
 * them back by KEY alone, so a support-client could plant a row and take over
 * `email.replyToAddress`, `sla.escalationEmail`, `ai.provider` and the feature
 * flags for the whole install.
 *
 * This test also pins the QUERY SHAPE: `where: { key, 'user.relationTo' }` must
 * really be understood by the SQLite adapter. If it were not, the read would
 * throw, the try/catch would swallow it, and every install would silently fall
 * back to the defaults — so the "legitimate row is still read" case below is as
 * important as the attack case.
 */
describe('support settings ownership (payload-preferences)', () => {
  beforeEach(() => invalidateSupportSettingsCache())
  afterEach(() => invalidateSupportSettingsCache())

  async function writePref(
    payload: Awaited<ReturnType<typeof buildTestPayload>>,
    user: { id: number | string; collection: string },
    value: Record<string, unknown>,
  ) {
    await payload.db.upsert({
      collection: 'payload-preferences',
      data: {
        key: 'support-settings',
        user: { relationTo: user.collection, value: user.id },
        value,
      },
      req: { payload, user } as never,
      where: {
        and: [
          { key: { equals: 'support-settings' } },
          { 'user.value': { equals: user.id } },
          { 'user.relationTo': { equals: user.collection } },
        ],
      },
    } as never)
  }

  it('reads the row owned by the staff collection and ignores the client-owned one', async () => {
    const payload = await buildTestPayload()

    const admin = await payload.create({
      collection: 'users',
      data: { email: 'settings-admin@example.com', password: PW } as never,
      overrideAccess: true,
    })
    const client = await payload.create({
      collection: 'support-clients',
      data: { email: 'settings-client@example.com', password: PW, firstName: 'S', lastName: 'C', company: 'C' },
      overrideAccess: true,
    })

    await writePref(payload, { id: admin.id, collection: 'users' }, {
      email: { fromAddress: '', fromName: 'Support', replyToAddress: 'support@acme.tld' },
    })

    // The attacker writes LAST, so `sort: '-updatedAt'` would hand them the win.
    await writePref(payload, { id: client.id, collection: 'support-clients' }, {
      email: { fromAddress: '', fromName: 'Support', replyToAddress: 'attacker@evil.tld' },
      sla: { firstResponseMinutes: 1, resolutionMinutes: 1, businessHoursOnly: false, escalationEmail: 'attacker@evil.tld' },
      ai: { provider: 'ollama', model: 'x', enableSentiment: true, enableSynthesis: true, enableSuggestion: true, enableRewrite: true },
    })

    invalidateSupportSettingsCache()
    const state = await readSupportSettingsState(payload)

    expect(state.settings.email.replyToAddress).toBe('support@acme.tld')
    expect(state.settings.sla.escalationEmail).toBe(DEFAULT_SETTINGS.sla.escalationEmail)
    expect(state.settings.ai.provider).toBe(DEFAULT_SETTINGS.ai.provider)
  }, 60_000)
})
