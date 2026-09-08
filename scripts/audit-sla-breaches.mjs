#!/usr/bin/env node

/**
 * Data remediation for `slaResolutionBreached` flags written in error.
 *
 * NOT meant to be run directly: it is spawned through `payload run`, which puts
 * the TypeScript loader and the environment in place so the host's
 * `payload.config.ts` can be imported. See the usage banner at the bottom.
 *
 * WHY THIS EXISTS
 * ---------------
 * Until 6.0.2, resolving a ticket straight out of `waiting_client` could store a
 * breach that never happened.
 *
 * `createPauseSlaOnHold` and `createCheckSlaOnResolve` are both `afterChange`
 * hooks on tickets, registered in that order. When a paused ticket is resolved,
 * the first pushes `slaResolutionDue` forward by the paused span and writes it
 * to the database — but the `doc` handed to the second was captured before that
 * write. It therefore compared `now` against the UN-extended deadline and wrote
 * `slaResolutionBreached: true`.
 *
 * 6.0.2 closes the cause. It does not sweep what came through, and nothing else
 * does either: the flag is `admin: { readOnly: true }`, so it cannot be cleared
 * from the admin panel.
 *
 * HOW A FALSE FLAG IS IDENTIFIED — and why this is provable rather than guessed
 * ---------------------------------------------------------------------------
 * The pause hook DID write the extended deadline; only the sibling hook read a
 * stale copy. So the row ends up carrying a CORRECT `slaResolutionDue` next to
 * an INCORRECT `slaResolutionBreached`, and re-comparing the two settles it:
 *
 *     resolvedAt <= slaResolutionDue   →  the ticket met its SLA, flag is false
 *     resolvedAt >  slaResolutionDue   →  it really did breach, flag is right
 *
 * A ticket that was never paused has an unmodified deadline, so the same
 * comparison confirms its flag instead of clearing it. There is no window in
 * which this test clears a genuine breach.
 *
 * WHAT IT CANNOT SEE
 * ------------------
 * If the resume hook itself failed — its body is wrapped in a `try`/`catch` that
 * logs to `console.error` and swallows — the deadline was never extended, and
 * the row looks exactly like an honest breach. Those are indistinguishable after
 * the fact and are left alone. Check your server logs for
 * `[sla] Failed to pause/resume SLA on hold` over the affected period.
 *
 * `slaFirstResponseBreached` is never touched: the pause stops the resolution
 * clock only, so first-response flags were always computed correctly.
 */

import { getPayload } from 'payload'
import { findConfig } from 'payload/node'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const APPLY = args.includes('--fix')
const slugArg = args.find((a) => a.startsWith('--tickets='))
const TICKETS_SLUG = slugArg ? slugArg.slice('--tickets='.length) : 'tickets'

const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '—')

/** Minutes between two dates, signed, for a human-readable margin. */
const minutesBetween = (a, b) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 60000)

async function main() {
  const config = await import(pathToFileURL(findConfig()).href).then((m) => m.default)
  const payload = await getPayload({ config })

  let rows
  try {
    const res = await payload.find({
      collection: TICKETS_SLUG,
      where: { slaResolutionBreached: { equals: true } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
      select: {
        ticketNumber: true,
        status: true,
        resolvedAt: true,
        slaResolutionDue: true,
        slaResolutionBreached: true,
        slaPausedAt: true,
      },
    })
    rows = res.docs
  } catch (err) {
    console.error(`\n  Could not read the '${TICKETS_SLUG}' collection: ${err.message}`)
    console.error('  If your install renames it, pass --tickets=<slug>.\n')
    process.exit(1)
  }

  console.log(`\n  ${rows.length} ticket(s) carry slaResolutionBreached = true.\n`)

  const falseFlags = []
  const confirmed = []
  const undecidable = []

  for (const t of rows) {
    if (!t.slaResolutionDue) {
      // No deadline to compare against — the flag predates the SLA policy or the
      // field was cleared. Not ours to judge.
      undecidable.push({ t, why: 'no slaResolutionDue to compare against' })
      continue
    }
    if (!t.resolvedAt) {
      // Still open. The resolve race cannot have produced this flag, so it came
      // from somewhere we are not modelling — report, never touch.
      undecidable.push({ t, why: `flagged but not resolved (status: ${t.status})` })
      continue
    }
    const margin = minutesBetween(t.slaResolutionDue, t.resolvedAt)
    if (margin >= 0) falseFlags.push({ t, margin })
    else confirmed.push({ t, margin })
  }

  if (confirmed.length) {
    console.log(`  ${confirmed.length} confirmed breach(es) — left untouched:`)
    for (const { t, margin } of confirmed) {
      console.log(`    ${t.ticketNumber}  resolved ${fmt(t.resolvedAt)}, ${-margin} min past its deadline`)
    }
    console.log('')
  }

  if (undecidable.length) {
    console.log(`  ${undecidable.length} row(s) this script will not judge:`)
    for (const { t, why } of undecidable) console.log(`    ${t.ticketNumber}  ${why}`)
    console.log('')
  }

  if (!falseFlags.length) {
    console.log('  No false breach found. Nothing to repair.\n')
    return
  }

  console.log(`  ${falseFlags.length} FALSE breach(es) — resolved within the deadline:`)
  for (const { t, margin } of falseFlags) {
    console.log(
      `    ${t.ticketNumber}  resolved ${fmt(t.resolvedAt)}, ` +
        `deadline ${fmt(t.slaResolutionDue)} — ${margin} min to spare`,
    )
  }
  console.log('')

  if (!APPLY) {
    console.log('  Read-only run. Re-run with --fix to clear these flags.\n')
    return
  }

  let repaired = 0
  for (const { t } of falseFlags) {
    try {
      await payload.update({
        collection: TICKETS_SLUG,
        id: t.id,
        data: { slaResolutionBreached: false },
        overrideAccess: true,
        // The hooks on this collection react to a status change; this write
        // changes none, but skipping them keeps the repair inert either way.
        context: { skipSlaHooks: true },
      })
      repaired += 1
    } catch (err) {
      console.error(`    ${t.ticketNumber}: update failed — ${err.message}`)
    }
  }
  console.log(`\n  Cleared ${repaired} of ${falseFlags.length} false flag(s).\n`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n  audit-sla-breaches failed:', err)
    process.exit(1)
  })
