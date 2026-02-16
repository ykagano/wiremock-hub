import type { Page } from '@playwright/test'

// WireMock instance URLs for Docker environment
// Backend uses Docker network hostnames to communicate with WireMock
export const WIREMOCK_1_URL = 'http://wiremock-1:8080'
export const WIREMOCK_2_URL = 'http://wiremock-2:8080'

// localStorage keys (must match frontend constants)
export const LOCALE_KEY = 'wiremock-hub-locale'
export const THEME_KEY = 'wiremock-hub-theme'
export const SKIP_SYNC_ALL_CONFIRM_KEY = 'wiremock-hub-skip-sync-all-confirm'
export const SKIP_SYNC_CONFIRM_KEY = 'wiremock-hub-skip-sync-confirm'

// All localStorage keys used by the app
const ALL_KEYS = [LOCALE_KEY, THEME_KEY, SKIP_SYNC_ALL_CONFIRM_KEY, SKIP_SYNC_CONFIRM_KEY]

// Clear specified localStorage keys via addInitScript
// Usage: await clearLocalStorage(context, [LOCALE_KEY, THEME_KEY])
// Pass no keys to clear all app keys
export async function clearLocalStorage(
  context: { addInitScript: (script: { path?: string } | ((keys: string[]) => void), arg?: string[]) => Promise<void> },
  keys: string[] = ALL_KEYS
) {
  await context.addInitScript((keys) => {
    keys.forEach((key) => localStorage.removeItem(key))
  }, keys)
}

// Set SKIP_CLEANUP=true to skip cleanup (for debugging/inspection)
export const SKIP_CLEANUP = process.env.SKIP_CLEANUP === 'true'

// Extract project ID from the current page URL
export async function getProjectIdFromUrl(page: Page): Promise<string> {
  const url = page.url()
  const match = url.match(/\/projects\/([^/]+)/)
  return match ? match[1] : ''
}

// Delete a project by name for test cleanup
export async function cleanupProject(page: Page, projectName: string) {
  if (SKIP_CLEANUP) {
    console.log(`Skipping cleanup for project: ${projectName}`)
    return
  }
  await page.goto('/projects')
  const card = page.locator('.el-card', { hasText: projectName })
  await card.locator('.el-dropdown').click()
  await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
  await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()
}
