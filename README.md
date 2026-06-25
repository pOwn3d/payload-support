<div align="center" style="background: linear-gradient(135deg, #1f8a5b 0%, #16a34a 50%, #0d9488 100%); padding: 50px 40px; border-radius: 12px; color: white; margin-bottom: 40px;">
  <h1 style="margin: 0 0 15px 0; font-size: 42px; font-weight: 700; letter-spacing: -0.5px;">payload-support</h1>
  <p style="margin: 0 auto; font-size: 18px; opacity: 0.95; max-width: 640px; line-height: 1.6;">A complete, self-hosted support &amp; ticketing system for Payload CMS 3 + Next.js — tickets, SLA, AI assists and an autonomous AI agent, live chat, a full client portal, time tracking &amp; invoicing, and a visual automation-rules engine. No third-party support SaaS required.</p>
</div>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@consilioweb/payload-support?color=1f8a5b&label=npm)](https://www.npmjs.com/package/@consilioweb/payload-support)
[![MIT License](https://img.shields.io/badge/license-MIT-1f8a5b)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-18+-1f8a5b)](https://nodejs.org)
[![Payload](https://img.shields.io/badge/payload-3.x-1f8a5b)](https://payloadcms.com)
[![Tests](https://img.shields.io/badge/tests-102%20passing-1f8a5b)](src/__tests__)
[![TypeScript](https://img.shields.io/badge/typescript-strict-1f8a5b)](https://www.typescriptlang.org)

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📑 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Configuration](#-configuration)
- [Performance](#-performance)
- [Examples](#-examples)
- [FAQ](#-faq)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Contributing](#-contributing)
- [Changelog](#-changelog)
- [Roadmap](#-roadmap)
- [Support](#-support)
- [License](#-license)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ✨ Features

<table>
<tr>
<td width="50%">

**🎫 Complete ticketing**

Statuses, priorities, categories, tags, merge/split, snooze, scheduled replies, internal notes, an immutable activity log and a keyboard-driven Superhuman-style inbox.

</td>
<td width="50%">

**⏱️ SLA & automation**

SLA policies (business hours + pause-on-hold), escalation, macros, round-robin, and a **visual automation-rules engine** (conditions → actions).

</td>
</tr>
<tr>
<td width="50%">

**🤖 Built-in AI**

Sentiment, reply suggestions, multi-style rewriting, cached synthesis, a KB chatbot, and an **autonomous AI agent** that answers or escalates. Anthropic, OpenAI or self-hosted Ollama.

</td>
<td width="50%">

**💬 Omnichannel & portal**

Inbound/outbound email, live chat (SSE), widget, a full **client portal** (auth, 2FA, Google OAuth), knowledge base and deflection.

</td>
</tr>
<tr>
<td width="50%">

**💶 Time tracking & billing**

Timer, manual entries, time dashboard, per-project pre-billing and a **print-ready invoice** (HTML → PDF).

</td>
<td width="50%">

**📊 Reporting & privacy**

Real-time dashboard, **CSAT + NPS**, email tracking, HMAC-signed webhooks, notification digests, CSV exports. 100% self-hostable.

</td>
</tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🚀 Quick Start

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { supportPlugin } from '@consilioweb/payload-support'

export default buildConfig({
  plugins: [
    supportPlugin({
      features: { ai: true, sla: true, timeTracking: true, chat: true },
      ai: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      locale: 'fr',
    }),
  ],
})
```

```bash
pnpm payload generate:importmap
pnpm dev
```

Open `/admin/support/inbox` for the agent inbox, or `/support` for the client portal. The plugin injects collections, API endpoints and admin views automatically — no external SaaS.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📦 Installation

### npm
```bash
npm install @consilioweb/payload-support
```

### yarn
```bash
yarn add @consilioweb/payload-support
```

### pnpm
```bash
pnpm add @consilioweb/payload-support
```

**Peer dependencies:** `payload@^3`, `react@^18 || ^19`, `react-dom@^18 || ^19`, `next@^14 || ^15 || ^16`. `lucide-react` and the `@payloadcms/*` packages are optional depending on the features you enable. After adding admin components, run `pnpm payload generate:importmap`.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 💻 Usage

### Basic

```ts
// All features are on by default — turn off what you don't need:
supportPlugin({ features: { chat: false, pendingEmails: false }, locale: 'en' })
```

### Advanced

```ts
supportPlugin({
  features: { ai: true, sla: true, roundRobin: true, webhooks: true, snooze: true },
  ai: { provider: 'ollama', model: 'qwen2.5', baseUrl: process.env.OLLAMA_API_URL },
  email: { fromName: 'Support ACME', fromAddress: 'support@acme.com', replyTo: 'support@acme.com' },
  allowedEmailDomains: ['acme.com'],          // restrict OAuth auto-registration
  collectionSlugs: { tickets: 'support-tickets' }, // slug overrides
  navGroup: 'Support',
  basePath: '/support',
})
```

### Run the AI agent on a ticket

```ts
await fetch('/api/support/ai-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ticketId, confidenceThreshold: 0.7 }),
})
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🔌 API Reference

### `supportPlugin(config)`

The Payload plugin. Adds collections, admin views, editor components and API endpoints.

```typescript
supportPlugin(config?: SupportPluginConfig): Plugin
```

### Exports

```typescript
import { supportPlugin, generateTicketSynthesis, dispatchWebhook } from '@consilioweb/payload-support'
import type { SupportPluginConfig, SupportFeatures } from '@consilioweb/payload-support'
```

### Key HTTP endpoints (under `/api/support`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/ai` | Sentiment, reply suggestion, rewrite, synthesis (admin). |
| `POST` | `/ai-agent` | **Autonomous AI agent** — answers from the KB or escalates. |
| `POST` | `/login`, `/2fa`, `/oauth/google` | Client portal auth (password, 2FA, OAuth). |
| `GET` | `/admin-stats` | Dashboard KPIs (real volume series, CSAT, NPS). |
| `GET` | `/billing`, `/billing/invoice` | Pre-billing + print-ready invoice. |
| `POST` | `/process-snooze`, `/process-digests`, `/process-scheduled`, `/auto-close` | Cron jobs (guarded by `x-cron-secret`). |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ⚙️ Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `features` | `SupportFeatures` | all `true` | Toggle each feature on/off. |
| `ai` | `AIProviderConfig` | `anthropic` | AI provider: `anthropic` \| `openai` \| `ollama` \| `custom`. |
| `email` | `EmailConfig` | — | `fromName`, `fromAddress`, `replyTo`. |
| `locale` | `'fr' \| 'en'` | `'fr'` | Admin/portal language. |
| `basePath` | `string` | `'/support'` | Admin views prefix. |
| `userCollectionSlug` | `string` | `'users'` | Agents collection. |
| `allowedEmailDomains` | `string[]` | — | Domains allowed for OAuth auto-registration. |
| `collectionSlugs` | `object` | — | Collection slug overrides. |
| `skipCollections` / `skipViews` / `skipEndpoints` | `boolean` | `false` | Skip injecting that part. |

### Environment variables

| Env var | Required | Description |
|---------|----------|-------------|
| `PAYLOAD_SECRET` | ✅ | Payload secret (also signs 2FA & tracking). |
| `NEXT_PUBLIC_SERVER_URL` | ✅ | Public URL (email/portal links). |
| `CRON_SECRET` | for crons | `x-cron-secret` header for the cron endpoints. |
| `ANTHROPIC_API_KEY` / `OLLAMA_API_URL` | if AI | AI provider keys/URL. |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | if OAuth | Portal Google sign-in. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | if push | Web Push keys (`npx web-push generate-vapid-keys`). |
| `VAPID_SUBJECT` | optional | Push contact (`mailto:` or URL), defaults to `mailto:support@example.com`. |
| `SUPPORT_TEAM_SCOPING` | optional | `1` to scope agents to their team's tickets. |
| `SUPPORT_EMAIL` / `SUPPORT_REPLY_TO` | optional | From/reply-to addresses. |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ⚡ Performance

Engineered to stay fast under load (no fabricated benchmarks — figures depend on your volume and host):

| Concern | Approach |
|---------|----------|
| Settings reads | In-process cache (TTL + invalidation) — avoids ~8 redundant DB reads per ticket mutation. |
| List queries | SQLite indexes on filtered fields — inbox/dashboard/SLA in `O(index)` instead of full scans. |
| Email sends | Fire-and-forget — the response no longer waits on the SMTP round-trip (−200-500 ms). |
| Stats & billing | Paginated aggregation + bounded `select` — never loads all tickets in memory. |
| AI synthesis | Cached per ticket — no LLM recompute on every view. |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📚 Examples

### Automation rule (no code)

Create a **Automation Rules** entry: `event = ticket_created`, condition `category = bug`, action `set_priority = urgent`. New "bug" tickets become "urgent" automatically.

### Wire the cron jobs

```bash
# Hourly: auto-close, snooze wake-up, scheduled replies
curl -X POST https://your-app/api/support/auto-close      -H "x-cron-secret: $CRON_SECRET"
curl -X POST https://your-app/api/support/process-snooze  -H "x-cron-secret: $CRON_SECRET"
# Daily / weekly: notification digests
curl -X POST https://your-app/api/support/process-digests -H "x-cron-secret: $CRON_SECRET" -d '{"frequency":"daily"}'
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ❓ FAQ

<details>
<summary><b>Which databases are supported?</b></summary>

Built and tested on **SQLite** (`@payloadcms/db-sqlite`) with a sequential seed and `busyTimeout`. It works with any Payload adapter, but indexes and queries were validated on SQLite.

</details>

<details>
<summary><b>What Node / Payload versions are supported?</b></summary>

Node.js 18+, Payload 3.x, React 18 or 19.

</details>

<details>
<summary><b>Is there TypeScript support?</b></summary>

Yes — strict TypeScript, with business types exported (`SupportPluginConfig`, `SupportFeatures`, …).

</details>

<details>
<summary><b>Do I need an external AI service?</b></summary>

No. AI features are optional and you can run **self-hosted Ollama** to depend on no cloud (sovereignty/GDPR). Anthropic and OpenAI are also supported.

</details>

<details>
<summary><b>How do I migrate the schema in production?</b></summary>

In standalone mode the schema isn't auto-migrated: generate/push the schema (new fields and collections) before deploying. See [Troubleshooting](#-troubleshooting).

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🔧 Troubleshooting

### `useServerFunctions must be used within ServerFunctionsProvider`

Use Payload **3.75+** for all `@payloadcms/*` packages (aligned versions).

### `SQLITE_BUSY` / database is locked during seed

Make the seed **sequential** (no `Promise.all` on inserts) and add `busyTimeout: 10000` to the SQLite adapter.

### Admin views don't load

Regenerate the import map after adding components: `pnpm payload generate:importmap`. In a plugin/headless context, use `skipViews: true` if you don't mount the admin UI.

### New fields/collections missing in production

Standalone doesn't run migrations: push the schema for `googleId`, `twoFactorVerifiedAt`, `slaPausedAt`, `nps`, `mentions`, and the `notification-queue` / `automation-rules` collections.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🔐 Security

Security is a first-class concern — several guardrails are validated by integration tests.

- **Cross-client isolation** — a client can never read another's tickets/messages (filtered by owned tickets).
- **2FA** enforced server-side (`beforeLogin`); **OAuth** verifies the Google email.
- **Sanitization** of message HTML server-side (stored-XSS protection).
- **HMAC-signed** webhooks, signed tracking pixel, fail-closed secrets.

### Reporting Security Issues

Please email **contact@consilioweb.fr** instead of opening a public issue.

### Best Practices

- ✅ Set a strong `PAYLOAD_SECRET` (never a default value)
- ✅ Set `CRON_SECRET` to protect the cron endpoints
- ✅ Restrict read access to the `media` collection to the ticket owner
- ✅ Put the app behind a trusted proxy (`x-forwarded-for` header)
- ✅ Keep the plugin up-to-date

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🤝 Contributing

Contributions are very welcome!

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'feat: add AmazingFeature'`)
4. **Push** the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

Run the checks before submitting:

```bash
npm run typecheck && npm test && npm run build
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full history.

### [1.1.0] — 2026-06-25

- 🎯 **Per-team SLA policies & dashboards** (team policy overrides the default, `?teamId=` scoping).
- 🔔 **Native push / browser notifications** (Web Push / VAPID, agent pushed on new client messages).
- 🎭 **End-to-end UI test harness** (browser-driven admin via Playwright, `pnpm test:e2e`).
- ✅ 109 integration tests (up from 102).

### [1.0.0] — 2026-06-25

- ✨ Complete ticketing, SLA (+ pause-on-hold), automation & **visual rules engine**.
- 🤖 AI (sentiment, suggestion, synthesis, chatbot) + **autonomous AI agent**.
- 💬 Live chat, client portal (2FA, OAuth), knowledge base.
- 💶 Time tracking, pre-billing & print-ready invoice.
- 📊 CSAT + NPS, real volume series, digests, webhooks.
- 🔐 Security hardening (cross-client isolation, anti-XSS, server-side 2FA).
- ✅ Integration test harness (Payload + in-memory SQLite), 102 tests.

<details>
<summary><b>Previous versions (0.x)</b></summary>

- **0.16.0** — Manual client reminder + auto-close after 24h
- **0.15.0** — Next 16 compatibility + accumulated features
- **0.9.0 → 0.9.13** — Enriched views (Client Intelligence, Billing), bundled RichTextEditor, code blocks in emails, inline message editing, enriched pre-billing, per-ticket cached AI synthesis, multi-style rewriting
- **0.6.0 → 0.6.4** — Split build (`bundle:false`) for Next.js RSC compatibility + barrel exports
- **0.5.0** — Full i18n across the 13 admin views
- **0.4.0** — Per-user preferences (locale, signature) vs global settings
- **0.3.0** — Feature parity with ConsilioWEB + `skipCollections` / `skipViews` / `skipEndpoints`
- **0.2.0** — 2026-04-08 — Security overhaul, SSE live chat, webhooks, SLA, scheduled replies, client portal
- **0.1.0** — 2026-04-08 — Initial scaffold: `supportPlugin()`, 15 collections, feature flags, AI provider abstraction

</details>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 🗺️ Roadmap

- [x] Ticketing, SLA, time tracking & billing
- [x] AI assists + autonomous AI agent
- [x] Live chat, client portal, knowledge base
- [x] Visual automation-rules engine
- [x] Native binary PDF invoice (alongside the print-ready HTML)
- [x] Full admin i18n (all views)
- [x] Social channels (WhatsApp, Messenger)
- [x] Multi-team / workspaces mode
- [x] Per-team SLA policies & dashboards
- [x] Native push / browser notifications
- [x] End-to-end UI test harness (browser-driven admin)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## ☕ Support

If this plugin saves you time, consider buying me a coffee!

<a href="https://buymeacoffee.com/pown3d">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" />
</a>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

## 📄 License

Licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" alt="" />

<div align="center" style="padding: 40px 0; color: #666; border-top: 1px solid #e0e0e0; margin-top: 50px;">
  <p style="margin: 10px 0;">Built and maintained by <a href="https://consilioweb.fr" style="color: #1f8a5b; text-decoration: none;">ConsilioWEB</a></p>
  <p style="margin: 10px 0; font-size: 13px;">
    <a href="https://github.com/pOwn3d/payload-support#readme" style="color: #1f8a5b; text-decoration: none; margin: 0 15px;">Documentation</a>
    <a href="https://github.com/pOwn3d/payload-support/issues" style="color: #1f8a5b; text-decoration: none; margin: 0 15px;">Issues</a>
    <a href="https://www.npmjs.com/package/@consilioweb/payload-support" style="color: #1f8a5b; text-decoration: none; margin: 0 15px;">npm</a>
  </p>
</div>
