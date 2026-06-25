import { type Page, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'password'
const BASE_PATH = process.env.E2E_SUPPORT_BASE_PATH || '/support'

/** Log into the Payload admin using the standard email/password form. */
export async function loginToAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login')
  await page.fill('#field-email', ADMIN_EMAIL)
  await page.fill('#field-password', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin(\/|$)/)
}

/** Open one of the plugin's custom admin views (inbox, dashboard, settings…). */
export async function openSupportView(page: Page, view: string): Promise<void> {
  await page.goto(`/admin${BASE_PATH}/${view}`)
  await expect(page.locator('body')).toBeVisible()
}
