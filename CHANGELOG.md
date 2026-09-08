# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [6.0.1] - 2026-09-08

Fixes a packaging defect that made 5.0.0 and 6.0.0 unusable: a host application
could not build against them. If you are on either, this is the version to take
— and it is the one that finally makes the 5.0.0 security fix applicable.

### Fixed

- **`dist/views/shared/viewAccess.js` imported `../../utils/readSettings.js`,
  which was never emitted.** That file is produced by the unbundled tsup pass,
  which preserves relative imports verbatim, and `readSettings.ts` was not one
  of that pass's entries. The import trace runs through `dist/views.js`, which
  the Payload import map pulls in, so **every** install that registers the
  plugin's views hit it — it was not conditional on any option:
  `Module not found: Can't resolve '../../utils/readSettings.js'`.

  The entry list already carried the same fix for a sibling module, with a
  comment saying exactly why. `readSettings.ts` is the same case and was
  missed when `viewAccess.ts` was added in 5.0.0. `db.ts` had the same gap one
  level deeper and is emitted too now.

  What hid it: `viewAccess.ts` imports a runtime value. An `import type` would
  have been erased at compilation and left no trace. Nothing in our toolchain
  could see it — `tsc` and vitest both read `src/`, where the module exists.

### Added

- `scripts/verify-dist-imports.mjs`, wired into `pnpm build`. It walks every
  emitted file, extracts the relative imports and fails the build when one
  points at a file that is not there. It caught the `db.ts` gap immediately
  after the first fix, which is the argument for having it.

## [6.0.0] - 2026-09-08

**Not a security release.** Nothing below closes a vulnerability, and an install
sitting on 5.0.0 is not left exposed by skipping this one — take it when it suits
you. It is for integrators with an accessibility audit to answer (EAA / RGAA), a
record of processing activities to fill in or a licence review to pass, and it
closes the two failure modes the 5.0.0 audit pass never looked at: a render error
that blanks a whole admin screen, and an erasure request that only half-erases.

### Accessibility

- **73 form controls across the admin UI had no accessible name.** A screen
  reader announced them as "edit text, blank", and voice control had nothing to
  address them by. Every one is named now. Where a `<label>` already carried the
  right, already-translated text but was a floating `<div>`/`<span>` associated
  with nothing — the billing filters, the whole new-ticket form, the
  ticket-detail billing panel, the manual time entry, every row of the settings
  form — it became a real `<label htmlFor>` bound to a generated id. `useId()`,
  21 call sites, never a literal: several of these views can be mounted more than
  once in one document, and the settings form generates one id per row from a
  single shared `FieldRow`. Where no label existed at all, the control carries an
  `aria-label`. The FR and EN catalogues gained 12 keys each (three of them the
  error-boundary strings below) for the strings that had none to reuse.
  `src/__tests__/adminA11yGuards.test.ts` now fails the build on any control under
  `src/components` or `src/views` that has neither a label,
  an `aria-label`/`aria-labelledby` nor an `id` — a placeholder does not count,
  it is usually an example (`TK-0001`, `support@example.com`) rather than a name.
- **52 buttons carried no `type`, and 40 of them sit inside the Payload document
  form.** Everything under `src/components` is mounted by Payload as a field of
  the Tickets edit view, and that view is a real `<form>` (`@payloadcms/ui`'s
  `Form` renders `el || 'form'`). A `<button>` with no `type` defaults to
  `type="submit"`, so "Fusionner", "Snooze", "+ Temps", "Ticket suivant" or the
  message-edit "Enregistrer" — none of which call `preventDefault` — submitted
  the document alongside their own action, and Enter pressed in a text field
  fired whichever of them came first in the DOM. All 52 declare `type="button"`,
  and the guard test refuses a new one that does not.
- **Two `<tr onClick>` rows were the only way to reach what they pointed at.** A
  table row is not focusable and never enters the tab order, so the dashboard's
  recent-ticket list and the email-tracking error rows were mouse-only; putting
  `role="button"` on the row would have destroyed the association between cells
  and column headers instead of fixing it. The control moved into a cell: the
  dashboard renders the subject as an `<a>` (underlined on `:hover` and
  `:focus-visible`), and email tracking now hangs the toggle on the expand button
  it already had, with `aria-expanded`, `aria-controls` and a label.
- **Three inline `outline: 'none'` declarations removed** — the reply textarea,
  the rich-text editing surface and the code-language filter. An inline style
  cannot be paired with a `:focus-visible` rule, so those three removed the focus
  ring outright with nothing put back. A test flags any inline `outline: 'none'`
  in a file that does not restore an indicator through an `onFocus` handler.
- **`--theme-elevation-500` was used as a foreground colour in 122 places**, over
  15 stylesheet modules — the shared `_tokens.scss` `$text-secondary` and the
  `textSecondary` entry of the views' token file included — and 5 components.
  Payload's dark theme redefines `elevation-450` then `elevation-550` and skips
  the 500 step, so that variable stays `rgb(128, 128, 128)` in both themes:
  3.62:1 on the light background and 4.03:1 on the dark one, below WCAG AA either
  way. All 122 now read `--theme-elevation-650` (6.63:1 / 9.03:1). A test fails
  on any reintroduction of `--theme-elevation-500` as a `color:`.
- **Four palette entries were too light for the white text printed on them.**
  `V.amber` `#d97706` → `#b45309`, `V.orange` `#ea580c` → `#c2410c`, `V.green`
  `#16a34a` → `#15803d`, and the legacy `yellow` alias follows `amber`. `blue`
  and `red` already passed. `btnStyle` takes an optional `fg` so that a
  theme-variable background can supply its own foreground: the settings "Reset"
  button was white on `--theme-elevation-400`, which no single foreground can
  make readable in both themes, and it now uses the new `V.neutralBg` /
  `V.neutralFg` pair. `adminTokensContrast.test.ts` recomputes the WCAG ratio of
  every fixed hex in the palette on each run and fails below 4.5:1.
- **The inbox tab strip declared `role="tablist"` and none of the rest of the
  pattern.** The list now has an accessible name, each tab an `id`, an
  `aria-controls` and a roving `tabIndex`, and the ticket list below is the
  `role="tabpanel"` those tabs point at, labelled by the active one.
- **Attachment thumbnails in the ticket detail view rendered with `alt=""`**,
  which hides an image from assistive technology entirely. They carry the
  filename now.

### Reliability

- **A render error anywhere in the ticket conversation blanked the whole ticket
  screen.** The thirteen admin views have wrapped their client subtree in
  `AdminErrorBoundary` since before this release, but `TicketConversation` is not
  mounted by any of them: Payload instantiates it straight from the import map as
  the `ui` field of the Tickets edit view, so the plugin never renders an ancestor
  for it and no boundary of ours could wrap it from the outside. That is the
  radius that mattered — the component sits on the screen an agent spends the day
  on, and any of its ten sub-components took the entire edit view down with it,
  Payload's own fields included.

  The boundary now lives inside the module: the default export is the wrapper,
  the component itself became `TicketConversationInner`, and the document id is
  passed as a reset key so that navigating from a ticket that broke to another
  one clears the error on its own.

  The **server** half of each admin view — the access check and `DefaultTemplate`
  — is still outside any boundary, and this release does not wrap it in a
  try/catch either. A client boundary cannot enclose a server component that
  Payload instantiates itself from the import map; guarding those is a separate
  change.
- **The boundary's own "Retry" did not recover.** It cleared `hasError` and
  nothing else, so React resumed the very component instance that had just thrown,
  with the same state, and it threw again on the next render. The reset now bumps
  a counter used as the `key` of the children, which remounts the subtree. A new
  `resetKeys` prop clears the error when the input identifying the subtree changes
  (a missing array never auto-resets, so existing mount points behave as before).
- **The fallback screen leaked the thrown message and was unreadable in dark
  mode.** It printed `error.message` verbatim — which can carry a stack fragment,
  an internal path or a raw API payload — and painted itself with three hardcoded
  hexes calibrated for a white page (`#dc2626`, `#6b7280`, `#2563eb`). The message
  goes to the console only; the colours are Payload theme tokens; and its three
  strings moved into the FR/EN catalogues instead of being hardcoded French.

