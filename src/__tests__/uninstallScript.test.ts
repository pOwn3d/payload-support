import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SLUGS, FIXED_SLUGS } from '../utils/slugs'
import { SUPPORT_SETTINGS_PREF_KEY } from '../utils/readSettings'

const script = readFileSync(join(process.cwd(), 'scripts/uninstall-data.mjs'), 'utf8')

function orderedSlugs(): string[] {
  const block = script.match(/const ORDERED_SLUGS = \[([\s\S]*?)\n\]/)
  expect(block, 'ORDERED_SLUGS not found in scripts/uninstall-data.mjs').toBeTruthy()
  return [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('support-uninstall slug list', () => {
  const listed = orderedSlugs()

  /**
   * The script cannot import `dist/index.js` (that would pull pdfkit,
   * web-push and sanitize-html into a row-deleting CLI), so it repeats the slug
   * list. This test is what keeps the copy honest: add a collection to the
   * plugin without adding it here and the uninstaller would leave its table
   * populated forever.
   */
  it('covers every collection the plugin registers', () => {
    // `ticketFeedback` appears in both maps (the option is accepted but the
    // collection hardcodes its slug), hence the Set.
    const owned = [...new Set([
      ...Object.entries(DEFAULT_SLUGS)
        // `users` and `media` belong to the host app, never to the plugin.
        .filter(([key]) => key !== 'users' && key !== 'media')
        .map(([, slug]) => slug),
      ...Object.values(FIXED_SLUGS),
    ])].sort()

    expect([...listed].sort()).toEqual(owned)
  })

  it('deletes children before the tickets they point at', () => {
    const ticketsAt = listed.indexOf('tickets')
    expect(ticketsAt).toBeGreaterThan(-1)

    // Their `ticket` relationship is `required`, so the foreign key blocks the
    // parent delete if they are still there.
    for (const child of [
      'ticket-collaborators',
      'ticket-feedback',
      'satisfaction-surveys',
      'ticket-activity-log',
      'ticket-messages',
      'time-entries',
    ]) {
      expect(listed.indexOf(child), `${child} must come before tickets`).toBeLessThan(ticketsAt)
    }
  })

  it('deletes the portal accounts last', () => {
    expect(listed[listed.length - 1]).toBe('support-clients')
    expect(listed.indexOf('tickets')).toBeLessThan(listed.indexOf('support-clients'))
  })

  it('clears the three payload-preferences keys the plugin writes', () => {
    expect(script).toContain(SUPPORT_SETTINGS_PREF_KEY)
    expect(script).toContain('support-round-robin')
    expect(script).toContain('support-user-prefs')
  })

  it('never touches the host media collection', () => {
    expect(orderedSlugs()).not.toContain('media')
    expect(script).toContain('your `media` collection')
  })

  it('is a dry run unless --confirm is passed', () => {
    expect(script).toContain("argv.includes('--confirm')")
    expect(script).toContain('Nothing was deleted. Re-run with --confirm to apply.')
  })
})

describe('support-uninstall entrypoint', () => {
  const bin = readFileSync(join(process.cwd(), 'scripts/uninstall.mjs'), 'utf8')
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

  it('is published and declared as a bin', () => {
    expect(pkg.bin['support-uninstall']).toBe('./scripts/uninstall.mjs')
    expect(pkg.files).toContain('scripts/uninstall.mjs')
    expect(pkg.files).toContain('scripts/uninstall-data.mjs')
  })

  it('keeps the detection gate and its override', () => {
    expect(bin).toContain('--force-db')
    expect(bin).toContain('--keep-data')
    expect(bin).toContain('isDeclaredDependency')
  })
})
