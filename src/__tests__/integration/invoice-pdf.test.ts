import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { createInvoiceEndpoint } from '../../endpoints/invoice'
import { resolveSlugs } from '../../utils/slugs'

const slugs = resolveSlugs({ users: 'users' })
const PW = 'test-pw-12345'

/** Native binary PDF invoice (roadmap): `format=pdf` returns a real PDF document. */
describe('binary PDF invoice (roadmap)', () => {
  it('returns an application/pdf document with the %PDF header', async () => {
    const payload = await buildTestPayload()
    const c = await payload.create({ collection: 'support-clients', data: { email: 'pdf@example.com', password: PW, firstName: 'P', lastName: 'D', company: 'ACME Corp' }, overrideAccess: true })
    await payload.create({ collection: 'tickets', data: { subject: 'pdf-a', client: c.id, status: 'resolved', priority: 'normal', billable: true, billedAmount: 100 }, overrideAccess: true })
    await payload.create({ collection: 'tickets', data: { subject: 'pdf-b', client: c.id, status: 'resolved', priority: 'normal', billable: true, billedAmount: 50 }, overrideAccess: true })

    const admin = await payload.create({ collection: 'users', data: { email: 'pdf-admin@example.com', password: PW } as never, overrideAccess: true })
    const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const ep = createInvoiceEndpoint(slugs)
    const req = { payload, user: { ...admin, collection: 'users' }, url: `http://localhost/api/support/billing/invoice?from=${from}&to=${to}&format=pdf`, headers: new Headers({}) }
    const res = await (ep.handler as (r: unknown) => Promise<Response>)(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/application\/pdf/)
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(buf.length).toBeGreaterThan(500)
  }, 60_000)
})