### Privacy, retention and uninstall

- **`POST /support/delete-account` erased roughly half of what the plugin holds
  about a client, and did it without a transaction.** It deleted the tickets,
  their messages, activity log, time entries and satisfaction surveys, the chat
  messages and the account — and left behind `ticket-feedback`,
  `ticket-collaborators`, `notification-queue`, `pending-emails` (raw inbound
  emails with the sender's address), `client-summaries` (an AI profile of the
  person), the `auth-logs` and `email-logs` rows keyed on their address, and every
  file they had ever attached to a ticket. The handler now walks all of them, in
  an order that puts the rows whose `ticket` relationship is required before the
  tickets themselves — Payload's delete-many collects per-document errors instead
  of throwing, so that ordering mistake would have failed silently and left the
  account standing. Collaborator invitations are also matched on the bare email
  address, because an invitation can predate the account it points at. The whole
  sequence runs inside a single Payload transaction (`initTransaction` /
  `commitTransaction` / `killTransaction`, a no-op on an adapter that exposes no
  `beginTransaction`): a half-deleted account is worse than an undeleted one,
  since the person is told their data is gone while some of it is still readable.
  Every collection that only exists behind a feature flag is checked for
  registration first: addressing an unregistered one throws, and inside a
  transaction that would roll the entire erasure back. The old handler called
  `chat-messages` unconditionally, so an install with `features.chat` off already
  failed there before this release.
- **`GET /support/export-data` returned four of the collections that hold the
  caller's data.** It now also returns their chat transcripts, their ticket
  feedback, the time entries booked against their tickets, and the AI client
  summary — and it separates the two legal bases instead of mixing them:
  `providedByYou` (art. 20, portability) and `derivedData` (art. 15, access —
  portability does not cover data computed *about* someone, which is why the AI
  summary sits on its own). Feature-flagged collections are skipped when absent
  rather than throwing. The portal profile page describes the two halves.
- **Automatic retention, opt-in.** `DELETE /api/support/purge-logs` existed and
  nothing ever called it, so `auth-logs` and `email-logs` grew forever. A new
  `retention` option registers a Payload Jobs task
  (`support-purge-logs`) that deletes rows past their window — defaults 180 days
  for `auth-logs`, 365 for `email-logs`, daily at 03:30 on the `default` queue.
  A Jobs task rather than a `setInterval` because an interval does not survive a
  serverless deploy and runs N times in parallel behind N instances.
  **Nothing is registered unless you pass the option** (`{}` accepts the
  defaults; `false` and "unset" both register nothing). That is deliberate:
  declaring a task turns Payload's job queue on, which adds the `payload-jobs`
  collection and the `payload-jobs-stats` global to an app that had none — a
  schema change a support plugin has no business imposing on every install, and
  one that would buy nothing anyway, since a scheduled task only fires when the
  host also runs a job runner. Leave it unset and drive the endpoint from your own
  cron instead. The scheduled path refuses a retention of `0` and skips a journal
  whose collection is not registered; `days=0` keeps meaning "wipe it entirely" on
  the manual endpoint, which is an explicit one-off admin action and never a
  schedule.
- **`npx support-uninstall`.** Removing the plugin from `payload.config.ts` stops
  the collections from being registered but leaves every row in the database, with
  no way to reach them. The new bin is a dry run by default, prints the row count
  of every one of the 25 collections it knows about that this config actually
  registers, names the ones it skipped, and only writes with `--confirm`
  (`--keep-data` removes just the three `payload-preferences` keys the plugin
  writes; `--force-db` overrides the detection gate). It deletes children before
  the tickets they point at, portal accounts last, and goes through the Payload
  local API rather than raw SQL — the plugin runs on SQLite, PostgreSQL and MongoDB
  and accepts renamed slugs, and hardcoded table names would work on one of the
  three and silently do nothing on the other two. It never rewrites your source
  (the `supportPlugin(...)` call holds your configuration) and never touches your
  `media` collection.

### Breaking

- **`GET /support/export-data` moved `profile`, `tickets`, `messages` and
  `surveys` under a `providedByYou` key**, alongside a new `derivedData`. Anything
  parsing that JSON — a custom portal, a DSR tooling script — reads them one level
  down now. `exportDate` and `exportType` stay at the top level, and the bundled
  portal only links to the download, so it is unaffected.
- **`POST /support/delete-account` now deletes rows in your own `media`
  collection.** It collects the `attachments[].file` ids referenced by the
  client's ticket messages and pending emails, and deletes those uploads. Files a
  client attached to a ticket used to survive their erasure request; they no
  longer do. This is the correct reading of article 17 for a support desk, but it
  destroys host-owned rows that earlier versions left alone — check that nothing
  else in your app references those uploads. Seven further collections are erased
  that were not before (see *Privacy* above).

### Fixed

- **The ticket cascade delete ran outside the caller's transaction.** The
  `beforeDelete` hook on `tickets` called `payload.delete` for the messages, the
  activity log, the time entries and the surveys without forwarding `req`, so the
  cascade opened its own connection instead of joining the ambient transaction —
  which, on SQLite, contends with the very transaction deleting the parent. Since
  Payload's delete-many collects per-document errors rather than throwing, the
  failure is silent and the children outlive the ticket. `req` is forwarded now,
  and the cascade skips a collection that is not registered.
- **The ticket time rollup had the same problem.** `recalculateTicketTime` read
  the entries and wrote `tickets.totalTimeMinutes` outside the transaction that
  triggered it, so it summed a stale set and contended with its own caller. Both
  operations take `req`.

### Changed

- **`lucide-react` is no longer a peer dependency.** It was required — three
  shipped components imported it statically, so a host without it failed at build
  time — for 19 distinct icons. Those are inlined as SVG instead:
  15 in `src/views/shared/icons.tsx` for the admin views, 5 in
  `src/portal/icons.tsx` for the live-chat widget (`X` is in both), under Lucide's
  own ISC licence, reproduced in each file's header. Nothing to install; an app
  that uses `lucide-react` for its own UI is unaffected. The ambient
  `src/types/lucide-react.d.ts` stub and the two `tsup` external entries are gone
  with it. Icons are `aria-hidden` by default — every icon-only control carries
  its own label — and a test asserts that the inlined set covers exactly what the
  sources import and that no `lucide-react` import survives anywhere in the
  package.
- **README: a "Database and updates" section.** The plugin adds collections to
  your config; **it does not own your schema**, and Payload gives a plugin no way
  to ship migrations — `payload migrate` reads exactly one directory,
  `payload.db.migrationDir`, resolved from the *host application's* cwd, so a
  migration file published inside a package is never discovered. The section
  states the workflow on your side (`push` in development, `migrate:create` +
  `migrate` or `prodMigrations` in production, never `push` in production), tables
  the twelve options that decide which collections exist, and says that turning one
  off does not drop its table — the rows simply become unreachable through Payload
  while still occupying the database. The Troubleshooting and FAQ answers that
  told you to "push the schema before deploying" were wrong and are rewritten.
- **README: a "Personal data, retention and uninstall" section** — what each of
  the 25 collections holds, that attachments live in *your* `media` collection and
  which three `payload-preferences` keys the plugin writes, the retention table,
  the data-subject-request endpoints, and the fact that `features.emailTracking`
  is **on by default** and inserts a 1×1 open-tracking pixel, which article 82 of
  the French *Loi Informatique et Libertés* treats as a tracker: your call to make,
  and `features: { emailTracking: false }` turns it off.
- **README: the runtime dependency licences are disclosed.** The package has
  exactly three — `pdfkit` (MIT), `sanitize-html` (MIT) and `web-push`
  (**MPL-2.0**). MPL-2.0's copyleft is per file and §3.3 allows a Larger Work under
  other terms; the plugin neither modifies nor bundles `web-push`, it imports it as
  an external, so the plugin stays MIT. CI enforces the list: a new runtime
  dependency fails the security workflow with a message telling you to review its
  licence and update both the allowlist and the README in the same commit. The
  guard is a three-name allowlist rather than a licence scanner because
  `pnpm licenses --prod` reports the auto-installed peers (payload, `@payloadcms/*`,
  react) as if they were ours.
