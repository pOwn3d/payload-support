import { describe, expect, it } from 'vitest'
import { supportViewRedirectTarget } from '../views/shared/viewAccess.js'
import { SUPPORT_STAFF_SLUG_CONFIG_KEY } from '../utils/readSettings.js'

/**
 * The thirteen admin views this plugin registers all sit at custom paths
 * (`/support/inbox`, `/support/ticket`, …). Payload does NOT authorise those:
 * `RootPage` skips its `canAccessAdmin` redirect as soon as
 * `isCustomAdminView()` matches, and that helper only compares URL paths. Until
 * this guard existed the views tested `!req.user` alone, which is true for an
 * account on ANY auth collection of the host app.
 */

const buildPageResult = (opts: {
  user?: { collection?: string } | null
  staffSlug?: string | null
  adminUser?: string
  canAccessAdmin?: boolean
  routes?: { admin?: string }
  adminRoutes?: { login?: string; unauthorized?: string }
}) => ({
  permissions:
    opts.canAccessAdmin === undefined ? {} : { canAccessAdmin: opts.canAccessAdmin },
  req: {
    user: opts.user ?? null,
    payload: {
      config: {
        routes: { admin: opts.routes?.admin ?? '/admin' },
        admin: { user: opts.adminUser ?? 'users', routes: opts.adminRoutes },
        custom:
          opts.staffSlug === null
            ? {}
            : { [SUPPORT_STAFF_SLUG_CONFIG_KEY]: opts.staffSlug ?? 'users' },
      },
    },
  },
}) as any

describe('supportViewRedirectTarget', () => {
  it('sends an anonymous visitor to the login page', () => {
    expect(supportViewRedirectTarget(buildPageResult({ user: null }))).toBe('/admin/login')
  })

  // THE regression: a front-office signup used to render the admin shell.
  it('refuses an account authenticated on another auth collection', () => {
    const target = supportViewRedirectTarget(
      buildPageResult({ user: { collection: 'customers' }, staffSlug: 'users' }),
    )
    expect(target).toBe('/admin/unauthorized')
  })

  it('refuses a support client, who has a portal and no business in the admin', () => {
    expect(
      supportViewRedirectTarget(
        buildPageResult({ user: { collection: 'support-clients' }, staffSlug: 'users' }),
      ),
    ).toBe('/admin/unauthorized')
  })

  it('lets a staff member through', () => {
    expect(
      supportViewRedirectTarget(
        buildPageResult({ user: { collection: 'users' }, staffSlug: 'users' }),
      ),
    ).toBeNull()
  })

  it('honours a renamed staff collection through config.custom', () => {
    const args = { user: { collection: 'admins' }, staffSlug: 'admins', adminUser: 'customers' }
    expect(supportViewRedirectTarget(buildPageResult(args))).toBeNull()
    // …and the collection Payload would have defaulted to is NOT let through.
    expect(
      supportViewRedirectTarget(
        buildPageResult({ ...args, user: { collection: 'customers' } }),
      ),
    ).toBe('/admin/unauthorized')
  })

  it('refuses a staff member whose host access.admin denied them', () => {
    expect(
      supportViewRedirectTarget(
        buildPageResult({
          user: { collection: 'users' },
          staffSlug: 'users',
          canAccessAdmin: false,
        }),
      ),
    ).toBe('/admin/unauthorized')
  })

  it('fails closed when the staff slug cannot be resolved at all', () => {
    const result = buildPageResult({ user: { collection: 'users' }, staffSlug: null })
    result.req.payload.config.admin.user = undefined
    expect(supportViewRedirectTarget(result)).toBe('/admin/unauthorized')
  })

  it('respects a host that moved the admin route', () => {
    expect(
      supportViewRedirectTarget(
        buildPageResult({ user: null, routes: { admin: '/panel' } }),
      ),
    ).toBe('/panel/login')
    expect(
      supportViewRedirectTarget(
        buildPageResult({
          user: { collection: 'customers' },
          routes: { admin: '/panel' },
          adminRoutes: { unauthorized: '/no-entry' },
        }),
      ),
    ).toBe('/panel/no-entry')
  })
})
