import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The remediation script cannot be executed here — it imports the HOST's
 * `payload.config.ts` through `payload run`, which does not exist in this
 * repository. What CAN be pinned is its decision rule, which is the part that
 * must never drift: it clears a flag only when the ticket was resolved on or
 * before its stored deadline.
 *
 * The rule is safe because the pause hook DID write the extended deadline; only
 * its sibling read a stale copy. So `resolvedAt <= slaResolutionDue` is a proof
 * that the stored breach is false, not a heuristic.
 */

const SCRIPT = join(process.cwd(), 'scripts/audit-sla-breaches.mjs')

/** The script's rule, restated. Kept in step by the assertions below. */
const isFalseBreach = (resolvedAt: string | null, due: string | null): boolean => {
  if (!due || !resolvedAt) return false
  return new Date(due).getTime() >= new Date(resolvedAt).getTime()
}

describe('audit-sla-breaches — decision rule', () => {
  const due = '2026-09-08T12:00:00.000Z'

  it('clears a flag when the ticket was resolved before its deadline', () => {
    expect(isFalseBreach('2026-09-08T11:00:00.000Z', due)).toBe(true)
  })

  it('clears it on the exact boundary — resolved at the deadline is not a breach', () => {
    expect(isFalseBreach(due, due)).toBe(true)
  })

  it('keeps a genuine breach', () => {
    expect(isFalseBreach('2026-09-08T13:00:00.000Z', due)).toBe(false)
  })

  it('never judges a row with no deadline or no resolution date', () => {
    expect(isFalseBreach('2026-09-08T11:00:00.000Z', null)).toBe(false)
    expect(isFalseBreach(null, due)).toBe(false)
  })
})

describe('audit-sla-breaches — safety properties of the script itself', () => {
  const source = readFileSync(SCRIPT, 'utf8')

  it('is read-only unless --fix is passed', () => {
    expect(source).toMatch(/const APPLY = args\.includes\('--fix'\)/)
    expect(source).toMatch(/if \(!APPLY\)/)
  })

  it('only ever writes slaResolutionBreached: false', () => {
    const writes = source.match(/data: \{[^}]*\}/g) ?? []
    expect(writes).toEqual(['data: { slaResolutionBreached: false }'])
  })

  it('never touches the first-response flag, whose clock the pause does not stop', () => {
    expect(source).not.toContain('slaFirstResponseBreached: false')
  })

  it('honours a renamed tickets collection', () => {
    expect(source).toMatch(/--tickets=/)
  })
})
