import type { Page } from '@playwright/test'

// WireMock instance URLs for Docker environment
// Backend uses Docker network hostnames to communicate with WireMock
export const WIREMOCK_1_URL = 'http://wiremock-1:8080'
export const WIREMOCK_2_URL = 'http://wiremock-2:8080'

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
