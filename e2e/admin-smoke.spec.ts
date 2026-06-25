import { test, expect } from '@playwright/test'
import { loginToAdmin, openSupportView } from './helpers'

/**
 * Browser-driven smoke test of the support admin. Runs against a host Payload
 * app that has `supportPlugin()` installed (see playwright.config.ts).
 *
 * These tests are skipped automatically unless E2E_BASE_URL is set, so the
 * unit/integration suite stays runnable without a live admin.
 */
const enabled = !!process.env.E2E_BASE_URL
test.describe(enabled ? 'support admin (E2E)' : 'support admin (E2E — skipped, set E2E_BASE_URL)', () => {
  test.skip(!enabled, 'Set E2E_BASE_URL to a running Payload admin to enable E2E tests.')

  test('admin login succeeds', async ({ page }) => {
    await loginToAdmin(page)
    await expect(page).toHaveURL(/\/admin(\/|$)/)
  })

  test('support inbox view renders', async ({ page }) => {
    await loginToAdmin(page)
    await openSupportView(page, 'inbox')
    // The inbox view should not surface a Payload "not found" / error boundary.
    await expect(page.locator('text=/404|not found/i')).toHaveCount(0)
  })

  test('support dashboard view renders', async ({ page }) => {
    await loginToAdmin(page)
    await openSupportView(page, 'dashboard')
    await expect(page.locator('text=/404|not found/i')).toHaveCount(0)
  })

  test('tickets collection is registered', async ({ page }) => {
    await loginToAdmin(page)
    await page.goto('/admin/collections/tickets')
    await expect(page.locator('text=/404|not found/i')).toHaveCount(0)
  })
})
