import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { dispatchWebhook } from '../../utils/webhookDispatcher'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs()

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Non-regression — SUP/webhook-ssrf, against a REAL Payload + SQLite.
 *
 * The SSRF guard first shipped as a field-level `validate` on `url`. Payload
 * re-validates the MERGED document on every write, so that guard also ran on
 * partial updates that never mention `url`: a row saved before the guard existed
 * (or by an integrator's own seed through `payload.db`) became TOTALLY immutable
 * — it could not even be deactivated — and the dispatcher's bookkeeping write
 * (`lastStatus: 0`) failed inside a `catch {}` that swallows the error, so the
 * operator saw nothing at all on a dead endpoint.
 *
 * Both sides are pinned here: the legacy row must stay editable, AND a private /
 * loopback / non-https target must still be refused whenever the URL is actually
 * written, and must still never be fetched.
 */
describe('webhook endpoint URL guard', () => {
  /** Plants a row the guard would refuse today — `db.create` runs no hooks. */
  async function seedLegacyRow(
    payload: Awaited<ReturnType<typeof buildTestPayload>>,
    url: string,
  ): Promise<number | string> {
    const row = (await payload.db.create({
      collection: slugs.webhookEndpoints as never,
      data: {
        name: 'legacy',
        url,
        events: ['ticket_created'],
        active: true,
      },
      req: { payload } as never,
    })) as { id: number | string }
    return row.id
  }

  it('still lets an operator edit and deactivate a row whose URL is no longer accepted', async () => {
    const payload = await buildTestPayload()
    const id = await seedLegacyRow(payload, 'http://127.0.0.1:8080/hook')

    // Renaming, re-scoping the events and deactivating are all partial updates
    // that leave `url` untouched — none of them may be rejected.
    const renamed = (await payload.update({
      collection: slugs.webhookEndpoints as never,
      id,
      data: { name: 'legacy (à corriger)', events: ['ticket_resolved'], active: false } as never,
      overrideAccess: true,
    })) as unknown as { name: string; active: boolean; url: string }

    expect(renamed.name).toBe('legacy (à corriger)')
    expect(renamed.active).toBe(false)
    expect(renamed.url).toBe('http://127.0.0.1:8080/hook')
  }, 60_000)

  it('records the failed delivery on a legacy row instead of silently swallowing it', async () => {
    const payload = await buildTestPayload()
    const id = await seedLegacyRow(payload, 'http://127.0.0.1:9999/internal')

    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await dispatchWebhook({ ticketId: 1 }, 'ticket_created', payload as never, slugs)

    const after = (await payload.findByID({
      collection: slugs.webhookEndpoints as never,
      id,
      overrideAccess: true,
    })) as { lastStatus?: number | null; lastTriggeredAt?: string | null }

    // The SSRF guard held: the loopback target was never contacted…
    expect(fetchMock).not.toHaveBeenCalled()
    // …and the operator can SEE the endpoint is dead from the admin.
    expect(after.lastStatus).toBe(0)
    expect(after.lastTriggeredAt).toBeTruthy()
  }, 60_000)

  it('still refuses a private, loopback or non-https URL at creation', async () => {
    const payload = await buildTestPayload()

    for (const url of [
      'http://127.0.0.1:8080/hook',
      'https://169.254.169.254/latest/meta-data/',
      'https://10.0.0.5/hook',
      'file:///etc/passwd',
      'not-a-url',
    ]) {
      await expect(
        payload.create({
          collection: slugs.webhookEndpoints as never,
          data: { name: 'evil', url, events: ['ticket_created'], active: true } as never,
          overrideAccess: true,
        }),
        url,
      ).rejects.toBeTruthy()
    }
  }, 60_000)

  it('still refuses REPOINTING an existing row at an internal target', async () => {
    const payload = await buildTestPayload()

    const ok = await payload.create({
      collection: slugs.webhookEndpoints as never,
      data: { name: 'public', url: 'https://hooks.example.tld/a', events: ['ticket_created'], active: true } as never,
      overrideAccess: true,
    })

    await expect(
      payload.update({
        collection: slugs.webhookEndpoints as never,
        id: (ok as { id: number | string }).id,
        data: { url: 'http://169.254.169.254/latest/meta-data/' } as never,
        overrideAccess: true,
      }),
    ).rejects.toBeTruthy()

    // …including from a legacy row, which must not become a free pass.
    const legacyId = await seedLegacyRow(payload, 'http://127.0.0.1:8080/hook')
    await expect(
      payload.update({
        collection: slugs.webhookEndpoints as never,
        id: legacyId,
        data: { url: 'https://192.168.1.10/hook' } as never,
        overrideAccess: true,
      }),
    ).rejects.toBeTruthy()
  }, 60_000)
})
