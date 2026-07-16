import type { Config, Field } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { supportPlugin } from '../plugin'

function fieldNames(fields: Field[]): string[] {
  return fields.flatMap((field) => {
    const own = 'name' in field && typeof field.name === 'string' ? [field.name] : []
    const nested = 'fields' in field && Array.isArray(field.fields) ? fieldNames(field.fields) : []
    return [...own, ...nested]
  })
}

function configuredPlugin() {
  return supportPlugin({
    capabilities: {
      aiSummaries: { generate: vi.fn(async () => undefined) },
      aiTitles: { generate: vi.fn(async () => undefined) },
      detailedBilling: true,
      inboundEmail: {
        secret: 'test-secret',
        handle: vi.fn(async () => Response.json({ success: true })),
      },
      projectSuggestions: {
        suggest: vi.fn(async () => Response.json({ suggestions: [] })),
      },
      sms: {
        adapter: { send: vi.fn(async () => ({ sent: true })) },
      },
      threadCleanup: { clean: vi.fn(async () => undefined) },
      volunteering: true,
    },
    rateLimitStore: 'payload',
  })({ collections: [], endpoints: [] } as unknown as Config) as Config
}

describe('Support capabilities', () => {
  it('owns the optional ticket, message and client fields', () => {
    const config = configuredPlugin()
    const collection = (slug: string) => config.collections?.find((item) => item.slug === slug)

    expect(fieldNames(collection('tickets')!.fields)).toEqual(expect.arrayContaining([
      'billingLines',
      'billedAt',
      'displayTitle',
      'displayTitleStatus',
      'volunteer',
      'volunteerValue',
      'waitingSince',
    ]))
    expect(fieldNames(collection('ticket-messages')!.fields)).toEqual(expect.arrayContaining([
      'notifyBySms',
      'smsTo',
      'smsMessage',
      'isMarkedAsNoise',
      'emailBodyOriginal',
    ]))
    expect(fieldNames(collection('support-clients')!.fields)).toEqual(expect.arrayContaining([
      'notifyBySmsChannel',
      'preferredFormality',
      'preferredTone',
    ]))
  })

  it('registers protected deployment adapter endpoints in the module', () => {
    const paths = configuredPlugin().endpoints?.map((endpoint) => endpoint.path)
    expect(paths).toContain('/support-webhook/inbound-email')
    expect(paths).toContain('/support/suggest-projects')
    expect(paths).toContain('/support/ticket-title')
    expect(paths).toContain('/support/generate-missing-titles')
  })
})
