# @consilioweb/payload-support

> A self-hosted support and ticketing system for Payload CMS 3 + Next.js: tickets, SLA, live chat, a client portal, time tracking and invoicing, AI assists and an automation-rules engine.

[![npm](https://img.shields.io/npm/v/@consilioweb/payload-support.svg)](https://www.npmjs.com/package/@consilioweb/payload-support)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![payload](https://img.shields.io/badge/payload-%5E3.37-blue.svg)](https://payloadcms.com)

## About

`supportPlugin()` turns a Payload 3 admin into a helpdesk: it injects 14 to 25 collections
(depending on the feature flags), 13 admin views and around 60 REST endpoints covering the whole
ticket lifecycle — intake, assignment, SLA, replies by email or live chat, resolution, CSAT and
billing. It is aimed at agencies and product teams who already run Payload and do not want to pay
for, or export their customers' data to, a third-party support SaaS.

Two things it deliberately does *not* do: it does not mount the client portal for you (the portal
ships as a template you copy into your own `app/` directory — see
[Mounting the client portal](#mounting-the-client-portal)), and it does not bundle an LLM SDK
(install `@anthropic-ai/sdk` yourself if you enable the AI features).

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Mounting the client portal](#mounting-the-client-portal)
- [Configuration](#configuration)
- [Deployment adapters](#deployment-adapters)
- [API Endpoints](#api-endpoints)
- [Webhooks](#webhooks)
- [Collections](#collections)
- [Package Exports](#package-exports)
- [Requirements](#requirements)
- [Security](#security)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Upgrading](#upgrading)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [Support](#support)
- [License](#license)

## Features

- **Ticketing** — statuses, priorities, categories, tags, merge, split, snooze, scheduled replies,
  internal notes, collaborators, and an append-only activity log (`create` and `update` are denied
  to everyone; only hooks write to it).
- **Agent inbox** — a keyboard-driven inbox view, bulk actions, macros, canned responses, and typing
  and presence indicators.
- **SLA** — per-team or default policies, business-hours deadlines, pause-on-hold, escalation, and a
  `sla-check` endpoint that lists what is breaching.
- **Automation** — an `automation-rules` collection (event → conditions → actions) and optional
  round-robin assignment.
- **AI assists** — sentiment, reply suggestion, multi-style rewrite, per-ticket cached synthesis, a
  knowledge-base chatbot, a client-intelligence summary, and an autonomous agent that either answers
  from the knowledge base or escalates. Anthropic, or `provider: 'ollama'` to reach a self-hosted
  gateway through the same SDK pointed at your own `OLLAMA_API_URL`.
- **Omnichannel** — inbound and outbound email with open tracking, live chat (SSE in the portal
  widget, polling in the shipped agent console; the portal widget stays hidden until
  `NEXT_PUBLIC_ENABLE_CHAT_WIDGET=true`), and a normalized inbound webhook for WhatsApp /
  Messenger.
- **Client portal** — password login, email 2FA, Google OAuth, ticket list and detail, FAQ, profile,
  GDPR data export and account deletion. Shipped as a template you copy (see below).
- **Time tracking and billing** — timer and manual entries, a per-ticket rollup, a time dashboard,
  per-project pre-billing, and an invoice rendered as HTML or PDF.
- **Reporting** — dashboard KPIs, CSAT and NPS, email statistics, CSV export.
- **Notifications** — admin notifications, Web Push (VAPID), and daily/weekly digest emails.
- **Webhooks** — HMAC-SHA256 signed outbound deliveries on ticket events.
- **i18n** — French and English catalogs across the admin views, selectable per user.

## Installation

```bash
pnpm add @consilioweb/payload-support
# or: npm install @consilioweb/payload-support
# or: yarn add @consilioweb/payload-support
```

**Peer dependencies** — all six are required, none is optional:

```bash
pnpm add payload@^3.37.0 @payloadcms/next@^3.37.0 next@^15.2.9 react@^19 react-dom@^19 lucide-react@">=0.300.0"
```

- `payload@^3.37.0` — the Google OAuth endpoint imports `jwtSign` from the `payload` barrel, which
  only exists from 3.37.0 on. Below that, the missing named export fails the whole
  `payload.config.ts`, not just that endpoint.
- `@payloadcms/next` and `next` — the 13 admin views are registered unless you pass
  `skipViews: true`, and each imports `DefaultTemplate` from `@payloadcms/next/templates` plus
  `next/navigation` / `next/link` statically. Both are already present in any Payload 3 admin app.
- `lucide-react` — imported statically by `PendingEmailsView` and `TicketingSettingsView`. (The
  third importer, `src/portal/LiveChat.tsx`, is a leftover: nothing in the shipped portal mounts
  it.)

**AI runtime dependency** — the AI features load `@anthropic-ai/sdk` through a runtime
`require`/dynamic `import` and it is marked `external` at build time. It is intentionally not a
dependency of this package, so install it yourself if you use `features.ai`, the chatbot, the
autonomous agent, ticket synthesis, client intelligence or the AI conversation import:

```bash
pnpm add @anthropic-ai/sdk
```

After adding admin components, regenerate the import map:

```bash
pnpm payload generate:importmap
```

## Quick Start

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { supportPlugin } from '@consilioweb/payload-support'

export default buildConfig({
  plugins: [
    supportPlugin({
      features: { ai: true, sla: true, timeTracking: true, chat: true },
      ticketNumber: { prefix: 'TK-', padding: 6 },
    }),
  ],
})
```

```bash
pnpm payload generate:importmap
pnpm dev
```

Open `/admin/support/inbox` for the agent inbox and `/admin/support/settings` to pick the AI
provider, the sender addresses, the SLA targets and the runtime feature flags.

> **The client portal is not a route the plugin mounts.** `/support` returns 404 until you copy the
> portal template into your own `app/` directory — see
> [Mounting the client portal](#mounting-the-client-portal). Everything the portal talks to (the REST
> endpoints, the auth/2FA/OAuth endpoints, the collections) *is* installed by the plugin; only the
> Next.js pages have to live in your app.

## Mounting the client portal

The portal ships as a **template you copy**, not as an importable subpath — and that is a
constraint, not an oversight: `src/portal/auth/layout.tsx` and three of its pages import
`@payload-config`, an alias that only exists inside your application, and `src/portal/layout.tsx`
renders its own `<html>`/`<body>` as a Next.js **root layout**. Neither can be resolved from
`node_modules`, so there is no `./portal` export and `plugin.ts` registers no Next route.

The sources are published in the tarball (`files` includes `src`), so copy them out of
`node_modules` into a route group of your own `app/` directory. Two directories have to be
renamed on the way in — the shipped names are plain folders, not Next.js route syntax — and
`layout.tsx` has to sit at the **group** level, because it renders its own `<html>`/`<body>`
and only one root layout per group may do that (the same convention `create-payload-app`
uses for its `(payload)` / `(frontend)` groups):

```text
src/app/
└── (support)/
    ├── layout.tsx          ← src/portal/layout.tsx      (root layout of the group)
    └── support/
        ├── page.tsx        ← src/portal/page.tsx        → /support
        ├── login/ register/ forgot-password/ reset-password/
        └── (auth)/         ← src/portal/auth/           (route group: no URL segment)
            ├── layout.tsx  (auth guard + header + chatbot and chat widgets)
            ├── dashboard/ faq/ profile/
            └── tickets/
                ├── new/
                └── [id]/   ← src/portal/auth/tickets/detail/  (the page reads `params.id`)
```

```bash
mkdir -p 'src/app/(support)/support'
cp -R node_modules/@consilioweb/payload-support/src/portal/. 'src/app/(support)/support/'
cd 'src/app/(support)'
mv support/layout.tsx layout.tsx
mv support/auth 'support/(auth)'
mv 'support/(auth)/tickets/detail' 'support/(auth)/tickets/[id]'
```

That yields `/support`, `/support/login`, `/support/register`, `/support/forgot-password`,
`/support/reset-password` and, behind the auth layout, `/support/dashboard`, `/support/faq`,
`/support/profile`, `/support/tickets/new` and `/support/tickets/<id>` — exactly the paths the
plugin's notification emails and the portal's own links point to, so the renames are
mandatory, not cosmetic.

What your app must provide for those pages to work:

| Requirement | Why |
|---|---|
| The `@payload-config` alias | The authenticated pages call `getPayload({ config })` directly. Standard in a `create-payload-app` project. |
| **Tailwind CSS** | 28 of the 35 portal files are styled with Tailwind utility classes only. Without Tailwind the portal renders unstyled. |
| `@payloadcms/richtext-lexical` | `auth/faq/page.tsx` renders knowledge-base entries with `RichText` from `@payloadcms/richtext-lexical/react`. It is **not** a peer dependency of this plugin — add it yourself if you mount the FAQ page. |
| `NEXT_PUBLIC_SERVER_URL` | Email and portal links are built from it. |
| `NEXT_PUBLIC_SUPPORT_PHONE` | The ticket detail page prints a support phone number; without this variable it prints the placeholder `01 23 45 67 89` to your clients. |

`lucide-react` is **not** needed by the pages above: the only portal file importing it is
`src/portal/LiveChat.tsx`, which the shipped `(auth)` layout never mounts. It stays a required peer
for the admin views.

The `(auth)` layout mounts two widgets. `ChatbotWidget` is always rendered; `ChatWidget` — the
floating live-chat FAB — returns `null` unless the host app sets
`NEXT_PUBLIC_ENABLE_CHAT_WIDGET=true`, whatever `features.chat` says.

Because it is a copy, the portal is yours to restyle and re-brand; the trade-off is that
plugin upgrades do not update it. Diff it against
`node_modules/@consilioweb/payload-support/src/portal` after a version bump.

## Configuration

### Plugin options

| Option | Type | Default | Description |
|---|---|---|---|
| `features` | `SupportFeatures` | see below | Build-time feature flags — decide which collections, endpoints and views exist. |
| `rateLimitStore` | `RateLimitStore \| 'payload'` | in-memory | Shared storage for the endpoint rate limits. `'payload'` adds the `support-rate-limits` collection. |
| `ticketNumber` | `{ prefix?, padding? }` | `{ prefix: 'TK-', padding: 4 }` | Sequential ticket-number formatting, backed by an atomic counter. |
| `capabilities` | `SupportCapabilities` | — | Host adapters for SMS, inbound email, digests, AI titles/summaries, detailed billing, volunteering, thread cleanup and project suggestions. See [Deployment adapters](#deployment-adapters). |
| `basePath` | `string` | `'/support'` | Prefix of the admin view routes (`/admin<basePath>/inbox`, …). The conversation-import view is the exception: it is registered at the fixed `/admin/import-conversation`. |
| `userCollectionSlug` | `string` | `'users'` | The staff/agent auth collection. |
| `allowedEmailDomains` | `string[]` | — | Restricts Google OAuth **auto-registration** to these domains. Existing accounts are unaffected. |
| `collectionSlugs` | `object` | see [Collections](#collections) | Per-collection slug overrides. |
| `notificationSlug` | `string` | `'admin-notifications'` | Collection the plugin writes admin notifications to. |
| `conversationComponent` | `string` | `'@consilioweb/payload-support/components/TicketConversation'` | Import path of the conversation UI field rendered on a ticket. |
| `projectCollectionSlug` | `string` | — | When set, adds a `project` relationship to tickets (and enables per-project billing). |
| `documentsCollectionSlug` | `string` | — | When set, adds quote/invoice upload fields to tickets. |
| `skipCollections` | `boolean` | `false` | Do not inject the collections. |
| `skipViews` | `boolean` | `false` | Do not inject the admin views. |
| `skipEndpoints` | `boolean` | `false` | Do not inject the REST endpoints. |

### Options accepted but not read

Four keys are part of `SupportPluginConfig` but no code path reads them. They are listed here so you
do not configure them and wonder why nothing changes:

| Option | What actually decides | Where to set it |
|---|---|---|
| `ai` (`AIProviderConfig`) | `settings.ai.provider` / `settings.ai.model` | Admin → Support → Settings, or `POST /api/support/settings`. Defaults to `anthropic` / `claude-haiku-4-5-20251001`. |
| `email` (`EmailConfig`) | `settings.email.*`, falling back to `SUPPORT_EMAIL` / `SUPPORT_REPLY_TO` | Same settings view, or the environment. |
| `locale` | The per-user preference | `GET`/`POST /api/support/user-prefs` (defaults to `fr`). |
| `navGroup` | — | Nowhere: each collection hard-codes its own `admin.group`. 20 sit under `Support`, three under `Gestion` (`canned-responses`, `ticket-activity-log`, `time-entries`), and `support-counters` / `support-rate-limits` declare none — they are `hidden` anyway. |

### Build-time feature flags

`supportPlugin({ features })` accepts `SupportFeatures`. Every flag defaults to `true` except
`roundRobin` and `customStatuses`; `autoCloseDays` defaults to `7`.

| Flag | Default | Turning it off removes |
|---|---|---|
| `ai` | `true` | `client-summaries`, `/support/ai`, `/support/ai-agent`, `/support/client-intelligence`, `/support/ticket-synthesis` |
| `timeTracking` | `true` | `time-entries`, `/support/billing`, `/support/billing/invoice`, the Time dashboard view |
| `chat` | `true` | `chat-messages`, the four chat endpoints, the Chat view |
| `emailTracking` | `true` | `email-logs`, `/support/email-stats`, `/support/track-open`, the Tracking view |
| `pendingEmails` | `true` | `pending-emails`, `/support/pending-emails/:id/process`, the Pending emails view |
| `sla` | `true` | `sla-policies`, `/support/sla-check` |
| `webhooks` | `true` | `webhook-endpoints` (and therefore every outbound delivery) |
| `macros` | `true` | `macros`, `/support/apply-macro` |
| `authLogs` | `true` | `auth-logs` |
| `customStatuses` | `false` | *(off by default)* `ticket-statuses`, `/support/statuses` |
| `autoClose` | `true` | `/support/auto-close`, `/support/send-reminder` |
| `autoCloseDays` | `7` | — (projection of `settings.autoClose.daysBeforeClose`) |
| `snooze` | `true` | `/support/process-snooze` |
| `scheduledReplies` | `true` | `/support/process-scheduled` |
| `satisfaction` | `true` | `/support/satisfaction` |
| `merge` | `true` | `/support/merge-tickets` |
| `splitTicket` | `true` | `/support/split-ticket` |
| `bulkActions` | `true` | `/support/bulk-action` |
| `collisionDetection` | `true` | `/support/typing`, `/support/presence` |
| `signatures` | `true` | `/support/signature` |
| `chatbot` | `true` | `/support/chatbot` |
| `roundRobin` | `false` | *(off by default)* `/support/round-robin-config` |
| `canned`, `externalMessages`, `clientHistory`, `activityLog` | `true` | Nothing at build time — they exist as runtime flags (below) and only hide UI sections. |
| `commandPalette`, `knowledgeBase` | `true` | Nothing — no code reads either flag, at build time or at runtime. |

### Build-time vs runtime feature flags

Two distinct things share the word "features", and they act at different moments:

| | `supportPlugin({ features })` | Runtime flags (Settings view) |
|---|---|---|
| Type | `SupportFeatures` (28 keys) | `TicketingFeatures` (16 keys) |
| Decides | which collections and endpoints **exist** | which UI sections are **shown**, plus round-robin and auto-close |
| Changed by | editing `payload.config.ts` + redeploy | an admin, in the ticketing settings view |
| Stored in | code | the `features` block of the `support-settings` preference row |

Turning a feature off at build time removes its collection and endpoints, so the matching runtime
flag has nothing left to show. Runtime flags only ever narrow what a build-time-enabled feature
exposes.

Runtime flags are read through `GET /api/support/settings` and written through
`POST /api/support/settings` (admin-only). They apply to every browser and to server-side code — the
auto-assign hook and the auto-close cron read the same values. `localStorage` is still written, but
only as a cache so an admin screen stays usable when the settings call fails; it is never
authoritative.

Two flags are projections, deliberately not stored twice: `features.autoClose` mirrors
`settings.autoClose.enabled`, and `features.autoCloseDays` mirrors
`settings.autoClose.daysBeforeClose`.

> **Upgrading from ≤ 2.0.1** — flags used to live in each browser's `localStorage`
> (`ticketing_features`). The first admin view loaded after the upgrade pushes that browser's values
> to the server, once, if the server has none yet; from then on the server wins. Nothing to run by
> hand, nothing is lost. If several machines disagree, the first one to load seeds the server and the
> others adopt its copy.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `PAYLOAD_SECRET` | yes | Payload secret. Also signs the 2FA tokens and the email tracking pixels; the 2FA endpoint refuses to operate without it. |
| `NEXT_PUBLIC_SERVER_URL` | yes | Public URL used to build every email and portal link. |
| `CRON_SECRET` | for the cron endpoints | Expected value of the `x-cron-secret` header. |
| `ANTHROPIC_API_KEY` | with the `anthropic` provider | Anthropic API key. |
| `OLLAMA_API_URL` | with the `ollama` provider | Base URL of your own AI gateway, used as the SDK `baseURL`. **Mandatory** — there is no default host, and the AI paths throw `500 "provider 'ollama' requires OLLAMA_API_URL"` rather than sending ticket content anywhere you did not choose. |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | for portal OAuth | Google sign-in on the portal. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | for Web Push | Generate with `npx web-push generate-vapid-keys`. |
| `VAPID_SUBJECT` | optional | Push contact (`mailto:` or URL). Defaults to `mailto:support@example.com`. |
| `SUPPORT_EMAIL` / `SUPPORT_REPLY_TO` | optional | Fallback sender / reply-to addresses when the settings row leaves them empty. |
| `SUPPORT_CLIENT_BCC` | optional | Archive mailbox blind-copied on client-facing emails. Use a dedicated address, not `support@`, or the inbound anti-loop guard will re-create tickets from the copies. |
| `SUPPORT_TEAM_SCOPING` | optional | `1` or `true` to scope agents to their own team's tickets. |
| `SUPPORT_WEBHOOK_SECRET` | for machine imports | Expected value of the `x-webhook-secret` header on `POST /api/support/import-conversation`. |
| `CHANNELS_WEBHOOK_SECRET` | for social channels | Expected value of the `x-channel-secret` header on `POST /api/support/channels/webhook`. |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | for WhatsApp replies | Outbound WhatsApp credentials. |
| `MESSENGER_PAGE_TOKEN` | for Messenger replies | Outbound Messenger page token. |
| `CONTACT_EMAIL` | optional | Address treated as "the admin" when importing an existing email conversation. |
| `NEXT_PUBLIC_ENABLE_CHAT_WIDGET` | to show the portal chat widget | `'true'` mounts the floating live-chat widget in the portal `(auth)` layout. Anything else — including leaving it unset — makes `ChatWidget` return `null`, so `features.chat: true` on its own displays nothing to clients. |
| `NEXT_PUBLIC_SUPPORT_PHONE` | for the portal ticket page | Support phone number shown on the portal ticket detail page. Set it: the fallback is the placeholder `01 23 45 67 89`. |
| `NEXT_PUBLIC_SUPPORT_SEND_ALIASES` | optional | Comma-separated "send as" identities offered in the agent composer. Empty by default, and then the composer offers only the agent themselves. |
| `NEXT_PUBLIC_SMTP_HOST` / `NEXT_PUBLIC_SMTP_PORT` | optional | Shown read-only in the Settings view. Informational only — mail is sent through `payload.sendEmail`, so these change nothing about delivery. |
| `SUPPORT_CHATBOT_MAX_PER_HOUR` | optional | Global hourly ceiling on `POST /api/support/chatbot`, all callers combined (default `200`). The per-IP window is keyed on `X-Forwarded-For`, which an anonymous caller can rotate at will; this unkeyed ceiling is what bounds the Anthropic bill. Trade-off to accept knowingly: being unkeyed, it turns a cost abuse into an availability one — one anonymous caller burning the quota mutes the chatbot for every visitor until the next window. On a high-traffic public portal, raise it and enforce the per-IP limit at the reverse proxy, where the real client address is known. |
| `SUPPORT_ALLOW_INSECURE_WEBHOOKS` | local dev only | `1` allows `http://` webhook endpoint URLs. Without it only `https://` is accepted, at save time and at delivery time. |

### Cron jobs

Four endpoints are meant to be called by a scheduler and are guarded by the `x-cron-secret` header.
Note that `auto-close` is a **GET**:

```bash
# Hourly
curl -X GET  https://your-app/api/support/auto-close       -H "x-cron-secret: $CRON_SECRET"
curl -X POST https://your-app/api/support/process-snooze    -H "x-cron-secret: $CRON_SECRET"
curl -X POST https://your-app/api/support/process-scheduled -H "x-cron-secret: $CRON_SECRET"

# Daily / weekly
curl -X POST https://your-app/api/support/process-digests -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" -d '{"frequency":"daily"}'
```

### Automation rules

`automation-rules` is edited in the admin, no code required. A rule has a trigger
(`ticket_created`, `ticket_updated` or `ticket_status_changed`), a match mode (`all` / `any`), a list
of conditions (field, `equals` / `not_equals` / `contains`, value) and a list of actions
(`set_status`, `set_priority`, `set_category`, `assign`, `add_tag`). For example: trigger
`ticket_created`, condition `category equals bug`, action `set_priority = urgent`.

## Deployment adapters

The plugin owns the generic support workflow; anything provider-specific stays in your application
and is injected through `capabilities`. Every key is optional and a missing adapter simply disables
the corresponding behaviour (`inboundEmail`, `projectSuggestions` and `aiTitles` also gate the
endpoints they need).

```ts
supportPlugin({
  rateLimitStore: 'payload',
  capabilities: {
    sms: {
      adapter: {
        isConfigured: () => Boolean(process.env.SMS_PROVIDER_ACCOUNT),
        send: async ({ message, to }) => mySmsProvider.send({ message, to }),
      },
    },
    inboundEmail: {
      secret: process.env.SUPPORT_WEBHOOK_SECRET,
      secretHeader: 'x-webhook-secret',
      handle: handleInboundSupportEmail,
    },
    detailedBilling: true,
    volunteering: true,
  },
})
```

| Capability | Shape | Effect |
|---|---|---|
| `sms` | `{ adapter, buildMessage? }` | Sends an SMS alongside the client notification. |
| `digests` | `boolean` | **Inert** — no code reads it. `notification-queue` and `POST /api/support/process-digests` are registered unconditionally. |
| `inboundEmail` | `{ handle, secret?, secretHeader? }` | Registers `POST /api/support-webhook/inbound-email`, validated and rate-limited by the plugin. |
| `aiTitles` | `{ generate }` | Registers `POST /api/support/ticket-title` and `POST /api/support/generate-missing-titles`, and adds the title fields on clients. |
| `aiSummaries` | `{ generate }` | Overrides the default resolved-ticket synthesis generator. |
| `detailedBilling` | `boolean` | Adds the billing-line fields and their invoicing state. |
| `volunteering` | `boolean` | Adds pro-bono tracking and its estimated value. |
| `threadCleanup` | `{ clean }` | Best-effort cleanup of noisy messages after an inbound client reply. |
| `projectSuggestions` | `{ suggest }` | Registers `POST /api/support/suggest-projects`. |

## API Endpoints

All paths are relative to `/api`. "Staff" means a user of `userCollectionSlug` (default `users`);
"client" means a `support-clients` user. The *Flag* column names the build-time feature flag that has
to stay enabled for the endpoint to be registered.

### Tickets and agent tools

| Method | Path | Access | Flag | Purpose |
|---|---|---|---|---|
| `GET` | `/support/search` | staff | — | Global search over tickets, messages, clients and the knowledge base. |
| `GET` | `/support/kb/search` | public | — | Knowledge-base search (used by the portal and the chatbot). |
| `GET` | `/support/statuses` | authenticated | `customStatuses` | Ticket statuses, sorted. |
| `POST` | `/support/bulk-action` | staff | `bulkActions` | Apply one action to many tickets. |
| `POST` | `/support/merge-tickets` | staff | `merge` | Merge a source ticket into a target. |
| `POST` | `/support/split-ticket` | staff | `splitTicket` | Extract a message into a new ticket. |
| `POST` | `/support/apply-macro` | staff | `macros` | Run a multi-action macro on a ticket. |
| `POST` | `/support/tickets/:id/escalate` | staff | — | Move a ticket to `escalated`. |
| `POST` | `/support/tickets/:id/transfer` | staff or ticket owner | — | Email a conversation recap to an external address. |
| `POST` | `/support/tickets/:id/invite` | staff or ticket owner | — | Invite a collaborator on the ticket. |
| `POST` | `/support/tickets/:id/feedback` | client | — | Submit a rating (1-5) and an optional comment. |
| `POST` | `/support/satisfaction` | client | `satisfaction` | Submit the CSAT survey of a resolved ticket. |
| `POST` | `/support/send-reminder` | staff | `autoClose` | Nudge a client whose ticket awaits their reply. |
| `POST` | `/support/resend-notification` | staff | — | Re-send the email notification of one message. |
| `POST` | `/support/import-conversation` | staff, or `x-webhook-secret` | — | Import an existing email thread as a ticket. |
| `GET`/`POST` | `/support/typing` | authenticated | `collisionDetection` | Typing indicator. |
| `GET`/`POST` | `/support/presence` | staff | `collisionDetection` | Who is looking at this ticket. |
| `GET`/`POST` | `/support/signature` | staff | `signatures` | Per-agent email signature. |
| `GET`/`POST` | `/support/user-prefs` | staff | — | Per-user locale and signature. |

### Portal authentication and GDPR

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/support/login` | public, rate-limited | Portal password login. Sets an `HttpOnly` cookie; the JWT is never returned in JSON. |
| `POST` | `/support/2fa` | public, rate-limited | Email second factor. `action: 'send'` requires the short-lived `challenge` returned by `/support/login` (or by the Google callback) alongside `requires2FA` — without it an anonymous caller could burn a victim's send quota and lock them out. `action: 'verify'` takes the code. |
| `POST` | `/support/oauth/google` | public | Google sign-in, optionally restricted by `allowedEmailDomains`. |
| `GET` | `/support/email-stats` | **staff**, rate-limited | Email pipeline aggregate. Was reachable by any authenticated session before 3.0.1. |
| `GET` | `/support/export-data` | client | GDPR data export. |
| `POST` | `/support/delete-account` | client | GDPR right to erasure. |
| `POST` | `/support/merge-clients` | staff | Merge two client records. |

**Google OAuth, CSRF state.** `{ "action": "login" }` now answers with a `Set-Cookie:
support-oauth-state=…; HttpOnly; SameSite=Lax` alongside the `url` and `state` it already returned.
The callback reads that cookie **server-side** and compares it, in constant time, with the `state`
Google sends back — it no longer accepts a `cookieState` field in the request body, which any
non-browser caller could simply send twice. If you wrote your own Google button, drop `cookieState`
from the callback payload and let the browser carry the cookie (`credentials: 'include'` on a
cross-origin fetch). The callback also enforces 2FA: an account with `twoFactorEnabled` gets
`{ requires2FA: true }` and no token, exactly like `/support/login`.

### AI

| Method | Path | Access | Flag | Purpose |
|---|---|---|---|---|
| `POST` | `/support/ai` | staff, rate-limited | `ai` | `sentiment`, `synthesis`, `suggest_reply` or `rewrite`. |
| `POST` | `/support/ai-agent` | staff, rate-limited | `ai` | Autonomous agent: answers from the knowledge base or escalates. |
| `POST` | `/support/ticket-synthesis` | staff, rate-limited | `ai` | Generate (or return the cached) per-ticket synthesis. |
| `GET`/`POST` | `/support/client-intelligence` | staff, rate-limited | `ai` | Cached client summary. |
| `POST` | `/support/chatbot` | public, rate-limited | `chatbot` | Knowledge-base chatbot used for deflection. |
| `POST` | `/support/seed-kb` | staff | — | Seed the knowledge base. |

```ts
await fetch('/api/support/ai-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ticketId, confidenceThreshold: 0.7 }),
})
```

### Live chat

| Method | Path | Access | Flag | Purpose |
|---|---|---|---|---|
| `GET`/`POST` | `/support/chat` | client | `chat` | Portal chat polling and send. |
| `GET` | `/support/chat-stream` | client | `chat` | SSE stream for the portal widget. |
| `GET`/`POST` | `/support/admin-chat` | staff | `chat` | Agent console: sessions, messages, send. |
| `GET` | `/support/admin-chat-stream` | staff | `chat` | SSE stream of the session list, or of one session's messages with `?session=`. Available for a custom agent console — the shipped Chat view polls `/support/admin-chat` instead. |

### Reporting, billing and email

| Method | Path | Access | Flag | Purpose |
|---|---|---|---|---|
| `GET` | `/support/admin-stats` | staff | — | Dashboard KPIs, volume series, CSAT and NPS. |
| `GET` | `/support/export-csv` | staff | — | CSV export of the tickets. |
| `GET` | `/support/sla-check` | staff | `sla` | Tickets breaching or close to breaching SLA. |
| `GET` | `/support/billing` | staff | `timeTracking` | Pre-billing for a period, optionally per project. |
| `GET` | `/support/billing/invoice` | staff | `timeTracking` | Invoice for the period, `format=html\|pdf`. |
| `GET` | `/support/email-stats` | authenticated | `emailTracking` | Email open/sent aggregates. |
| `GET` | `/support/track-open` | public, HMAC-signed | `emailTracking` | Tracking pixel. |
| `POST` | `/support/pending-emails/:id/process` | staff | `pendingEmails` | Turn a pending email into a ticket or a reply. |
| `DELETE` | `/support/purge-logs` | staff | — | Delete logs older than N days. |

### Settings, notifications and machine-to-machine

| Method | Path | Access | Flag | Purpose |
|---|---|---|---|---|
| `GET`/`POST` | `/support/settings` | staff | — | Read and write the support settings, including the runtime feature flags. |
| `GET`/`POST` | `/support/round-robin-config` | staff | `roundRobin` | Read and toggle round-robin assignment. |
| `GET` | `/support/push/vapid-public-key` | public | — | VAPID public key for the browser subscription. |
| `POST` | `/support/push/subscribe` | staff | — | Register an agent's push subscription. |
| `GET` | `/support/auto-close` | `x-cron-secret` | `autoClose` | Remind, then close, inactive tickets. |
| `POST` | `/support/process-snooze` | `x-cron-secret` | `snooze` | Wake snoozed tickets. |
| `POST` | `/support/process-scheduled` | `x-cron-secret` | `scheduledReplies` | Release scheduled replies. |
| `POST` | `/support/process-digests` | `x-cron-secret` | — | Send the daily or weekly digests. |
| `POST` | `/support/channels/webhook` | `x-channel-secret` | — | Normalized inbound WhatsApp / Messenger webhook. |
| `POST` | `/support-webhook/inbound-email` | configured secret header | `capabilities.inboundEmail` | Inbound email, validated and bounded by the plugin. |
| `POST` | `/support/suggest-projects` | staff | `capabilities.projectSuggestions` | Deployment-specific project suggestions. |
| `POST` | `/support/ticket-title` | staff | `capabilities.aiTitles` | Generate a short display title for one ticket. |
| `POST` | `/support/generate-missing-titles` | staff | `capabilities.aiTitles` | Backfill the missing display titles. |

## Webhooks

Create a row in `webhook-endpoints` with a URL, a `secret` and the events you want, and set it
`active`. Each event is delivered **once** per matching endpoint (up to 50, 10 s timeout each), as a
single `POST`:

```http
Content-Type: application/json
User-Agent: PayloadSupport-Webhook/1.0
X-Webhook-Signature: <HMAC-SHA256 of the raw body, keyed with the endpoint secret>

{ "event": "ticket_created", "data": { … }, "timestamp": "2026-09-07T10:00:00.000Z" }
```

The signature header is only sent when the endpoint has a `secret`, so always set one. There is no
`X-Webhook-Secret` header any more — verify the HMAC signature instead. `lastTriggeredAt` and
`lastStatus` are written back on the endpoint after every attempt. Requires `features.webhooks`.

**The endpoint URL is validated as an SSRF target, not as free text.** Only `https://` is accepted
(set `SUPPORT_ALLOW_INSECURE_WEBHOOKS=1` for local `http://`), literal loopback / private /
link-local / IPv4-mapped-IPv6 hosts are rejected at save time, the hostname is re-resolved and
re-checked immediately before the request (DNS rebinding), and redirects are followed **manually**
so a `302` towards `127.0.0.1` or `169.254.169.254` cannot slip past the checks. An endpoint saved
before 3.0 with an `http://` URL or an internal host stops delivering and must be re-pointed — but
it stays editable: the check runs only on a URL you actually write, so such a row can still be
renamed or deactivated, and `lastStatus: 0` is still recorded on it so a dead endpoint is visible.

| Event | `data` |
|---|---|
| `ticket_created` | `ticketId`, `id`, `ticketNumber`, `subject`, `status`, `priority`, `category` |
| `ticket_resolved` | `ticketId`, `id`, `ticketNumber`, `subject`, `previousStatus` |
| `ticket_assigned` | `ticketId`, `id`, `ticketNumber`, `subject`, `assignedTo` |
| `ticket_replied` | `ticketId`, `messageId`, `authorType`, `body` (first 500 characters), plus `scheduled: true` when released by the scheduler |
| `sla_breached` | Selectable on an endpoint, but nothing dispatches it — subscribing to it delivers nothing. |

## Collections

"Staff" is `userCollectionSlug` (default `users`), "client" is a `support-clients` user.

`collectionSlugs` accepts 19 keys: `tickets`, `ticketMessages`, `supportClients`, `timeEntries`,
`cannedResponses`, `ticketActivityLog`, `satisfactionSurveys`, `knowledgeBase`, `chatMessages`,
`pendingEmails`, `emailLogs`, `authLogs`, `webhookEndpoints`, `slaPolicies`, `macros`,
`ticketStatuses`, `ticketFeedback`, `rateLimits` and `counters`. Three caveats:

- **`media` has no key, and it is the blocking one.** The internal `CollectionSlugs` type carries a
  `media` slug (default `media`) and uses it as the `relationTo` of the attachment fields on
  `ticket-messages` and `pending-emails`, but `collectionSlugs` exposes no way to set it. If your
  uploads collection is named anything else, Payload throws `InvalidFieldRelationship` at config
  sanitisation and the whole `payload.config.ts` fails to build. Your uploads collection has to be
  named `media`.
- Three slugs are genuinely fixed: `ticketFeedback` is accepted but ignored, and
  `ticket-collaborators` and `client-summaries` have no key at all — those three files write their
  own `slug:` as a literal.
- `notificationQueue`, `automationRules`, `supportTeams` and `pushSubscriptions` are a different
  case: their collections *do* read `slugs.*`, only the public option type omits the keys. The
  plumbing is there; widening the type would be enough.

| Slug | Injected | Role | Read | Write |
|---|---|---|---|---|
| `tickets` | always | The tickets themselves | staff; clients see the tickets they own or collaborate on | staff; a client create keeps only `subject`, `category`, `priority`, `project` |
| `ticket-messages` | always | Conversation, internal notes, scheduled replies | staff; clients see non-internal, already-sent messages of their tickets | staff; clients only on an accessible ticket, and may edit only their own messages |
| `support-clients` | always | Portal auth collection (2FA, OAuth, notification preferences) | staff; a client reads their own row | staff; a client updates their own row minus `tier`, `accountManager`, `opportunities`, `notes`, `googleId` and the 2FA internals |
| `ticket-collaborators` | always | Extra clients invited on a ticket — source of truth for client read scope | staff and the invited client | staff only (`update` denied to everyone); the invite endpoint writes with `overrideAccess`. **Fixed slug.** |
| `ticket-activity-log` | always | Append-only audit trail | staff; clients on their own tickets | nobody — hooks only (`create`/`update` denied) |
| `canned-responses` | always | Quick reply templates | staff | staff |
| `satisfaction-surveys` | always | CSAT after resolution | staff and the surveyed client | immutable once submitted |
| `ticket-feedback` | always | Portal rating and comment | staff and the author | immutable once submitted. **Fixed slug.** |
| `knowledge-base` | always | FAQ and chatbot corpus | staff; published entries publicly | staff |
| `notification-queue` | always | Digest queue | staff | hooks only |
| `automation-rules` | always | Event → conditions → actions | staff | staff |
| `support-teams` | always | Teams, used by team SLA and `SUPPORT_TEAM_SCOPING` | staff | staff |
| `push-subscriptions` | always | Agent Web Push subscriptions | staff | the subscribe endpoint only |
| `support-counters` | always | Atomic ticket-number counter | nobody | internal only |
| `auth-logs` | `authLogs` | Portal authentication audit | staff | system-generated |
| `time-entries` | `timeTracking` | Time spent, rolled up into `tickets.totalTimeMinutes` | staff | staff |
| `email-logs` | `emailTracking` | Sent/opened tracking | staff | system-generated |
| `webhook-endpoints` | `webhooks` | Outbound webhook subscriptions | staff | staff |
| `sla-policies` | `sla` | Default and per-team SLA targets | staff | staff |
| `macros` | `macros` | Multi-action shortcuts | staff | staff |
| `chat-messages` | `chat` | Live chat sessions | staff and the session's client | authenticated |
| `pending-emails` | `pendingEmails` | Inbound emails awaiting triage | staff | staff, or a create carrying a valid `x-webhook-secret` |
| `ticket-statuses` | `customStatuses` | Configurable statuses | authenticated | staff |
| `client-summaries` | `ai` | Cached client-intelligence summaries | staff | staff. **Fixed slug**, and its access rules compare against the literal `users` collection, so a renamed staff collection loses access to it. |
| `support-rate-limits` | `rateLimitStore: 'payload'` | Shared rate-limit counters | nobody | internal only |

## Package Exports

| Subpath | Exposes | Formats | Environment |
|---|---|---|---|
| `@consilioweb/payload-support` | `supportPlugin`, the collection factories, the SLA and status-email hooks, `dispatchWebhook`, `generateTicketSynthesis`, the rate-limit stores, the settings and feature helpers, and the public types | ESM + CJS, typed | Server (`payload.config.ts`) |
| `@consilioweb/payload-support/client` | `SUPPORT_CLIENT_VERSION` — the `'use client'` barrel marker | ESM + CJS, typed | Client |
| `@consilioweb/payload-support/views` | The 13 admin views, for the Payload import map | **ESM only**, typed | Server components |
| `@consilioweb/payload-support/components/TicketConversation` | The conversation field component | **ESM only**, typed | Client |

The two view/component subpaths lost their CJS build in 3.0.0: the emitted `.cjs` barrels
`require`d their ESM siblings and threw `ERR_REQUIRE_ESM`, so they were unreachable. Payload 3 and
Next are ESM-first; import them with ESM.

```ts
import { supportPlugin, dispatchWebhook, generateTicketSynthesis } from '@consilioweb/payload-support'
import type { SupportPluginConfig, SupportFeatures } from '@consilioweb/payload-support'
```

## Requirements

| Requirement | Range | Source |
|---|---|---|
| Node.js | `>=20.9.0` | `engines.node` |
| Payload | `^3.37.0` | `peerDependencies.payload` |
| `@payloadcms/next` | `^3.37.0` | `peerDependencies` |
| Next.js | `^15.2.9 \|\| ^16.0.0` | `peerDependencies` |
| React / React DOM | `^19.0.0` | `peerDependencies` |
| `lucide-react` | `>=0.300.0` | `peerDependencies` |
| `@anthropic-ai/sdk` | any recent version | Runtime-only, install it yourself if you use the AI features |
| `@payloadcms/richtext-lexical` | any 3.x | Only if you mount the portal FAQ page |

Installing on Node 18, React 18, Next 14 or Payload < 3.37 warns, and fails outright under
`engine-strict` or a strict peer resolver.

## Security

- **Cross-client isolation** — reads on `tickets`, `ticket-messages` and `ticket-activity-log` are
  constrained to the ticket ids a client owns or collaborates on, resolved server-side and failing
  closed on an empty set. Client writes are validated against that same set.
- **Allow-listed client writes** — a client-initiated ticket create keeps only `subject`, `category`,
  `priority` and `project`; `client`, `status` and `source` are forced. A client updating their own
  profile cannot touch `tier`, `accountManager`, `opportunities`, `notes`, `googleId` or the 2FA
  internals.
- **Cookie-only portal JWTs** — `HttpOnly`, `SameSite=Lax`, `Path=/`, 2 h max age, and `Secure`
  outside development. Login, OAuth and 2FA responses never return the token in JSON.
- **2FA enforced server-side** (`beforeLogin`), and the endpoint refuses to run without
  `PAYLOAD_SECRET` rather than falling back to an insecure default. OAuth verifies the Google email.
- **Stored-XSS protection** — message HTML is sanitized on write, not on render, and the portal
  renders plain-text bodies as JSX (no hand-rolled HTML escaping) so an inbound email cannot inject
  an attribute into a link.
- **Owner-scoped preferences** — the plugin's `payload-preferences` rows (settings, per-agent
  signature and locale) are read back with a `user.relationTo` constraint on the staff collection.
  `payload-preferences` accepts a write from *any* authenticated principal, so reading by key alone
  let a client own the server settings.
- **Auth-collection checks, not duck typing** — every guard compares `user.collection` to the
  configured slug: a user of another auth collection of the host app is not a support client.
- **HMAC everywhere it matters** — webhook deliveries and tracking pixels are signed and verified in
  constant time, with idempotent writes. Cron and webhook secrets are read from headers only; a
  query-string secret is rejected.
- **Persistent rate limiting** on login, 2FA, chat, invitations, transfers, imports and every AI
  endpoint. Use `rateLimitStore: 'payload'` (or your own shared store) on multi-instance deployments.
- **No silent third-party AI host** — the `ollama` provider fails loudly on a missing
  `OLLAMA_API_URL` instead of defaulting to someone else's server.
- **Bounded inbound email** payloads and attachments.
- **Bounded outbound mail** — ticket transfers and collaborator invitations are capped per user over
  a long window, not only per ticket (a client can create tickets at will).
- **SSRF-guarded outbound webhooks** — scheme, literal host, resolved address and every redirect hop.
- **2FA also enforced on the Google OAuth path**, which mints its session outside `payload.login`
  and therefore outside the `beforeLogin` hook.

### Reporting security issues

Email **contact@consilioweb.fr** instead of opening a public issue.

### Best practices

- Set a strong `PAYLOAD_SECRET` and a real `CRON_SECRET`.
- Restrict read access on your `media` collection to the ticket owner.
- Put the app behind a trusted proxy so `x-forwarded-for` is meaningful.
- Rotate every webhook endpoint secret that existed before 3.0.0 — the legacy transport sent it in
  clear on every delivery.

## Performance

No benchmarks are claimed here; the figures depend on your volume and host. What the code actually
does:

| Concern | Approach |
|---|---|
| Settings reads | In-process cache with a 60 s TTL and explicit invalidation on save — the `afterChange` hook chain reads the same preference row many times per ticket mutation. |
| List queries | Indexed fields on `tickets` for the columns the inbox, dashboard and SLA views filter on. |
| Stats and billing | Paginated aggregation (100 rows per page) with a bounded `select` — never loads all tickets in memory. |
| Counters | The inbox counters and the portal poller call `/api/*/count` instead of fetching rows. |
| Client time totals | The CRM sums the per-ticket `totalTimeMinutes` rollup instead of scanning `time-entries`. |
| AI synthesis | Persisted on the ticket (`aiSummary`, `aiSummaryGeneratedAt`) and reused until forced. |

## Troubleshooting

**`useServerFunctions must be used within ServerFunctionsProvider`** — align every `@payloadcms/*`
package on the same version, 3.75 or later.

**`SQLITE_BUSY` / database is locked during seed** — make the seed sequential (no `Promise.all` on
inserts) and add `busyTimeout: 10000` to the SQLite adapter.

**Admin views do not load** — regenerate the import map (`pnpm payload generate:importmap`). In a
headless context, pass `skipViews: true`.

**New fields or collections missing in production** — standalone builds do not run migrations. Push
the schema before deploying, including `googleId`, `twoFactorVerifiedAt`, `slaPausedAt`, `nps`,
`mentions`, and the `notification-queue`, `automation-rules`, `ticket-collaborators`,
`support-counters` collections.

**`Cannot find module '@anthropic-ai/sdk'`** — install it in your app; the plugin does not bundle or
declare it.

**`ERR_REQUIRE_ESM` on `@consilioweb/payload-support/views`** — that subpath is ESM-only since 3.0.0.

## FAQ

**Which databases are supported?** — built and tested on SQLite (`@payloadcms/db-sqlite`) with a
sequential seed and `busyTimeout`. It works with any Payload adapter, but the indexes and queries
were validated on SQLite.

**Do I need an external AI service?** — no. The AI features are optional, and `provider: 'ollama'`
points the SDK at the `OLLAMA_API_URL` you choose, so no ticket content has to leave your
infrastructure. `provider: 'openai'` and `provider: 'custom'` are accepted by the `AIProviderConfig`
type but not implemented: at runtime everything that is not `ollama` goes to Anthropic.

**Is TypeScript supported?** — yes, strict, with the business types exported
(`SupportPluginConfig`, `SupportFeatures`, `TicketData`, …). All four export subpaths ship
declarations.

**How do I migrate the schema in production?** — in standalone mode the schema is not
auto-migrated: generate and push it before deploying. See [Troubleshooting](#troubleshooting).

## Upgrading

### 2.x → 3.0

1. **Rotate the secret of every webhook endpoint.** The legacy transport sent it in clear in
   `X-Webhook-Secret` on every delivery. Subscribers must now verify `X-Webhook-Signature`.
2. **Set `OLLAMA_API_URL`** before restarting if you use `provider: 'ollama'` — the hard-coded
   fallback host is gone and its absence is now a hard error.
3. **Move any integration that authenticated as a portal client** to a staff account or to a
   server-side call with `overrideAccess: true`: client writes are scoped and allow-listed now.
4. **Recompute `tickets.totalTimeMinutes`** where time entries were deleted under 2.x. The new
   `afterDelete` hook only fires on future deletions, and the CRM now trusts the rollup instead of
   recomputing it — so a stale total keeps over-billing until something touches a time entry on that
   ticket.
5. **Import `./views` and `./components/TicketConversation` with ESM** — their CJS builds are gone.
6. Check your platform: Node 20.9+, React 19, Next 15.2.9+, Payload 3.37+, and install
   `lucide-react` explicitly if you were relying on it being optional.

### 1.x → 2.0

1. Generate an additive Payload migration for the `support-counters` collection and, when
   `rateLimitStore: 'payload'` is enabled, `support-rate-limits`. Run it before restart.
2. Regenerate the Payload types and the admin import map.
3. Remove duplicated host routes and enable the plugin endpoints (`skipEndpoints: false`).
4. Read portal authentication exclusively from the `HttpOnly` cookie. Login, OAuth and 2FA responses
   no longer expose the JWT in JSON.
5. Send cron and webhook secrets only through their configured headers. Query-string secrets are
   rejected.
6. Custom rate-limit stores must implement the asynchronous `RateLimitStore` interface.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'feat: add AmazingFeature'`).
4. Push the branch and open a Pull Request.

Run the checks before submitting — the suite is 179 vitest tests:

```bash
pnpm typecheck && pnpm test && pnpm build
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Support

If this plugin saves you time, consider [buying me a coffee](https://buymeacoffee.com/pown3d).

## License

MIT — see [LICENSE](LICENSE).

Built and maintained by [ConsilioWEB](https://consilioweb.fr) ·
[Issues](https://github.com/pOwn3d/payload-support/issues) ·
[npm](https://www.npmjs.com/package/@consilioweb/payload-support)
