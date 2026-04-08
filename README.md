<!-- Header Banner -->
<div align="center">

  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&duration=3000&pause=1000&color=3B82F6&center=true&vCenter=true&width=700&lines=%40consilioweb%2Fpayload-support;Professional+Ticketing+for+Payload+CMS;AI+%7C+SLA+%7C+Time+Tracking+%7C+Live+Chat;15+Collections+%7C+34+API+Routes;Open-Source+%7C+MIT+License" alt="Typing SVG" />
  </a>

  <br><br>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge" alt="version">
  <img src="https://img.shields.io/badge/Payload%20CMS-3.x-0F172A?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMMTIgMjJMMjAgMTdWN0wxMiAyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=&logoColor=white" alt="Payload CMS 3">
  <img src="https://img.shields.io/badge/AI-Anthropic%20%7C%20OpenAI%20%7C%20Ollama-10B981?style=for-the-badge" alt="AI">
  <img src="https://img.shields.io/badge/i18n-FR%20%7C%20EN-F59E0B?style=for-the-badge&logo=translate&logoColor=white" alt="i18n FR | EN">
  <a href="https://github.com/pOwn3d/payload-support/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-7C3AED?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## About

> **@consilioweb/payload-support** — A complete, production-ready support & ticketing system for Payload CMS 3. Comparable to Freshdesk, HelpScout, and Crisp — but free, open-source, and fully integrated into Payload's admin panel.

<table>
  <tr>
    <td align="center" width="20%">
      <b>Ticketing</b><br>
      <sub>Auto-increment, SLA, priorities, categories</sub>
    </td>
    <td align="center" width="20%">
      <b>AI-Powered</b><br>
      <sub>Sentiment, synthesis, suggestions, rewrite</sub>
    </td>
    <td align="center" width="20%">
      <b>Time Tracking</b><br>
      <sub>Timer, entries, billing dashboard</sub>
    </td>
    <td align="center" width="20%">
      <b>Live Chat</b><br>
      <sub>Real-time, chat-to-ticket conversion</sub>
    </td>
    <td align="center" width="20%">
      <b>Modular</b><br>
      <sub>25+ feature flags, enable what you need</sub>
    </td>
  </tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Features

### Core Ticketing
- Auto-increment ticket numbers (TK-0001, TK-0002...)
- Statuses, priorities, categories, tags
- Multi-agent assignment with round-robin distribution
- Ticket merge, split, snooze
- Scheduled replies
- Bulk actions on multiple tickets
- Command palette (⌘K) for instant search

### AI Integration
- **Sentiment analysis** — detect client mood from messages
- **AI summary** — generate conversation synthesis
- **Smart reply** — suggest contextual responses
- **Rewrite** — rephrase messages professionally
- Multi-provider: Anthropic Claude, OpenAI, Ollama, custom endpoint
- AI chatbot for first-line self-service

### SLA & Compliance
- Response & resolution time targets per priority
- Business hours support
- SLA breach alerts on dashboard
- Webhook dispatch on `sla_breached` events

### Time Tracking & Billing
- Built-in timer with pause/resume
- Manual time entries per ticket
- Time dashboard with analytics
- Billing/invoicing foundation
- Facturable toggle per ticket

### Live Chat
- Real-time chat sessions
- Typing indicators
- Chat-to-ticket conversion
- Agent presence/collision detection

### Email Integration
- Inbound email → ticket/message (via webhook)
- Pending email queue with client matching
- Email pixel tracking (opens)
- Per-agent email signatures
- Email log viewer with purge

### Client Management (CRM)
- Client profiles with history
- Impersonation (view as client)
- Client merge
- Satisfaction surveys (CSAT 1-5)
- Knowledge base / FAQ
- Client portal (separate auth)

### Automation
- Auto-close inactive tickets
- Canned responses with template variables
- Macros (multi-action shortcuts)
- Webhooks (HMAC-SHA256 signed)
- Activity log (full audit trail)

### Internationalization
- Full FR/EN support
- Locale toggle in settings
- Extensible translation system

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Architecture

### Collections (15)