- **README: an "Upgrading — 4.x → 5.0" section** covering what 5.0.0 asked of
  integrators (audit the admin-route access logs, re-subscribe agents whose push
  endpoint is not public HTTPS, expect one rate-limit counter reset, forward
  `challenge` from a custom portal).
- `vitest.config.ts` now includes `src/**/*.test.tsx`; the `.tsx` suites added
  here would otherwise never have run.

### Added

- `retention?: RetentionConfig | false` on `SupportPluginConfig`, and
  `DEFAULT_RETENTION`, `PURGE_LOGS_TASK_SLUG`, `purgeOlderThan`,
  `purgeableCollections`, `runScheduledPurge` plus the `RetentionConfig` and
  `ScheduledPurgeResult` types on the package barrel.
- `AdminErrorFallback` and `haveResetKeysChanged` are exported from
  `views/shared/ErrorBoundary` so the fallback can be rendered and asserted on in
  isolation; `AdminErrorBoundary` takes `resetKeys`.
- `FIXED_SLUGS` in `utils/slugs` — the three collections that hardcode their slug
  (`client-summaries`, `ticket-collaborators`, `ticket-feedback`) and must
  therefore be addressed by literal, not through `collectionSlugs`. Internal.
- `support-uninstall` is declared as a `bin`, and `scripts/uninstall.mjs` /
  `scripts/uninstall-data.mjs` ship in the tarball.
- 103 tests over 9 new files: the accessibility guards, the palette contrast
  arithmetic, the error boundary and its reset semantics, the conversation
  boundary, the inlined icon set, the retention purge and its opt-in wiring, the
  full-erasure integration test, the two-section export, and the uninstall script's
  slug list (which fails if it drifts from `utils/slugs`). The suite goes from 288
  to **391 passing tests** across 51 files.

## [5.0.0] - 2026-09-08

Follow-up to 4.0.0, published hours earlier. A per-actor audit pass found six
more holes, every one of them open since the version that introduced the code —
4.0.0 included. Two are reachable with no account at all (a 2FA lockout, a memory
exhaustion), two by any authenticated principal of *any* auth collection, one by
a staff account, and the sixth is the declared Payload range itself, which let a
fresh install resolve a Payload with a pre-authentication account takeover.

### Security

- **All thirteen admin views admitted an account from any auth collection.**
  Payload does not authorise custom admin views: `RootPage` skips its own
  `canAccessAdmin` redirect as soon as `isCustomAdminView()` matches, and that
  helper compares the request path against the registered `view.path` and
  nothing else — it reads no visibility flag, despite what its docblock says.
  Authorising the view is therefore the view's job, and every view here sits at
  a custom path (`/support/inbox`, `/support/ticket`, `/support/crm`,
  `/support/billing`, …). All thirteen tested `!req.user` alone, which is true
  for an ordinary front-office signup: a single `payload-token` cookie serves
  every auth collection of the host app and is presented on `/admin` routes too.
  Such a caller reached `DefaultTemplate` and received the admin chrome plus the
  client config Payload builds for any authenticated request — the field schema
  of every collection and global, `admin.hidden` ones included, and an
  unfiltered `visibleEntities`.

  What did **not** travel is the support data itself: the views render client
  components that fetch through `/api/support/*`, which `requireAdmin` has
  guarded all along, so an unauthorised visitor saw an empty shell. The leak is
  the shape of your CMS, not its contents. Open since the views were introduced,
  4.0.0 included. The gate now lives in one place
  (`views/shared/viewAccess.ts`), compares the caller's collection against the
  staff slug the plugin publishes on `config.custom` — not `config.admin.user`,
  which Payload defaults to the app's *first* auth collection — honours a host
  `access.admin` denial, and fails closed when it cannot resolve a slug to
  compare against. **To audit:** whether your app declares an auth collection
  besides staff and `support-clients`, and your access logs for hits on
  `<adminRoute>/support/*` from accounts that are not agents.

- **`GET /support/statuses` served the whole support workflow taxonomy to any
  authenticated account, on any auth collection.** The guard was `!!req.user`,
  and the rows are then read with `overrideAccess: true` — so a front-office
  member, a subscriber or a customer of the host app, on a collection fed by
  public sign-up, got the internal status names, the private states and the
  pipeline order that `ticket-statuses.access.read` explicitly refuses them. This
  is the same `!!req.user` shape 4.0.0 closed on `/support/email-stats` and
  `/support/typing`; `/support/statuses` is the one that pass missed, and it has
  been open since 1.0.0. The endpoint now mirrors the collection ACL instead of
  replacing it — the staff collection (`collectionSlugs.users`) and
  `support-clients`, everyone else `403`, checked *before* the read. **To
  audit:** whether your app has an auth collection other than those two. If it
  does, any of its members could read that taxonomy; nothing else was reachable
  through this endpoint, and nothing was writable.
- **An anonymous caller could still lock a 2FA client out of their account,
  through the other half of the same door.** 4.0.0 put the short-lived
  `challenge` proof on `POST /support/2fa {action:'send'}` and left
  `{action:'verify'}` as it was: no proof of the password step, and a limiter
  keyed on the *victim's* email address (5 per 15 minutes). Five anonymous posts
  carrying any code exhausted that budget, and the victim — holding the right
  password *and* the right code — then got `429` on the only route that clears
  the 2FA gate, renewably, every 15 minutes. `verify` now requires the same
  challenge, checked before the limiter, so a caller with no proof consumes no
  budget and the account is never even looked up. Two related defects in the same
  handler: both limiters were keyed on the raw address while the challenge is
  signed over the normalized one, so a single challenge bought a fresh budget per
  casing variant of the address it was minted for; and a `send` late in the
  10-minute window minted a valid code whose proof had already expired. **To
  audit:** nothing is left behind — this denies service, it does not grant
  access. If clients reported being stuck at `429`, or at "code incorrect" on a
  code they had just received, this is why.
- **An anonymous request loop could exhaust the Node process's memory, and grow
  `auth-logs` rows without bound.** `MemoryRateLimitStore` — the default whenever
  `rateLimitStore` is not configured — held its keys in a `Map` with no ceiling,
  no expiry sweep and no eviction: only `reset()` ever removed anything, and the
  login path never calls it. The key was the raw first hop of `X-Forwarded-For`,
  a caller-supplied value that can be most of Node's 16 KB header budget, so
  rotating that header minted one permanent entry per value — and because every
  fresh key opened a fresh window, the limiter did not even slow down the flood
  that was exhausting it. It is the shape 4.0.0 fixed inside `/support/typing`'s
  own module-level map, on the store that backs every other endpoint. The same
  header was also written verbatim into the `ipAddress` column of an `auth-logs`
  row on each failed anonymous login, beside an unbounded `user-agent`. Keys are
  now shape-validated and length-capped (`clientIpRateKey`), the store is capped
  at 10 000 keys with expiry sweeping first and soonest-closing-window eviction
  second, and the persisted user-agent is truncated to 256 characters. **To
  audit:** an install on the default in-memory store whose RSS climbs and never
  comes back; `auth-logs` rows whose `ipAddress` is not an IP address.
- **A staff account could aim the server's outbound push requests at any internal
  service.** `push-subscriptions.endpoint` is a plain `text` field with no
  `validate` and no hook, `POST /support/push/subscribe` only proved that the
  caller belongs to the staff collection — the very actor `utils/urlSafety`
  already models as hostile for webhook URLs — and `web-push` hands that string's
  hostname and port straight to `https.request`, with no allowlist of its own and
  outside anything `safeFetch` can wrap. Same hole, same actor, on the second
  field that steers an outbound request, with a 1-bit oracle on top: a 404/410
  prunes the row, and staff can read `push-subscriptions` back. Two layers now
  apply. At write time, `validatePushEndpoint`: `https:` only — with no
  `SUPPORT_ALLOW_INSECURE_WEBHOOKS` escape hatch, because `web-push` calls
  `https.request` whatever the scheme says — literal private, loopback and
  link-local hosts refused, and a 2048-character cap on a value that arrives in
  an HTTP body and is persisted verbatim. At send time, the same check plus a
  re-resolution of the name, which is what covers rows written before this
  release and a DNS record flipped to a private address after the row was
  accepted. A refused row is *skipped, never deleted*: the resolver check fails
  closed, and a hiccup must not purge a legitimate agent's subscription. **To
  audit:** any `push-subscriptions.endpoint` that is not on your push service's
  own domain.
