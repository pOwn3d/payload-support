import { buildConfig, getPayload, type Payload, type CollectionConfig, type SanitizedConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import { supportPlugin } from '../../plugin'

/**
 * Boots a real Payload instance backed by an in-memory SQLite database, with the
 * support plugin applied. Used by integration tests to exercise access control,
 * hooks and endpoints for real (the unit tests only cover pure functions).
 *
 * `skipViews: true` avoids loading the admin view components (which resolve to the
 * built dist subpath and need bundling) — integration tests use the Local API only.
 */

// Minimal host collections the plugin relies on.
const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [{ name: 'name', type: 'text' }],
}

const Media: CollectionConfig = {
  slug: 'media',
  upload: { staticDir: '/tmp/payload-support-test-media' },
  fields: [{ name: 'alt', type: 'text' }],
}

let cached: Promise<Payload> | null = null

export function buildTestPayload(): Promise<Payload> {
  if (cached) return cached
  process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'test-secret-payload-support-integration'
  cached = (async () => {
    const config: SanitizedConfig = await buildConfig({
      secret: process.env.PAYLOAD_SECRET as string,
      db: sqliteAdapter({ client: { url: ':memory:' } }),
      editor: lexicalEditor(),
      collections: [Users, Media],
      plugins: [
        supportPlugin({
          features: { chat: false, pendingEmails: false },
          skipViews: true,
        }),
      ],
      sharp,
      telemetry: false,
    })
    return getPayload({ config })
  })()
  return cached
}
