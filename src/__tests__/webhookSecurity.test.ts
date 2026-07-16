import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INBOUND_EMAIL_LIMITS,
  validateInboundEmailPayload,
  verifySecret,
} from '../utils/webhookSecurity'
import { createProcessDigestsEndpoint } from '../endpoints/process-digests'
import { resolveSlugs } from '../utils/slugs'

describe('verifySecret', () => {
  it('accepts an exact secret and rejects missing, malformed or different values', () => {
    expect(verifySecret('expected-secret', 'expected-secret')).toBe(true)
    expect(verifySecret(undefined, 'expected-secret')).toBe(false)
    expect(verifySecret('short', 'expected-secret')).toBe(false)
    expect(verifySecret('different-secret', 'expected-secret')).toBe(false)
  })
})

describe('cron endpoint authentication', () => {
  it('rejects missing, forged and query-string secrets', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    const endpoint = createProcessDigestsEndpoint(resolveSlugs())
    for (const request of [
      { headers: new Headers(), url: 'http://localhost/api/support/process-digests' },
      { headers: new Headers({ 'x-cron-secret': 'forged' }), url: 'http://localhost/api/support/process-digests' },
      { headers: new Headers(), url: 'http://localhost/api/support/process-digests?secret=expected-secret' },
    ]) {
      const response = await endpoint.handler(request as never)
      expect(response.status).toBe(401)
    }
  })
})

describe('inbound email limits', () => {
  const base = { senderEmail: 'client@example.com', subject: 'Help', body: 'Hello' }

  it('rejects requests larger than 25 MiB', () => {
    expect(validateInboundEmailPayload(base, DEFAULT_INBOUND_EMAIL_LIMITS.maxRequestBytes + 1))
      .toEqual({ code: 'request_too_large', status: 413 })
  })

  it('rejects more than 10 attachments', () => {
    const attachments = Array.from({ length: 11 }, (_, index) => ({ filename: `${index}.txt`, size: 1 }))
    expect(validateInboundEmailPayload({ ...base, attachments }))
      .toEqual({ code: 'too_many_attachments', status: 413 })
  })

  it('rejects an attachment larger than 10 MiB', () => {
    const attachments = [{ filename: 'large.zip', size: DEFAULT_INBOUND_EMAIL_LIMITS.maxAttachmentBytes + 1 }]
    expect(validateInboundEmailPayload({ ...base, attachments }))
      .toEqual({ code: 'attachment_too_large', status: 413 })
  })

  it('rejects oversized text fields', () => {
    expect(validateInboundEmailPayload({ ...base, subject: 'x'.repeat(1_001) }))
      .toEqual({ code: 'text_field_too_large', status: 413 })
  })
})
