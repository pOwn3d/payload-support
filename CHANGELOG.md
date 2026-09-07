# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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
