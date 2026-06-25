import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'

const PW = 'test-pw-12345'

/**
 * Validates the server-side 2FA enforcement (P0-2): the beforeLogin hook must
 * block login when 2FA is enabled without a fresh verification marker, allow it
 * with one, and consume the marker (single-use) so it can't be replayed.
 */
describe('2FA enforcement (P0-2)', () => {
  it('blocks login without a fresh marker, allows with one, then consumes it', async () => {
    const payload = await buildTestPayload()

    const c = await payload.create({
      collection: 'support-clients',
      data: { email: '2fa@example.com', password: PW, firstName: 'T', lastName: 'F', company: 'C', twoFactorEnabled: true },
      overrideAccess: true,
    })

    // No marker → blocked even with the correct password.
    await expect(
      payload.login({ collection: 'support-clients', data: { email: '2fa@example.com', password: PW } }),
    ).rejects.toThrow(/2FA_REQUIRED/)

    // Fresh marker → login succeeds.
    await payload.update({ collection: 'support-clients', id: c.id, data: { twoFactorVerifiedAt: new Date().toISOString() }, overrideAccess: true })
    const ok = await payload.login({ collection: 'support-clients', data: { email: '2fa@example.com', password: PW } })
    expect(ok.token).toBeTruthy()

    // Marker is single-use → the next login is blocked again.
    await expect(
      payload.login({ collection: 'support-clients', data: { email: '2fa@example.com', password: PW } }),
    ).rejects.toThrow(/2FA_REQUIRED/)
  }, 60_000)

  it('lets a non-2FA client log in normally', async () => {
    const payload = await buildTestPayload()
    await payload.create({ collection: 'support-clients', data: { email: 'no2fa@example.com', password: PW, firstName: 'N', lastName: 'O', company: 'C' }, overrideAccess: true })
    const ok = await payload.login({ collection: 'support-clients', data: { email: 'no2fa@example.com', password: PW } })
    expect(ok.token).toBeTruthy()
  }, 60_000)
})
