#!/usr/bin/env node

/**
 * Data half of `support-uninstall`. It is NOT meant to be run directly: it is
 * spawned by `scripts/uninstall.mjs` through `payload run`, which is what puts
 * the TypeScript loader and the environment in place so the host's
 * `payload.config.ts` can be imported.
 *
 * Everything here goes through the Payload local API rather than a `sqlite3`
 * binary. The plugin accepts custom collection slugs and runs on SQLite,
 * PostgreSQL and MongoDB; raw SQL against hardcoded table names would only
 * work on one of the three, and silently do nothing on the other two.
 */

import { getPayload } from 'payload'
import { findConfig } from 'payload/node'
import { pathToFileURL } from 'node:url'

/**
 * Deletion order matters: a child row whose `ticket` / `client` relationship is
 * `required` blocks the delete of its parent (NOT NULL on the foreign key).
 *
 * These are the DEFAULT slugs. They are duplicated from `src/utils/slugs.ts`
 * on purpose — importing `dist/index.js` here would pull pdfkit, web-push and
 * sanitize-html into a script that only deletes rows. `src/__tests__/
 * uninstallScript.test.ts` fails if the two lists ever drift apart.
 */
const ORDERED_SLUGS = [
  // 1. Rows pointing at a ticket.
  'ticket-collaborators',
  'ticket-feedback',
  'satisfaction-surveys',
  'ticket-activity-log',
  'ticket-messages',
  'time-entries',
  // 2. The tickets themselves.
  'tickets',
  // 3. Rows pointing at a client, or at nothing.
  'chat-messages',
  'pending-emails',
  'client-summaries',
  'notification-queue',
  'push-subscriptions',
  'canned-responses',
  'knowledge-base',
  'macros',
  'automation-rules',
  'ticket-statuses',
  'webhook-endpoints',
  'sla-policies',
  'support-teams',
  'auth-logs',
  'email-logs',
  'support-counters',
  'support-rate-limits',
  // 4. The portal accounts.
  'support-clients',
]

/** `payload-preferences` keys the plugin writes. */
const PREFERENCE_KEYS = {
  exact: ['support-settings', 'support-round-robin'],
  prefix: ['support-user-prefs'],
}

function parseArgs(argv) {
  const confirm = argv.includes('--confirm')
  const keepData = argv.includes('--keep-data')
  const extra = argv.find((a) => a.startsWith('--extra-slugs='))
  return {
    confirm,
    keepData,
    extraSlugs: extra ? extra.slice('--extra-slugs='.length).split(',').map((s) => s.trim()).filter(Boolean) : [],
  }
}

async function main() {
  const { confirm, keepData, extraSlugs } = parseArgs(process.argv.slice(2))

  const configPath = findConfig()
  const imported = await import(pathToFileURL(configPath).toString())
  const config = await (imported.default ?? imported)
  const payload = await getPayload({ config })

  const candidates = [...ORDERED_SLUGS, ...extraSlugs]
  const present = candidates.filter((slug) => Boolean(payload.collections?.[slug]))
  const absent = candidates.filter((slug) => !payload.collections?.[slug])

  console.log('')
  console.log(`  Config: ${configPath}`)
  console.log(`  Mode:   ${confirm ? 'DELETE' : 'DRY RUN (nothing is written)'}`)
  console.log('')

  if (!keepData) {
    console.log('  Collections found in this app:')
    for (const slug of present) {
      const { totalDocs } = await payload.count({ collection: slug, overrideAccess: true })
      console.log(`    ${String(totalDocs).padStart(7)}  ${slug}`)
    }
    if (present.length === 0) {
      console.log('    (none — nothing of this plugin is registered in this config)')
    }
    if (absent.length > 0) {
      console.log('')
      console.log(`  Not registered here, skipped: ${absent.join(', ')}`)
      console.log('  If you renamed any of them through `collectionSlugs`, re-run with')
      console.log('  --extra-slugs=your-slug,another-slug — this script cannot guess them.')
    }
  } else {
    console.log('  --keep-data: no collection row will be deleted.')
  }

  console.log('')
  console.log('  payload-preferences keys:')
  for (const key of PREFERENCE_KEYS.exact) console.log(`    ${key}`)
  for (const key of PREFERENCE_KEYS.prefix) console.log(`    ${key}* (one row per agent)`)

  if (!confirm) {
    console.log('')
    console.log('  Nothing was deleted. Re-run with --confirm to apply.')
    console.log('')
    process.exit(0)
  }

  if (!keepData) {
    console.log('')
    for (const slug of present) {
      const result = await payload.delete({
        collection: slug,
        where: { id: { exists: true } },
        overrideAccess: true,
      })
      const deleted = Array.isArray(result?.docs) ? result.docs.length : 0
      const failed = Array.isArray(result?.errors) ? result.errors.length : 0
      console.log(`  deleted ${String(deleted).padStart(7)}  ${slug}${failed ? `  (${failed} failed)` : ''}`)
      if (failed) {
        console.log(`     ${JSON.stringify(result.errors.slice(0, 3))}`)
      }
    }
  }

  console.log('')
  for (const key of PREFERENCE_KEYS.exact) {
    const result = await payload.delete({
      collection: 'payload-preferences',
      where: { key: { equals: key } },
      overrideAccess: true,
    })
    console.log(`  deleted ${String(result?.docs?.length ?? 0).padStart(7)}  payload-preferences/${key}`)
  }
  for (const key of PREFERENCE_KEYS.prefix) {
    const result = await payload.delete({
      collection: 'payload-preferences',
      where: { key: { like: key } },
      overrideAccess: true,
    })
    console.log(`  deleted ${String(result?.docs?.length ?? 0).padStart(7)}  payload-preferences/${key}*`)
  }

  console.log('')
  console.log('  Left untouched, on purpose:')
  console.log('    - your `media` collection. Attachments uploaded through the support')
  console.log('      desk are ordinary uploads once their messages are gone, and this')
  console.log('      script has no way to tell them apart from the rest of your media.')
  console.log('      Review them yourself before deleting anything there.')
  console.log('    - the tables. Rows are gone; run `payload migrate:create` and apply')
  console.log('      the migration to drop the now-unused tables.')
  console.log('')

  process.exit(0)
}

main().catch((err) => {
  console.error('')
  console.error('  Uninstall failed:', err)
  console.error('')
  process.exit(1)
})