| Collection | Description |
|------------|-------------|
| `tickets` | Core ticket with auto-increment, SLA, activity hooks |
| `ticket-messages` | Conversation messages with author type, attachments |
| `support-clients` | Client auth collection (email/password) |
| `time-entries` | Time tracking per ticket |
| `canned-responses` | Quick reply templates with variables |
| `ticket-activity-log` | Immutable audit trail |
| `satisfaction-surveys` | CSAT ratings (1-5) |
| `knowledge-base` | FAQ articles with rich text |
| `chat-messages` | Live chat sessions |
| `pending-emails` | Inbound email queue |
| `email-logs` | Email delivery audit |
| `auth-logs` | Authentication audit |
| `webhook-endpoints` | Outbound webhook config |
| `sla-policies` | SLA rules per priority |
| `macros` | Multi-action shortcuts |
| `ticket-statuses` | Custom configurable statuses |

### API Endpoints (34)

| Category | Endpoints |
|----------|-----------|
| **Tickets** | search, bulk-action, merge-tickets, split-ticket, export-csv, export-data |
| **AI** | ai (sentiment/synthesis/suggest/rewrite), chatbot |
| **Chat** | chat, admin-chat, typing, presence |
| **Email** | pending-emails/process, resend-notification, track-open, email-stats |
| **Config** | settings, signature, round-robin-config, statuses, sla-check, auto-close |
| **Auth** | login, 2fa, oauth/google, delete-account |
| **Misc** | apply-macro, purge-logs, seed-kb, admin-stats, billing, import-conversation, merge-clients, satisfaction |

### Admin Views (12)

| View | Path | Description |
|------|------|-------------|
| Inbox | `/support/inbox` | Superhuman-style ticket list with keyboard nav |
| Dashboard | `/support/dashboard` | KPIs, SLA metrics, active tickets |
| Ticket Detail | `/support/ticket?id=X` | Full conversation with sidebar panels |
| New Ticket | `/support/new-ticket` | Create ticket with client search |
| Settings | `/support/settings` | Feature flags, AI, SLA, auto-close config |
| CRM | `/support/crm` | Client list and profiles |
| Chat | `/support/chat` | Live chat sessions |
| Pending Emails | `/support/emails` | Inbound email queue |
| Email Tracking | `/support/tracking` | Open/delivery tracking |
| Time Dashboard | `/support/time` | Time entries analytics |
| Logs | `/support/logs` | Email & auth audit logs |
| Billing | `/support/billing` | Invoice management |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Installation

```bash
pnpm add @consilioweb/payload-support
```

Or with npm/yarn:

```bash
npm install @consilioweb/payload-support
yarn add @consilioweb/payload-support
```

### Peer Dependencies

| Package | Version | Required |
|---------|---------|----------|
| `payload` | `^3.0.0` | **Yes** |
| `@payloadcms/next` | `^3.0.0` | Optional (admin views) |
| `@payloadcms/ui` | `^3.0.0` | Optional (admin UI) |
| `next` | `^14.0.0 \|\| ^15.0.0 \|\| ^16.0.0` | Optional (admin UI) |
| `react` | `^18.0.0 \|\| ^19.0.0` | Optional (admin UI) |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Quick Start

```ts
import { buildConfig } from 'payload'
import { supportPlugin } from '@consilioweb/payload-support'

export default buildConfig({
  // ... your existing config
  plugins: [
    supportPlugin({
      // All features enabled by default — disable what you don't need
      features: {
        chat: false,        // disable live chat
        billing: false,     // disable billing
        roundRobin: true,   // enable round-robin (off by default)
      },

      // AI provider (optional)
      ai: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
      },

      // Locale
      locale: 'fr',

      // Email
      email: {
        fromAddress: 'support@example.com',
        fromName: 'Support Team',
      },
    }),
  ],
})
```

### Next.js Configuration

Add the plugin to `transpilePackages` in your `next.config.mjs` so Next.js can resolve the view components:

```js
// next.config.mjs
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@consilioweb/payload-support'],
}

export default withPayload(nextConfig)
```

Then regenerate the import map:

