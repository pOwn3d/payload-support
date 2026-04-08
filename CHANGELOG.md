# Changelog

## [0.2.0] - 2026-04-08

### Added
- Server-Sent Events (SSE) for live chat (client + admin streams)
- Automatic SSE to polling fallback when EventSource unavailable
- Webhook dispatch on ticket events (created, resolved, assigned, replied)
- SLA auto-calculation on ticket creation
- Scheduled replies processing endpoint (POST /support/process-scheduled)
- `requireAdmin` / `requireClient` auth helpers (replaces repetitive checks)
- `RateLimiter` class (unified, replaces 6 duplicate implementations)
- `escapeHtml` utility (deduplicated from 3 files)
- `generateTrackingToken` HMAC for tracking pixels
- `allowedEmailDomains` option for OAuth Google registration
- HMAC-SHA256 hashing for 2FA codes
- Rate limiting on chatbot endpoint
- Collection injection protection
- Ticket number retry on unique constraint collision
- Conditional collection creation based on feature flags
- Conditional endpoint registration based on feature flags
- Batch delete for cascade operations
- JSON body parsing with proper error handling
- AuthLogs feature flag

### Changed
- Chat identity check uses collection instead of 'company' field
- Access control uses configurable slugs instead of hardcoded 'users'
- Email templates use escapeHtml on all dynamic fields
- PendingEmails create requires auth or webhook secret
- EmailLogs/AuthLogs restricted to admin access
- Password generation uses crypto.randomBytes (not Math.random)
- Catch blocks in client components log warnings

### Security
- XSS prevention in all email templates
- 2FA codes hashed before storage
- Tracking pixels signed with HMAC
- OAuth Google domain restriction option

## [0.1.0] - 2026-04-08

### Added
- Initial project scaffold and plugin structure
- `supportPlugin()` factory function with full config interface
- Type definitions for all 15 collections
- Feature flags system (25+ toggleable features)
- AI provider abstraction (Anthropic, OpenAI, Ollama, custom)
- Plugin config: locale, basePath, collectionSlugs overrides
- Admin views registration (12 views) with basePath support
- tsup build config (ESM + CJS + DTS, 3 entry points)
- README with full documentation

### Note
This is the initial scaffold — collections, hooks, components, and views
are being progressively extracted from ConsilioWEB into this package.
