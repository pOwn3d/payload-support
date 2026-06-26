# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

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
