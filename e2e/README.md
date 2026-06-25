# End-to-end UI test harness

Browser-driven tests for the support admin, powered by [Playwright](https://playwright.dev).

The plugin ships no host app, so these tests run against **any Payload app that has
`supportPlugin()` installed** — your own dev site, a staging environment, or a
disposable fixture app.

## One-time setup

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

## Run against a running admin

```bash
E2E_BASE_URL=http://localhost:3000 \
E2E_ADMIN_EMAIL=admin@example.com \
E2E_ADMIN_PASSWORD=secret \
pnpm test:e2e
```

If `E2E_BASE_URL` is **not** set, every E2E spec is skipped — so `pnpm test:e2e`
is safe to wire into CI even when no admin is available.

## Boot the host app automatically

Let Playwright start (and stop) your app:

```bash
E2E_BASE_URL=http://localhost:3000 \
E2E_WEB_SERVER="pnpm --filter my-payload-app dev" \
pnpm test:e2e
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | Admin base URL (also enables the suite) |
| `E2E_ADMIN_EMAIL` | `admin@example.com` | Admin login email |
| `E2E_ADMIN_PASSWORD` | `password` | Admin login password |
| `E2E_SUPPORT_BASE_PATH` | `/support` | Plugin `basePath` (custom views prefix) |
| `E2E_WEB_SERVER` | — | Command to boot the host app before tests |

## What's covered

`admin-smoke.spec.ts` drives a real browser through:

- Admin login
- The custom **Inbox** and **Dashboard** support views
- The `tickets` collection list

Extend `e2e/helpers.ts` with your own page objects to add deeper flows
(create a ticket, reply, change status, …).
