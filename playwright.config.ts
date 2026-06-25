import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end UI test harness (browser-driven Payload admin).
 *
 * This plugin ships no host app, so the E2E suite runs against ANY Payload app
 * that has `supportPlugin()` installed. Point it at your app with env vars:
 *
 *   E2E_BASE_URL=http://localhost:3000 \
 *   E2E_ADMIN_EMAIL=admin@example.com \
 *   E2E_ADMIN_PASSWORD=secret \
 *   pnpm test:e2e
 *
 * To boot the host app automatically, set E2E_WEB_SERVER to the start command
 * (e.g. "pnpm --filter my-app dev") and Playwright will spin it up.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(process.env.E2E_WEB_SERVER
    ? {
        webServer: {
          command: process.env.E2E_WEB_SERVER,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
})
