import { describe, it, expect } from 'vitest'
import { buildTestPayload } from './buildTestPayload'
import { DEFAULT_SLUGS } from '../../utils/slugs'
import {
  DEFAULT_RETENTION,
  PURGE_LOGS_TASK_SLUG,
  purgeOlderThan,
  runScheduledPurge,
} from '../../utils/retention'

const DAY = 86400000

describe('log retention', () => {
  it('deletes only the rows older than the retention window', async () => {
    const payload = await buildTestPayload()
    const slugs = DEFAULT_SLUGS

    const old = await payload.create({
      collection: slugs.authLogs,
      data: {
        email: 'old@example.com',
        success: true,
        action: 'login',
        createdAt: new Date(Date.now() - 400 * DAY).toISOString(),
      },
      overrideAccess: true,
    })
    const recent = await payload.create({
      collection: slugs.authLogs,
      data: { email: 'recent@example.com', success: true, action: 'login' },
      overrideAccess: true,
    })

    const purged = await purgeOlderThan(payload, slugs.authLogs, 180)
    expect(purged).toBe(1)

    const remaining = await payload.find({
      collection: slugs.authLogs as never,
      where: { id: { in: [old.id, recent.id] } },
      overrideAccess: true,
      depth: 0,
    })
    expect(remaining.docs.map((d) => d.id)).toEqual([recent.id])
  }, 120_000)

  it('refuses to purge everything from the scheduled path', async () => {
    const payload = await buildTestPayload()
    const slugs = DEFAULT_SLUGS

    const kept = await payload.create({
      collection: slugs.authLogs,
      data: { email: 'keep-days-zero@example.com', success: true, action: 'login' },
      overrideAccess: true,
    })

    // `days: 0` means "delete everything" on the manual endpoint. From the
    // scheduled task it must mean "do nothing", or a misconfigured cron wipes
    // the whole security journal every night.
    const result = await runScheduledPurge(payload, slugs, {
      authLogsDays: 0,
      emailLogsDays: 0,
    })

    expect(result.skipped).toEqual(['auth-logs', 'email-logs'])
    expect(result.purged).toEqual({})
    expect(
      (await payload.count({
        collection: slugs.authLogs as never,
        where: { id: { equals: kept.id } },
        overrideAccess: true,
      })).totalDocs,
    ).toBe(1)
  }, 120_000)

  it('skips a journal whose collection is not registered', async () => {
    const payload = await buildTestPayload()

    const result = await runScheduledPurge(
      payload,
      { ...DEFAULT_SLUGS, emailLogs: 'not-registered-at-all' },
      undefined,
    )

    expect(result.skipped).toEqual(['email-logs'])
    expect(Object.keys(result.purged)).toEqual(['auth-logs'])
  }, 120_000)

  it('registers a daily purge task once `retention` is passed', async () => {
    const { supportPlugin } = await import('../../plugin')
    const applied = await supportPlugin({ retention: {}, skipViews: true })({
      collections: [],
    } as never)
    const task = applied.jobs?.tasks?.find((t) => t.slug === PURGE_LOGS_TASK_SLUG)

    expect(task).toBeDefined()
    expect(task?.schedule?.[0]?.cron).toBe(DEFAULT_RETENTION.cron)
  })
})

describe('retention is opt-in', () => {
  // Declaring a task turns Payload's job queue on, which adds `payload-jobs`
  // and `payload-jobs-stats` to an app that had none. A support plugin has no
  // business imposing two tables on every consumer, especially since a
  // scheduled task does nothing until the host also runs a job runner.
  it('registers nothing by default, so an app with no queue gains no tables', async () => {
    const { supportPlugin } = await import('../../plugin')
    const applied = await supportPlugin({ skipViews: true })({ collections: [] } as never)

    expect(applied.jobs).toBeUndefined()
  })

  it('registers nothing on an explicit `retention: false` either', async () => {
    const { supportPlugin } = await import('../../plugin')
    const applied = await supportPlugin({ retention: false, skipViews: true })({
      collections: [],
    } as never)

    expect(applied.jobs).toBeUndefined()
  })

  it('leaves a host that already declares jobs untouched when opted out', async () => {
    const { supportPlugin } = await import('../../plugin')
    const hostJobs = { tasks: [{ slug: 'host-task' }] }
    const applied = await supportPlugin({ skipViews: true })({
      collections: [],
      jobs: hostJobs,
    } as never)

    expect(applied.jobs?.tasks?.map((t) => t.slug)).toEqual(['host-task'])
  })

  it('is the only value that turns the purge off entirely', async () => {
    const payload = await buildTestPayload()
    const result = await runScheduledPurge(payload, DEFAULT_SLUGS, false)

    expect(result.purged).toEqual({})
    expect(result.skipped).toEqual(['auth-logs', 'email-logs'])
  }, 120_000)
})