- **The declared peer range allowed a Payload with a pre-authentication account
  takeover.** `peerDependencies.payload` and `@payloadcms/next` said `^3.37.0` —
  a range chosen for an API surface (`jwtSign`, `getFieldsToSign`) and never
  actually built or tested — so a fresh install could legitimately resolve below
  3.79.1, which is vulnerable to GHSA-hp5w-3hxx-vmwf and to a SQL injection. Both
  floors are now `^3.79.1`, above the advisory, and a test asserts the range never
  drops back below it. **To audit:** the resolved version in your own app
  (`pnpm why payload`, `npm ls payload`). A peer range is a floor, not an
  upgrade — an existing lockfile keeps whatever it already pinned, and this
  release does not move it for you.

### Breaking

- **Every `/admin/support/*` view now refuses an account outside the staff
  collection**, and refuses a staff member whose host `access.admin` denies
  them. If your agents sign in on a collection you renamed through
  `collectionSlugs.users`, that is the slug the gate compares against — the
  plugin publishes it on `config.custom`, so a host app that replaces `custom`
  wholesale after the plugin runs strips it and locks everyone out. Merge into
  `custom`, do not overwrite it.
- **`peerDependencies.payload` and `@payloadcms/next`: `^3.37.0` → `^3.79.1`.**
  Below that floor the install warns, and fails outright under a strict peer
  resolver or `engine-strict`. Upgrade Payload rather than force the install: the
  versions the old range allowed carry the two advisories above. CI builds and
  tests against the 3.88 line; 3.79.1 through 3.87 are admitted because every
  symbol this package imports was verified present in 3.79.1, not because a test
  run covers them.
- **`@payloadcms/richtext-lexical` is now declared as an optional peer.** The
  portal FAQ page ships in the package and imports it, while the manifest listed
  it as a devDependency only — so a consumer copying the portal template hit a
  module-not-found unless they happened to have it installed.
- **`GET /support/statuses` answers `403`** to any principal that is neither
  staff nor a support client. A dashboard, a front-office page or an integration
  reading the taxonomy with a session from another auth collection stops working
  and must authenticate as one of the two.
- **`POST /support/2fa {action:'verify'}` requires `challenge`**; without it, the
  answer is `401` and no attempt is recorded. A custom portal must keep the value
  returned by `POST /support/login` (and by the Google callback) next to
  `requires2FA` and forward it to `verify` alongside the code. Every accepted
  `send` now returns a *refreshed* `challenge` — keep the latest one, not the
  first. The bundled portal login page was updated.
- **`POST /support/push/subscribe` answers `400`** for a non-`https` endpoint, a
  literal private / loopback / link-local host, or a value over 2048 characters;
  and `sendPushToUser` silently skips rows already in the database that fail the
  same check or whose host resolves to a private address. Agents who subscribed
  through a local tunnel, a proxy on a private address or an `http://` origin
  must re-subscribe.
- **Rate-limit keys derived from `X-Forwarded-For` / `X-Real-IP` are normalized
  IP literals**; anything that is not one — including a spoofed or malformed
  header — collapses into the shared `unknown` bucket, which is the fail-closed
  direction. Rows already in the rate-limits collection that were keyed on raw
  header values no longer match, so those counters restart once on upgrade.

### Fixed

- `POST /support/2fa {action:'verify'}` returned `500` on a verification that had
  in fact succeeded, on any install configured with `rateLimitStore: 'payload'`.
  The success path called `verifyLimiter.reset(email)` with no context and
  without awaiting it: `PayloadRateLimitStore` throws when it is handed no
  request, and the throw landed *after* the verification marker was written — so
  the code was consumed, the session was not returned, and the client never got
  past the login screen. The reset is now awaited and passed `req`.
- A resend late in the 10-minute window produced a valid code whose challenge had
  already expired, and `verify` answered `401` on it. Every accepted `send` now
  refreshes the proof so it lives exactly as long as the code it just minted —
  and it does so on the throttled and unknown-address replies too, so the
  response shape still never tells the caller whether the account exists.
