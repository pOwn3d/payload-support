# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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