```bash
pnpm generate:importmap
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Configuration

### `SupportPluginConfig`

```ts
supportPlugin({
  features: {},                    // Feature flags (see below)
  ai: { provider, apiKey, model }, // AI provider config
  email: { fromAddress, fromName, replyTo },
  locale: 'fr',                    // 'fr' | 'en'
  navGroup: 'Support',             // Sidebar group label
  basePath: '/support',            // Admin view base path
  userCollectionSlug: 'users',     // Agent collection slug
  collectionSlugs: {               // Override any collection slug
    tickets: 'my-tickets',
    ticketMessages: 'my-messages',
    // ...
  },
})
```

### Feature Flags (25+)

All features are **enabled by default** except `roundRobin` and `customStatuses`.

| Flag | Default | Description |
|------|---------|-------------|
| `timeTracking` | `true` | Timer, manual entries, billing |
| `ai` | `true` | Sentiment, synthesis, suggestion, rewrite |
| `satisfaction` | `true` | CSAT surveys after resolution |
| `chat` | `true` | Live chat sessions |
| `emailTracking` | `true` | Pixel tracking, open status |
| `canned` | `true` | Quick reply templates |
| `merge` | `true` | Merge two tickets |
| `snooze` | `true` | Temporarily hide ticket |
| `externalMessages` | `true` | Add external messages |
| `clientHistory` | `true` | Past tickets sidebar |
| `activityLog` | `true` | Audit trail |
| `splitTicket` | `true` | Extract message to new ticket |
| `scheduledReplies` | `true` | Future message sending |
| `autoClose` | `true` | Close inactive tickets |
| `autoCloseDays` | `7` | Days before auto-close |
| `roundRobin` | `false` | Distribute tickets to agents |
| `sla` | `true` | SLA policies & alerts |
| `webhooks` | `true` | Outbound HTTP hooks |
| `macros` | `true` | Multi-action shortcuts |
| `customStatuses` | `false` | Configurable ticket statuses |
| `collisionDetection` | `true` | Multi-agent collision warning |
| `signatures` | `true` | Per-agent email signatures |
| `chatbot` | `true` | AI self-service chatbot |
| `bulkActions` | `true` | Bulk ticket operations |
| `commandPalette` | `true` | ⌘K search |
| `knowledgeBase` | `true` | FAQ / knowledge base |
| `pendingEmails` | `true` | Inbound email queue |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## AI Providers

### Anthropic (Claude)

```ts
supportPlugin({
  ai: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-haiku-4-5-20251001', // fast & affordable
  },
})
```

### OpenAI

```ts
supportPlugin({
  ai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },
})
```

### Ollama (self-hosted)

```ts
supportPlugin({
  ai: {
    provider: 'ollama',
    baseUrl: 'https://ollama.example.com',
    model: 'qwen2.5:32b',
  },
})
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Package Exports

```ts
// Server — plugin, types, collections
import { supportPlugin, DEFAULT_FEATURES } from '@consilioweb/payload-support'
import type {
  SupportPluginConfig,
  SupportFeatures,
  AIProviderConfig,
  TicketData,
  MessageData,
} from '@consilioweb/payload-support'

// Client — React components for Payload admin
import { /* components */ } from '@consilioweb/payload-support/client'

// Views — server components wrapped in DefaultTemplate
import { /* views */ } from '@consilioweb/payload-support/views'
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Roadmap

- [x] Project scaffold & plugin structure
- [x] Full type system & feature flags (25+)
- [x] AI provider abstraction (Anthropic, OpenAI, Ollama)
- [x] Extract 16 collections with factory functions & dynamic slugs
- [x] Extract 13 admin views as standalone components
- [x] Extract 34 API endpoints as Payload plugin endpoints
- [x] CSS Modules design system with Payload theme vars (17 files)
- [x] TicketConversation module (10 components, 6 hooks, FR/EN locales)
- [x] Plugin settings UI (admin page with feature toggles)
- [x] `transpilePackages` documentation for Next.js
- [x] Next.js 14/15/16 support
- [ ] Client portal components (login, ticket list, chat widget)
- [ ] Email template system (customizable HTML templates)
- [ ] npm publish to registry

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## Requirements

- **Node.js** >= 18
- **Payload CMS** 3.x
- **React** 18.x or 19.x
- **Database**: Any Payload-supported adapter (SQLite, PostgreSQL, MongoDB)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

## License

[MIT](LICENSE)

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="line">

<div align="center">

### Author

**Made with passion by [ConsilioWEB](https://consilioweb.fr)**

<a href="https://www.linkedin.com/in/christophe-lopez/">
  <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn">
</a>
<a href="https://github.com/pOwn3d">
  <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
</a>
<a href="https://consilioweb.fr">
  <img src="https://img.shields.io/badge/Website-consilioweb.fr-3B82F6?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Website">
</a>

<br><br>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

</div>