- The bundled portal login page stores the refreshed challenge from every `send`,
  forwards it to `verify`, and distinguishes an expired proof (`401` → "Session
  expirée, reconnectez-vous") from a wrong code.

### Changed

- `POST /support/2fa {action:'send'}` includes `challenge` in its JSON reply.
- Failed anonymous logins record the normalized IP key in `auth-logs.ipAddress`
  (`unknown` when the header is not an IP literal, where a forged string used to
  be stored verbatim) and at most 256 characters of `userAgent`. The same 256
  cap applies to `push-subscriptions.userAgent`.
- `/support/login`, `/support/chatbot`, `/support/import-conversation` and the
  inbound-email endpoint all take their IP key from `clientIpRateKey` instead of
  reading `x-forwarded-for` inline, so the bound applies everywhere at once.
- README: the access column of `/support/statuses`, the SSRF rules on
  `/support/push/subscribe`, the `/support/2fa` contract for both actions, and
  the peer-dependency and compatibility tables.

### Added

- `clientIpRateKey(req)`, `normalizeIpKey(value)` and
  `MAX_MEMORY_RATE_LIMIT_KEYS` in `utils/rateLimiter`; `MemoryRateLimitStore`
  takes an optional `maxKeys` and exposes `size`.
- `validatePushEndpoint(raw)` in `utils/urlSafety`, and `normalizeEmail` is now
  exported from `utils/twoFactorChallenge`. Internal modules, not re-exported
  from the package barrel.
- `@payloadcms/richtext-lexical` is declared as an **optional** peer dependency
  (`^3.79.1`). It was documented as a requirement for the portal FAQ page but
  never declared, so a strict resolver could not see it.
- 22 tests (`securityHardeningPass3`), covering all five items above — the
  anonymous verify lockout and its casing variants, the store ceiling and the
  forged-header key, the statuses ACL, and the push guard at write and at send
  time. The suite goes from 258 to 280 passing tests.

## [4.0.0] - 2026-09-08

Security release: every hole below is present in 3.0.0 and closed here. Upgrade
first, then read *Changed* — several of the hardenings alter a request or
response shape, or revoke an access an existing account had.

### Security

- **Any authenticated account, on any auth collection, could take over the
  plugin's server settings.** The plugin stores them in Payload's native
  `payload-preferences` under the key `support-settings`. That collection accepts
  a write from *any* authenticated principal whatever its auth collection — a
  support client, or a front-office member / subscriber of the host app — while
  the read filtered on the key alone and took the most recently updated row. A
  planted row therefore became the settings the whole plugin ran on, at most 60 s
  later (the cache TTL). What that controls: `email.replyToAddress`, used as the
  `replyTo` of nearly every outbound mail (reply notifications, reminders,
  auto-close, digests, scheduled messages, resends, invitations, transfers, SLA
  escalations), so client email replies could be redirected to an outsider — a
  cross-tenant leak of ticket content — plus `sla.escalationEmail`,
  `ai.provider` and every `features` flag. Every read is now scoped to
  `user.relationTo = <staff collection>`, taken from the plugin's own resolved
  `collectionSlugs.users` (published on `config.custom.supportStaffCollection`),
  not from `config.admin.user`, which Payload silently defaults to the *first*
  auth collection of the host app. **To audit:** any `payload-preferences` row
  keyed `support-settings` whose owner is not a staff user, and the `replyTo` /
  escalation addresses your `email-logs` actually used.
- **The same key-only read applied to per-agent preferences, and ids collide
  between auth collections.** `email-signature-<id>` and
  `support-user-prefs-<id>` were read back by key alone: support client #7 could
  write the row that agent #7's signature and locale were loaded from. Both
  families are now read with the same staff scope, on the read *and* the write
  path (`/support/signature`, `/support/user-prefs`).
- **Stored XSS in the client portal, injectable by an unauthenticated email
  sender.** A message with no `bodyHtml` was rendered with
  `dangerouslySetInnerHTML` after an escaper that replaced `&`, `<` and `>` but
  not the double quote, and the `[code:N](url)` link target was then re-injected
  into an `href` attribute whose value the URL pattern was allowed to close.
  Script then ran in the portal session of the ticket owner and of every
  collaborator. The injection point needs no account: the inbound-email pipeline
  copies `pendingEmail.body` verbatim into a ticket message
  (`endpoints/pending-emails-process.ts`), and `sanitizeMessageHtml` only ever
  looked at `bodyHtml`. Plain-text bodies are now rendered as JSX and link
  targets are parsed and restricted to `http:` / `https:`.
- **Any authenticated account could forge a live-chat message attributed to
  another client and signed as a support agent.** `chat-messages` had
  `create: ({ req }) => !!req.user` and, unlike `tickets` and `ticket-messages`,
  no hook validating the row: `client`, `senderType: 'agent'` and the `agent`
  relation were all taken from the body. The forged line was rendered by the
  agent console and by the targeted client as a genuine conversation — phishing
  over a trusted channel. `create` is now staff and support-clients only, and a
  support-client write has `client` forced to the caller, `senderType` forced to
  `client`, `agent` stripped, and is refused when the `session` already belongs
  to someone else.
- **`GET /support/email-stats`, documented as admin-only, accepted any
  authenticated session.** The guard was `!!req.user`. A support client, or a
  user of any other auth collection of the host app, could read the whole
  `email-logs` aggregate — volume, failure rate, processing time, per-action and
  per-day breakdown — even though that collection's own `read` is staff-only,
  because the pages are fetched with `overrideAccess: true`. It was also an
  amplification primitive: up to 25 000 rows read and materialised per call, with
  no rate limit. Now `requireAdmin` plus 20 requests/minute per principal.
- **A ticket collaborator invited as `viewer` could post in the thread.** The
  role was persisted and the invitation email promised "lecteur (consultation)",
  but nothing ever read the field back — the only boundary was "a collaborator
  row exists". A read-only invitee could write a message and fan out the whole
  notification chain (email to the owner and the agents, webhooks, first-response
  SLA). `resolveAccessibleTicketIds` now takes a `'read' | 'write'` mode and the
  `ticket-messages` guard asks for `'write'`, which only accepts rows carrying
  `role: 'collaborator'`.
- **Google OAuth: the CSRF state was compared against a value taken from the
  request body, and the whole path skipped 2FA.** The callback read both
  `state` and `cookieState` from the same JSON body, so for any non-browser
  caller the check was satisfied by sending one string twice; the binding to the
  browser rested entirely on integrator-side code. And because this path mints
  its session by hand (`getFieldsToSign` + `jwtSign`) instead of calling
  `payload.login`, the `beforeLogin` hook enforcing 2FA never ran: a client who
  had turned on `twoFactorEnabled` from their profile bypassed their second
  factor entirely by clicking "Sign in with Google". The state is now issued as
  an `HttpOnly` cookie at the `login` step, read back server-side from the
  `Cookie` header, compared in constant time and expired after use; the callback
  replays the 2FA rule before minting anything and answers
  `{ requires2FA: true }` with no token.
- **An anonymous caller could lock any 2FA-enabled client out of their account,
  knowing only their email address.** `POST /support/2fa {action:'send'}`
  required no proof that the password step had succeeded, and its only guard was
  a limiter keyed on the *victim's* email (3 per hour). Three requests burned the
  quota; the victim then logged in correctly, was asked for a code, and no mail
  was ever sent — renewable indefinitely. Each send also overwrote a
  `twoFactorCode` already in flight, and mailed a third-party address from the
  support domain. `action: 'send'` now requires the short-lived `challenge`
  minted by `/support/login` (and by the Google callback) alongside
  `requires2FA` — an HMAC over `PAYLOAD_SECRET`, checked *before* the limiter so
  an unauthenticated caller consumes no budget, sends no mail and overwrites no
  code.
- **Blind SSRF through webhook endpoint URLs.** `webhook-endpoints.url` was a
  plain `text` field with no validation, and the dispatcher called `fetch()` on
  it with the default redirect policy on every ticket event. A staff account
  could point it at `http://169.254.169.254/…`, a loopback port or any internal
  service and read the outcome back from `lastStatus` in the admin — an internal
  service-mapping oracle. Three layers now apply, on the current transport and on
  the deprecated `fireWebhooks` alike: `https:` only and literal private /
  loopback / link-local / IPv4-mapped-IPv6 hosts rejected at save time; the name
  re-resolved and re-checked immediately before the call, failing closed on a
  timeout, an empty answer or a resolver error; and redirects followed manually,
  with both checks re-run on every hop.
- **`POST/GET /support/typing` was an unauthenticated-in-practice memory sink and
  a name oracle.** The guard was `!!req.user` — any account of any auth
  collection — `ticketId` was never validated and went straight into a
  module-level `Map` key, and nothing ever swept that map (`cleanExpired` ran on
  the read path only, for the single id being read). A loop of POSTs with a long
  random `ticketId` grew the map without bound until the Node process died,
  taking the public portal and the Payload admin with it. The `GET` also handed
  the typing agent's first name to any authenticated caller for any ticket id.
  Ids are now shape-validated, the caller must be staff or a support client *and*
  able to read that ticket (checked through the `tickets` access rules), the map
  is capped at 500 entries with expiry sweeping and oldest-first eviction, and a
  caller with no right to the ticket gets the same "idle" body as a quiet one.
- **`client-summaries` compared `req.user.collection` against the literal
  `'users'`** instead of the configured `collectionSlugs.users` — the only
  collection in the plugin that did. On a host app whose staff collection is
  renamed (`collectionSlugs: { users: 'admins' }`) while a `users` collection
  holds the front office, that literal named the front office: its members could
  read, create, edit and delete AI-generated client intelligence (summaries,
  recurring topics, key facts, per-client ticket history) over the REST API,
  while the real agents were locked out of it. `admin.hidden: true` hides the
  nav entry, not the API.
- **Rate-limit counters were shared across endpoints and across auth
  collections.** Keys went to the store unprefixed, so with
  `rateLimitStore: 'payload'` — the setting documented for multi-instance
  deployments — different limiters collided on the same string. Ids are
  per-collection sequences, so `String(user.id)` made support client #7 and agent
  #7 one budget: sending chat messages kept a *chosen* agent 429-ed on reminders,
  notification resends and invitations. On the `ip` key, ten chatbot requests
  carrying a victim's address in `X-Forwarded-For` locked that address out of
  `/support/login` for 15 minutes. And inside `/support/2fa`, the send and verify
  limiters shared one counter. Every key is now namespaced per endpoint, and an
  authenticated caller's key carries its auth collection.
- **Two endpoints turned the support domain into an outbound mailer.**
  `POST /support/tickets/:id/transfer` sends a caller-chosen 1 000-character
  message to an arbitrary address from the operator's From address, and both its
  quotas were per *ticket* — which a client can create at will, resetting them.
  `POST /support/tickets/:id/invite` creates a full `support-clients` account for
  any unknown address and triggers both an invitation and a password-reset mail,
  capped only per hour and per ticket. Ticket-independent per-user ceilings now
  apply to support clients: 15 transfers / 24 h, and 30 invitations that create a
  new account / 7 days. Staff are exempt.
- **`POST /support/chatbot` let an anonymous caller run up the operator's AI
  bill.** The endpoint is public by design, and its only guard was a limiter
  keyed on the first hop of `X-Forwarded-For` — a value the caller supplies, so
  rotating it yields a fresh window every time. Each accepted call ships ~50 KB
  of knowledge base to the Anthropic API. A global hourly ceiling, keyed on
  nothing the caller controls, now bounds the spend; over budget the endpoint
  *degrades* instead of failing, returning the "open a ticket" deflection it
  already returns with an empty knowledge base, so a flood cannot mute the
  chatbot for legitimate visitors.
- **The portal shell identified a client by duck typing.** The authenticated
  layout accepted any session whose document had a `company` field, rather than
  one belonging to the support-clients collection — a common field on a
  front-office or subscriber document, so those users entered the portal shell
  instead of being redirected to the login page. The pages themselves query with
  `overrideAccess: false`, so no ticket data leaked; the guard now tests
  `user.collection`.

### Fixed

- The settings cache was a single shared slot, so the first read decided which
  settings every later caller saw regardless of the scope it asked for. It is now
  keyed by the staff scope the read was made under, and bounded.
- When a `support-settings` row exists but none is owned by the staff collection,
  the plugin now logs a warning naming the collection it looked under instead of
  silently running on `DEFAULT_SETTINGS` — the failure mode when
  `collectionSlugs.users` and the row's owner disagree, which turns AI calls and
  auto-close back on.
- A `webhook-endpoints` row whose URL is no longer acceptable stays editable: the
  URL is validated only when it is actually written, so such a row can still be
  renamed, re-scoped or deactivated, and the dispatcher's `lastStatus: 0`
  bookkeeping still lands on it. A field-level `validate` would have frozen every
  pre-existing row on any unrelated edit.

### Changed

- `POST /support/oauth/google` no longer reads `cookieState` from the request
  body; `{ action: 'login' }` answers with
  `Set-Cookie: support-oauth-state=…; HttpOnly; SameSite=Lax`. A hand-written
  Google button must drop `cookieState` from the callback payload and let the
  browser carry the cookie (`credentials: 'include'` cross-origin).
- `POST /support/login` returns `challenge` next to `requires2FA`, and
  `POST /support/2fa {action:'send'}` requires it — a caller that omits it gets
  `401`. The Google callback returns the same field with `requires2FA`. The
  bundled portal login page was updated; a custom portal must forward the value.
- `GET /support/email-stats` is staff-only. A dashboard calling it with a portal
  client session now gets `403`.
- A collaborator row with no explicit `role`, or `role: 'viewer'`, grants read
  access only. Rows created before 4.0.0 default to `viewer`, so an invitee who
  was posting messages stops being able to — set their row to `collaborator` to
  restore it.
- `webhook-endpoints` accepts `https://` only, and rejects literal private,
  loopback and link-local hosts at save time. An endpoint saved earlier with an
  `http://` URL or an internal host stops delivering (`lastStatus: 0`) and must
  be re-pointed; `SUPPORT_ALLOW_INSECURE_WEBHOOKS=1` re-allows `http://` for
  local development.
- `POST /support/chatbot` answers `200` with
  `{ answer: null, suggestion: 'create_ticket', aiUnavailable: true }` once the
  hourly ceiling is reached. Tune it with `SUPPORT_CHATBOT_MAX_PER_HOUR`
  (default `200`) or the new third argument of `createChatbotEndpoint`.
- `RateLimiter` takes an optional fourth `namespace` argument and prefixes every
  key it writes with it, and authenticated callers are keyed
  `<collection>:<id>`. Rows already in the rate-limits collection no longer match
  the new keys, so counters restart once on upgrade.
- `readSupportSettings`, `readSupportSettingsState` and `readUserPrefs` take an
  optional trailing `staffSlug`. Called without it inside a plugin-built config
  they resolve the staff collection from `config.custom`, so no call site needs
  to change.
- `supportPlugin()` writes `config.custom.supportStaffCollection`. A host app
  that replaces `custom` wholesale after the plugin runs will strip it.
- README: the two new environment variables, the OAuth state contract, the
  webhook URL rules, and the `/support/2fa` and `/support/email-stats` rows of
  the endpoint table.

### Added

- `SUPPORT_CHATBOT_MAX_PER_HOUR` and `SUPPORT_ALLOW_INSECURE_WEBHOOKS`
  environment variables.
- `utils/urlSafety.ts` — `validateWebhookUrl`, `isBlockedHost`,
  `assertPublicHost`, `safeFetch`, `BlockedRequestError` — and
  `utils/twoFactorChallenge.ts` — `issueTwoFactorChallenge`,
  `verifyTwoFactorChallenge`. Internal modules, not re-exported from the package
  barrel.
- `principalRateKey(user)` and `RateLimiter#scopedKey(key)`.
- 74 tests covering every item above: `securityHardening`,
  `securityHardeningPass2`, and integration suites for collaborator roles,
  settings ownership, staff-slug registration, typing access and the webhook URL
  guard.
- `.github/workflows/security.yml` — `pnpm audit --audit-level high`, gitleaks
  and CodeQL (`security-extended`), on every push and pull request plus weekly —
  and `.github/dependabot.yml`. Every GitHub Action in the three workflows is
  pinned to a commit SHA.

## [3.0.0] - 2026-09-07

Closes the cross-tenant write holes an external audit found in the client portal,
drops the unsigned duplicate webhook transport and the hard-coded AI fallback
host, and declares the platform floor the code has required since 2.x. Runtime
feature flags also move from each browser's `localStorage` to the server.

### Breaking

- **Writes performed as a `support-clients` user are now scoped and
  allow-listed.** Four access changes (what they closed is in *Security* below)
  reject or silently strip payloads that 2.x accepted. Any integration that
  authenticated as a portal client to seed, back-fill or pre-fill data must move
  to a staff (`users`) account, or to a server-side call with
  `overrideAccess: true`:
  - `ticket-collaborators` — `create` is staff-only. The
    `POST /api/support/tickets/:id/invite` endpoint is unaffected: it writes with
    `overrideAccess: true`.
  - `ticket-messages` — the guard runs on every client write, create and update
    alike. Writing a message on a ticket the client neither owns nor
    collaborates on fails with `403 Ticket inaccessible.`, and a create with no
    `ticket` fails with `400 Ticket cible requis.` (an update falls back to
    `originalDoc.ticket`). Because a client may edit their own messages, each
    such `PATCH` now resolves the accessible-ticket set too.
  - `tickets` — a client-initiated create keeps only `subject`, `category`,
    `priority` and `project`. `client` is forced to the authenticated caller
    (even when another id is sent), `status` to `open`, `source` to `portal`, and
    every other submitted field — `paymentStatus`, `billable`, `assignedTo`,
    `team`, `slaPolicy`, `snoozeUntil`, `tags`… — is dropped without an error.
    Staff creates are untouched.
  - `support-clients` — a client updating their own document can no longer write
    `tier`, `accountManager`, `opportunities`, `notes`, `googleId`,
    `twoFactorCode`, `twoFactorExpiry` or `twoFactorVerifiedAt`; Payload strips
    them from the payload without raising. `twoFactorEnabled` stays writable — it
    is the profile-page toggle. Internal writers (2FA endpoints, OAuth linking,
    `beforeLogin`) go through `overrideAccess: true` and are unaffected.

- **Peer dependencies now match what the code requires, and none of them is
  optional any more** (`peerDependenciesMeta` is gone):
  - `payload` `^3.0.0` → `^3.37.0`. The Google OAuth endpoint imports `jwtSign`
    from the `payload` barrel, which only exists from 3.37.0 on; below that the
    missing named export fails the whole `payload.config.ts`, not just that
    endpoint.
  - `@payloadcms/next` `^3.0.0` → `^3.37.0`, now required: the admin views are
    registered unless you pass `skipViews: true`, and they import
    `@payloadcms/next/templates` statically.
  - `next` `^14.0.0 || ^15.0.0 || ^16.0.0` → `^15.2.9 || ^16.0.0`, now required.
  - `react` and `react-dom` `^18.0.0 || ^19.0.0` → `^19.0.0`.
  - `lucide-react` `>=0.300.0` is required instead of optional:
    `src/portal/LiveChat.tsx`, `views/PendingEmailsView` and
    `views/TicketingSettingsView` import it statically, so a host that skipped it
    failed to build while the package manager reported nothing missing.
  - `@payloadcms/ui` and `@payloadcms/translations` are no longer declared as
    peers at all; the plugin does not import them.
  - `engines.node` `>=18` → `>=20.9.0`.

  Installing on Node 18, React 18, Next 14 or Payload < 3.37 now warns, and fails
  outright under `engine-strict` or a strict peer resolver.

- **Outbound webhooks: one signed POST per event instead of two.** Two
  dispatchers used to be registered side by side on the same hooks with identical
  guards, so every subscriber received two deliveries with incompatible bodies
  and two auth schemes. Only the HMAC path (`dispatchWebhook`) survives:
  - `ticket_created`, `ticket_resolved` and `ticket_replied` fire once per active
    endpoint.
  - The `X-Webhook-Secret` header is gone. Verify `X-Webhook-Signature`
    (HMAC-SHA256 of the body, keyed with the endpoint `secret`) instead.
  - The surviving body stays `{ event, data, timestamp }`; `data` absorbs the
    fields only the legacy shape carried, so consumers of either one keep
    resolving: `id` alongside `ticketId` on the three ticket events, plus
    `status`, `priority`, `category` on `ticket_created` and `previousStatus` on
    `ticket_resolved`. `ticket_replied` keeps its own shape — `ticketId`,
    `messageId`, `authorType` and the 500-character `body` excerpt, with no
    `id`, exactly as the legacy transport emitted it.
  - `ticket_assigned` moves onto the signed path: subscribers to that event
    change both authentication and body shape (`ticketId`, `id`, `ticketNumber`,
    `subject`, `assignedTo`).
  - Replies released by `POST /api/support/process-scheduled` go through the same
    signed path.
  - `fireWebhooks` (`src/utils/fireWebhooks.ts`) is kept but marked
    `@deprecated`; no hook calls it any more and it will be removed in 4.0.

- **`dispatchWebhook()` returns `Promise<void>` instead of `void`** and now awaits
  every endpoint delivery internally (`Promise.allSettled`). Callers that ignore
  the return value — the plugin's own hooks included — are unaffected; only a
  consumer that re-declares the signature has to widen it.

- **`provider: 'ollama'` requires `OLLAMA_API_URL`.** There is no default host any
  more: without the variable the AI endpoints, the auto-reply agent and the ticket
  synthesis throw `500 "provider 'ollama' requires OLLAMA_API_URL"`. Set it to
  your own gateway (for example `http://127.0.0.1:11434/v1`) before upgrading if
  you run that provider. See *Security*.

- **No CJS output for the `./views` and component subpaths.** The `require`
  condition was removed from the `./views` export and the `.cjs` files under
  `dist/views/` and `dist/components/` are no longer emitted — they were
  unreachable anyway (the CJS barrel `require`d its ESM siblings and threw
  `ERR_REQUIRE_ESM`). Import these subpaths with ESM. The `.` and `./client`
  entrypoints keep their CJS builds.

- **`saveFeatures(features)` returns `Promise<boolean>`** instead of `void`, since
  it now performs the server write. Callers that ignored the return value are
  unaffected.

- **`DEFAULT_FEATURES`** exported from `views/shared` and
  `components/TicketConversation/config` is now an alias of
  `DEFAULT_TICKETING_FEATURES` (same values).

- **`build` is no longer plain `tsup`**: it is
  `tsup && tsc -p tsconfig.types.json && node scripts/copy-subpath-types.mjs`. A
  fork or a CI job that called `tsup` directly produces a `dist` without the
  subpath declarations.

### Security

- **Any authenticated portal client could read every ticket in the database.**
  `ticket-collaborators.create` only checked that someone was logged in, and that
  collection is the source of truth for `resolveAccessibleTicketIds()`, which
  widens `read` on tickets, messages and the activity log. A support client could
  add themselves as collaborator on any ticket id and walk the whole base.
  Creation is now staff-only.
- **Any authenticated portal client could inject a message into someone else's
  thread.** The `afterChange` notification hooks then mailed the injected body to
  the real ticket owner from the legitimate support address — phishing over a
  trusted channel. Client-authored messages are now validated against the same
  accessible-ticket set that `read` uses.
- **Any authenticated portal client could open a ticket in another client's name
  with forged billing fields.** `billable` is read back as trusted input by
  `/api/support/billing` and `/api/support/billing/invoice`, which both select on
  `billable: true`; `paymentStatus` is read by neither, but it is displayed on the
  portal ticket page and in the admin ticket view, so a client could open a ticket
  that already showed as paid. The same create also let them raise their own
  `tier`, wipe the commercial `notes`/`opportunities`, or write `googleId` —
  resolved by the Google OAuth callback before the email, i.e. account takeover.
  Both writes are allow-listed now (see *Breaking*).
- **The `ollama` AI provider silently fell back to a third-party host.** With
  `provider: 'ollama'` and no `OLLAMA_API_URL`, four call sites defaulted to a URL
  hard-coded in the sources and shipped in the published bundle, sending full
  ticket content — subject, whole conversation, client name and company — to a
  server the operator never chose. Nothing surfaced, because the AI answer came
  back normally. The fallback is removed and a missing variable is a hard
  configuration error.
- **Outbound webhook secrets are no longer transmitted in clear.** The legacy
  transport sent the endpoint `secret` verbatim in `X-Webhook-Secret` on every
  POST, which defeated the HMAC signature emitted by the other path. Rotate the
  secrets of any endpoint that was receiving those calls.

### Added

- Releases are published with npm provenance (`publishConfig.provenance`), so the
  tarball on npm carries a signed attestation tying it to the workflow run that
  built it.

### Changed

- **Runtime feature flags are server-side.** They used to live in each browser's
  `localStorage` under `ticketing_features`, so they never followed an admin from
  one machine to another and server-side code could not see them. They are stored
  in the `features` block of the `support-settings` preference row, read through
  `/api/support/settings`, and `localStorage` is demoted to a cache that keeps the
  screens usable when that call fails. Flags already set in a browser are pushed
  to the server **once**, the first time an admin view loads while the server has
  no `features` block; after that the server always wins. Nothing to run by hand,
  nothing is lost — but when several browsers hold different flags, the first one
  to load after the upgrade seeds the server and the others adopt its values.
- `POST /api/support/settings` merges onto the current settings instead of onto
  the defaults, so a partial body no longer resets the other blocks;
  `GET /api/support/settings` additionally returns `features` and
  `featuresConfigured`.
- **The client portal is documented as a template you copy, not as a route the
  plugin mounts.** The README claimed `/support` worked out of the box; it returns
  404 until the sources under `src/portal/` are copied into your own `app/`
  directory. The new *Mounting the client portal* section gives the target tree,
  the `mv` renames the plugin's own email links depend on, and what the host must
  provide (`@payload-config`, Tailwind, `@payloadcms/richtext-lexical` for the FAQ
  page). The endpoints, collections and auth flows the portal talks to are still
  installed by the plugin.

### Fixed

- **`roundRobin` finally has an effect.** The admin toggle wrote to `localStorage`
  while the ticket auto-assign hook read a separate `support-round-robin`
  preference row that nothing ever wrote — round-robin was therefore always off.
  Both paths now read and write `settings.features.roundRobin`; the legacy row is
  still honoured on read until the first save.
- `autoClose` / `autoCloseDays` are no longer stored twice: they are projections
  of the pre-existing `settings.autoClose` block (which the auto-close cron
  already used) and are recomputed on read, so the two can no longer disagree.
- Corrupted or hand-edited stored flags are normalized on read: unknown keys are
  dropped and wrongly-typed values fall back to their default.
- **`tickets.totalTimeMinutes` no longer over-bills.** The rollup was only
  recomputed on create/update of a time entry, so deleting one left its minutes
  billed forever on the ticket the invoice endpoint and the CRM view read. An
  `afterDelete` hook now re-rolls the total. **Upgrade note:** that hook only
  fires on future deletions, and this release also makes the field the single
  source of the time the CRM shows (`views/CrmView` sums `totalTimeMinutes`
  instead of recomputing from `time-entries`). A total already inflated by a 2.x
  deletion therefore stays wrong until something touches a time entry on that
  ticket — recompute the rollup, or create and delete one entry per affected
  ticket, before invoicing.
- **The admin inbox, the portal poller and the CRM client sheet no longer read
  whole tables.** `limit=0` does not mean "no document" in Payload — it disables
  pagination, skips the count query and derives `totalDocs` from the rows it just
  materialised. The five inbox counters and the portal's 30-second ticket poll now
  call `/api/tickets/count` and `/api/ticket-messages/count`, and the CRM detail
  panel sums the per-ticket `totalTimeMinutes` rollup instead of downloading the
  entire `time-entries` table on every client it opens.
- **Live chat stops sliding to its slowest refresh mid-conversation.** The
  "new messages" flag was assigned inside a `setState` updater, which React skips
  on the eager-state path: it was written on the first update only, after which
  the adaptive backoff climbed to its ceiling and stayed there — 30 s for the
  portal widget (`src/portal/LiveChat.tsx`), 15 s for the sessions poll of the
  admin `ChatView` (whose messages poll, capped at 10 s, was already correct). The
  unread badge no longer double-counts under React StrictMode either.
- **`tickets.paymentStatus` is writable by staff again on a renamed users
  collection.** Its field guard compared `req.user.collection` to the literal
  `'users'` instead of `slugs.users`, so a host that renamed that collection had
  the field silently locked for everyone, admins included.
- **The `./views` and `./components/TicketConversation` subpaths ship type
  declarations.** `dist/views.d.ts` re-exported 13 views from paths that carried
  none (13 `TS7016` errors under `noImplicitAny`) and the documented
  `TicketConversation` field component had no `types` condition at all. A
  dedicated `tsc --emitDeclarationOnly` pass now emits them, with explicit `.js`
  extensions in the relative specifiers so consumers on
  `moduleResolution: node16 | nodenext` do not silently degrade to `any`.

### Tests

- Cover the paths this release changes: cross-tenant write isolation on the four
  collections, single signed webhook delivery, the `OLLAMA_API_URL` guard, the
  time-entry rollup on delete, and the feature-flag normalization, cache, offline
  fallbacks, one-shot `localStorage` migration and server-side merge. The release
  contains 179 passing tests.

## [2.0.1] — 2026-07-16

### Fixed
- Load the shared view dictionaries alongside the core support dictionaries so
  all ticket status, inbox, detail, time-tracking, tag and billing labels resolve
  in French and English instead of rendering their raw translation keys.
- Resolve the `dashboard.csat` and `settingsView.features` key collisions that
  made a section title and nested labels mutually exclusive.

### Tests
- Validate every literal translation key used by support components and views
  against both locale catalogs, and assert that the French and English catalogs
  remain structurally aligned. The release contains 132 passing tests.

## [2.0.0] — 2026-07-16

### Added
- **Persistent endpoint rate limiting** through the asynchronous `RateLimitStore`
  interface. `rateLimitStore: 'payload'` stores counters in Payload for sharing
  across application instances; the documented memory store remains available
  for development and single-instance deployments.
- **Atomic ticket numbering** backed by the `support-counters` collection, with
  configurable prefix and padding.
- **Typed deployment capabilities** for SMS, notification digests, inbound email,
  AI-generated titles and summaries, detailed billing, volunteering, thread
  cleanup and project suggestions.
- **Provider-neutral SMS adapter**, keeping the plugin independent from OVH or
  any other concrete transport.
- **Inbound email endpoint ownership** with configurable size, attachment-count
  and text-length limits.
- Security regression coverage for authentication responses, tracking pixels,
  rate limiting, webhook validation, HTML sanitization and capabilities. The
  release contains 124 passing tests.

### Changed
- The plugin is now the single owner of generic support collections, fields,
  hooks, views and endpoints. Host applications should retain only deployment
  configuration, secrets and provider adapters.
- Login, OAuth and 2FA responses rely exclusively on the secure `HttpOnly`
  cookie and no longer expose JWTs in JSON.
- Google OAuth preserves existing password credentials. OAuth-only accounts do
  not receive a usable random password as an alternative login mechanism.
- AI and HTML output is sanitized through the plugin's central sanitizer before
  rendering.
- Rate limits cover authentication, 2FA, public/admin chat, chatbot, invitations,
  transfers and AI endpoints.
- Cron and webhook secrets are accepted only in headers and compared in constant
  time. Query-string secrets are no longer supported.
- Open tracking uses a full HMAC, verifies that the message belongs to the ticket
  and records opens idempotently.
- Development targets are aligned with Payload 3.86, Next.js 16 and React 19.
- The project uses pnpm 10 and ships `pnpm-lock.yaml` as its only lockfile.

### Breaking
- Custom rate-limit stores must implement the asynchronous `RateLimitStore`
  contract.
- Host applications that duplicated support endpoints or hooks must remove those
  overrides and enable the native plugin endpoints.
- Consumers must generate and run an additive Payload migration for the new
  counter collection and the persistent rate-limit collection when enabled, then
  regenerate Payload types and the admin import map.
- JavaScript clients must stop reading JWTs from authentication response bodies.
- Cron and webhook callers must move secrets from query strings to headers.

### Security
- Added constant-time secret/signature verification, bounded webhook ingestion,
  persistent abuse protection and fail-closed validation paths.
- Invalid or forged tracking requests cannot mutate message or ticket data.

## [1.1.1] — 2026-06-26

### Fixed
- **Client ticket reopen**: clients can now move a ticket to `waiting_support`,
  the status sent by the portal's "Reopen" button. Previously only `open` and
  `resolved` were allowed, so reopening silently no-op'd (the PATCH returned 200
  but the status stayed `resolved`).

