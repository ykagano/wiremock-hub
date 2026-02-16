import { test, expect } from '@playwright/test'
import { LOCALE_KEY, THEME_KEY, clearLocalStorage } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context, [LOCALE_KEY, THEME_KEY])
    await page.goto('/')
  })

  test('should switch language and persist across reload', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible()

    // Switch to English
    await page.locator('label', { hasText: 'English' }).click()
    await page.waitForTimeout(500)
    await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible()

    // Switch to Japanese
    await page.locator('label', { hasText: '日本語' }).click()
    await page.waitForTimeout(500)
    await expect(page.getByRole('heading', { name: /設定/ })).toBeVisible()

    // Switch back to English and verify persistence
    await page.locator('label', { hasText: 'English' }).click()
    await page.waitForTimeout(500)
    const storedLocale = await page.evaluate((key) => localStorage.getItem(key), LOCALE_KEY)
    expect(storedLocale).toBe('en')

    await page.reload()
    await page.waitForTimeout(500)
    await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible()
  })

  test('should switch theme between system, dark and light via header', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')
    const activeItem = segmented.locator('.el-segmented__item.is-selected')

    // Default should be System
    await expect(activeItem).toContainText(/システム|System/)

    // Switch to Dark
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)
    expect(await page.locator('html').getAttribute('class')).toContain('dark')
    await expect(activeItem).toContainText(/ダーク|Dark/)

    // Verify dark CSS variables
    const sidebarBgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--wh-sidebar-bg').trim()
    )
    expect(sidebarBgDark).toBe('#1d1e1f')

    // Switch to Light
    await segmented.getByText(/ライト|Light/).click()
    await page.waitForTimeout(500)
    expect(await page.locator('html').getAttribute('class') || '').not.toContain('dark')
    await expect(activeItem).toContainText(/ライト|Light/)

    // Verify light CSS variables
    const sidebarBgLight = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--wh-sidebar-bg').trim()
    )
    expect(sidebarBgLight).toBe('#f5f7fa')

    // Switch back to System
    await segmented.getByText(/システム|System/).click()
    await page.waitForTimeout(500)
    await expect(activeItem).toContainText(/システム|System/)
  })

  test('should sync theme between header toggle and settings page', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')
    const activeItem = segmented.locator('.el-segmented__item.is-selected')

    // Set dark via header
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)

    // Navigate to settings and verify radio reflects dark
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible()
    const themeCard = page.locator('.el-card', { hasText: /テーマ|Theme/ })
    await expect(themeCard.locator('label', { hasText: /ダーク|Dark/ }).locator('input[type="radio"]')).toBeChecked()

    // Switch to light via settings radio
    await themeCard.locator('label', { hasText: /ライト|Light/ }).click()
    await page.waitForTimeout(500)

    // Verify header toggle updated
    await expect(activeItem).toContainText(/ライト|Light/)
    expect(await page.locator('html').getAttribute('class') || '').not.toContain('dark')
  })

  test('should persist theme across navigation and reload', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')

    // Switch to dark
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('dark')

    // Navigate to settings - theme persists
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible()
    expect(await page.locator('html').getAttribute('class')).toContain('dark')

    // Navigate to projects - theme persists
    await page.goto('/projects')
    await page.waitForTimeout(500)
    expect(await page.locator('html').getAttribute('class')).toContain('dark')

    // Reload - theme persists
    await page.reload()
    await page.waitForTimeout(500)
    expect(await page.locator('html').getAttribute('class')).toContain('dark')
    const activeItem = page.locator('.app-header .el-segmented .el-segmented__item.is-selected')
    await expect(activeItem).toContainText(/ダーク|Dark/)
  })
})
