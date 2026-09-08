import type { AdminViewServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { SUPPORT_STAFF_SLUG_CONFIG_KEY } from '../../utils/readSettings.js'

/**
 * Where a custom admin view must send a caller it refuses, or `null` to render.
 *
 * Payload does NOT gate custom admin views. `RootPage` skips its own
 * `canAccessAdmin` redirect as soon as `isCustomAdminView()` matches, and that
 * helper only compares the request path against the registered `view.path` —
 * it reads no visibility flag, despite what its docblock claims. Authorising a
 * custom view is therefore the view's own job, and every view registered by
 * this plugin sits at a custom path (`/support/inbox`, `/support/ticket`, …).
 *
 * `!req.user` alone is not that check. A single `payload-token` cookie serves
 * every auth collection of the host app, so an ordinary front-office account —
 * a `customers`, `members` or `subscribers` signup — carries one on `/admin`
 * routes too. Such a caller reached `DefaultTemplate` and received the admin
 * chrome together with the client config Payload builds for any authenticated
 * request: the field schema of every collection and global, `admin.hidden`
 * ones included, plus an unfiltered `visibleEntities`.
 *
 * The ticket data itself never travelled — the client components fetch through
 * `/api/support/*`, which `requireAdmin` has guarded all along — but the shape
 * of the whole CMS did.
 *
 * The gate mirrors `requireAdmin` (utils/auth.ts): membership of the staff
 * collection. It additionally honours `canAccessAdmin`, so an account the host
 * disabled through its own `access.admin` is refused here too, and it fails
 * closed on anything it cannot resolve.
 */
export function supportViewRedirectTarget(
  initPageResult: AdminViewServerProps['initPageResult'],
): string | null {
  const req = initPageResult?.req
  const config = req?.payload?.config
  const adminRoute = config?.routes?.admin ?? '/admin'
  const routes = config?.admin?.routes

  const to = (route: string | undefined, fallback: string) =>
    formatAdminURL({ adminRoute, path: (route ?? fallback) as `/${string}` })

  if (!req?.user) return to(routes?.login, '/login')

  // `sanitizePermissions` deletes the key when it is false, so an explicit
  // `false` is a denial while `undefined` simply means "not computed here".
  if (initPageResult?.permissions?.canAccessAdmin === false) {
    return to(routes?.unauthorized, '/unauthorized')
  }

  // Same source of truth as the write path: the slug `plugin.ts` publishes on
  // `config.custom`, NOT `config.admin.user` — Payload defaults the latter to
  // the app's first auth collection, which on a host declaring a front office
  // first is precisely the collection we are trying to keep out.
  //
  // `resolveStaffPrefSlug` is deliberately NOT used here. Its last-resort
  // fallback is the literal `'users'`, which is the right call on a read path
  // (a wrong scope returns no settings) and the wrong one on an authorisation
  // path: it would admit whoever happens to sit in a collection named `users`
  // on a host where neither source resolved. A gate with nothing to compare
  // against refuses.
  const custom = config?.custom as Record<string, unknown> | undefined
  const registered = custom?.[SUPPORT_STAFF_SLUG_CONFIG_KEY]
  const staffSlug =
    (typeof registered === 'string' && registered) || config?.admin?.user || null

  const collection = (req.user as { collection?: string }).collection
  if (!staffSlug || !collection || collection !== staffSlug) {
    return to(routes?.unauthorized, '/unauthorized')
  }

  return null
}