## [1.1.0] — 2026-06-25

### Added
- **Per-team SLA policies & dashboards**: SLA policies can target a specific team
  (team policy takes precedence over the global default), and the admin dashboard
  can be scoped per team via `?teamId=`.
- **Native push / browser notifications**: Web Push (VAPID) subscriptions per agent
  (`/support/push/subscribe`, `/support/push/vapid-public-key`), with the assigned
  agent pushed on new client messages. No-ops gracefully when VAPID is unset.
- **End-to-end UI test harness**: browser-driven Playwright suite for the admin
  (`pnpm test:e2e`), run against any host app via `E2E_BASE_URL`; skipped by
  default so CI stays green without a live admin.

### Tests
- 109 integration tests (up from 102): per-team SLA precedence, dashboard team
  scoping, push subscribe/idempotency/auth, VAPID no-op.

## [1.0.0] — 2026-06-25

First public stable release.

### Added
- **Ticketing**: statuses, priorities, categories, tags, merge/split, snooze,
  scheduled replies, internal notes, activity log, keyboard inbox.
- **SLA**: per-priority policies, business hours, **pause-on-hold**, escalation.
- **Automation**: macros, round-robin, canned responses, and a **visual
  rules engine** (triggers → conditions → actions).
- **AI**: sentiment analysis, reply suggestions, multi-style rewriting, cached
  synthesis, KB chatbot, and an **autonomous AI agent** (Anthropic/OpenAI/Ollama).
