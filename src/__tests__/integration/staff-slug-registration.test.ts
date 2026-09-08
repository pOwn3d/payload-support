import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { SUPPORT_STAFF_SLUG_CONFIG_KEY, resolveStaffPrefSlug } from '../../utils/readSettings'

/**
 * Non-regression — SUP2-01, against a REAL Payload config pipeline.
 *
 * The `payload-preferences` reads are scoped to the staff collection; that scope
 * used to be derived from `config.admin.user`, which Payload fills in itself
 * with the FIRST auth collection of the host app. The plugin now publishes the
 * slug it actually enforces on writes (`slugs.users`) under `config.custom`.
 *
 * The whole fix rests on that value surviving `buildConfig`'s sanitisation and
 * reaching `payload.config` at runtime — a unit test against a fake `payload`
 * object cannot prove it, so this one boots the real thing.
 */
describe('staff collection registration', () => {
  it('reaches payload.config and drives the preference scope', async () => {
    const payload = await buildTestPayload()

    const custom = (payload.config as unknown as { custom?: Record<string, unknown> }).custom
    expect(custom?.[SUPPORT_STAFF_SLUG_CONFIG_KEY]).toBe('users')
    expect(resolveStaffPrefSlug(payload)).toBe('users')
  }, 60_000)
})