- **Channels**: inbound/outbound email, live chat (SSE), widget, email tracking.
- **Client portal**: password auth, 2FA, Google OAuth, knowledge base.
- **Time tracking & billing**: timer, manual entries, dashboard, pre-billing,
  print-ready HTML invoice and **binary PDF** invoice.
- **Reporting**: real-time dashboard, **CSAT + NPS**, real volume series,
  notification digests, HMAC-signed webhooks, CSV exports.
- **Social channels**: inbound WhatsApp / Messenger webhook → tickets, outbound replies.
- **Multi-team / workspaces**: teams, per-ticket team, opt-in agent visibility scoping.
- **Full admin i18n**: all admin views wired to FR/EN locales.
- **Tests**: Payload integration harness (in-memory SQLite) — 102 tests.

### Security
- Cross-client isolation of tickets/messages.
- Server-side HTML sanitization (stored-XSS protection).
- Server-side 2FA enforcement, OAuth email verification, fail-closed secrets.

## 0.x versions (April – June 2026)

- **0.16.0** — Manual client reminder + auto-close after 24h.
- **0.15.0** — Next 16 compatibility + accumulated features.
- **0.9.0 → 0.9.13** — Enriched views (Client Intelligence, Billing), bundled
  RichTextEditor, code blocks in emails, inline message editing, enriched
  pre-billing, per-ticket cached AI synthesis, multi-style rewriting.
- **0.6.0 → 0.6.4** — Split build (`bundle:false`) for Next.js RSC compatibility
  + barrel exports.
- **0.5.0** — Full i18n across the 13 admin views.
- **0.4.0** — Per-user preferences (locale, signature) vs global settings.
- **0.3.0** — Feature parity with ConsilioWEB + `skipCollections` / `skipViews` /
  `skipEndpoints` options.
- **0.2.0** (2026-04-08) — Security overhaul, SSE live chat, webhooks, SLA,
  scheduled replies, client portal, email template system.
- **0.1.0** (2026-04-08) — Initial scaffold: `supportPlugin()`, 15 collections,
  feature flags, AI provider abstraction (Anthropic/OpenAI/Ollama).
