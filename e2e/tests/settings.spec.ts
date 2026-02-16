import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear theme and locale preferences before each test
    await context.addInitScript(() => {
      localStorage.removeItem('wiremock-hub-theme')
      localStorage.removeItem('wiremock-hub-locale')
    })
    await page.goto('/')
  })

  // --- Language ---

  test('should switch language', async ({ page }) => {
    await page.goto('/settings')

    // Wait for settings page to load
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible()

    // Check if language can be switched
    const englishRadio = page.locator('label', { hasText: 'English' })
    const japaneseRadio = page.locator('label', { hasText: '日本語' })

    if (await englishRadio.isVisible()) {
      await englishRadio.click()
      await page.waitForTimeout(500)
      await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible()
    }

    if (await japaneseRadio.isVisible()) {
      await japaneseRadio.click()
      await page.waitForTimeout(500)
      await expect(page.getByRole('heading', { name: /設定/ })).toBeVisible()
    }
  })

  test('should persist language across page reload', async ({ page }) => {
    await page.goto('/settings')

    // Switch to English
    const englishRadio = page.locator('label', { hasText: 'English' })
    await englishRadio.click()
    await page.waitForTimeout(500)

    // Verify localStorage was updated
    const storedLocale = await page.evaluate(() => localStorage.getItem('wiremock-hub-locale'))
    expect(storedLocale).toBe('en')

    // Reload the page
    await page.reload()
    await page.waitForTimeout(500)

    // Verify language persists
    await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible()
  })

  // --- Theme ---

  test('should default to system theme when no preference stored', async ({ page }) => {
    // Verify the segmented control in the header shows System as active
    const segmented = page.locator('.app-header .el-segmented')
    await expect(segmented).toBeVisible()

    // The active item should be System
    const activeItem = segmented.locator('.el-segmented__item.is-selected')
    await expect(activeItem).toContainText(/システム|System/)
  })

  test('should switch to dark mode via header toggle', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')
    await expect(segmented).toBeVisible()

    // Click Dark option
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)

    // Verify dark class is applied to html element
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')

    // Verify the dark option is now selected
    const activeItem = segmented.locator('.el-segmented__item.is-selected')
    await expect(activeItem).toContainText(/ダーク|Dark/)
  })

  test('should switch to light mode via header toggle', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')

    // First switch to dark
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)

    // Then switch to light
    await segmented.getByText(/ライト|Light/).click()
    await page.waitForTimeout(500)

    // Verify dark class is NOT on html element
    const htmlClass = await page.locator('html').getAttribute('class') || ''
    expect(htmlClass).not.toContain('dark')

    // Verify the light option is now selected
    const activeItem = segmented.locator('.el-segmented__item.is-selected')
    await expect(activeItem).toContainText(/ライト|Light/)
  })

  test('should switch theme via settings page radio buttons', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible()

    // Find the theme card
    const themeCard = page.locator('.el-card', { hasText: /テーマ|Theme/ })
    await expect(themeCard).toBeVisible()

    // Click Dark radio
    await themeCard.locator('label', { hasText: /ダーク|Dark/ }).click()
    await page.waitForTimeout(500)

    // Verify dark class is applied
    const htmlClassDark = await page.locator('html').getAttribute('class')
    expect(htmlClassDark).toContain('dark')

    // Click Light radio
    await themeCard.locator('label', { hasText: /ライト|Light/ }).click()
    await page.waitForTimeout(500)

    // Verify dark class is removed
    const htmlClassLight = await page.locator('html').getAttribute('class') || ''
    expect(htmlClassLight).not.toContain('dark')
  })

  test('should persist theme across page navigation', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')

    // Switch to dark mode
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)

    // Navigate to settings page
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible()

    // Verify dark mode is still active
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')

    // Verify settings page radio also reflects dark mode
    const themeCard = page.locator('.el-card', { hasText: /テーマ|Theme/ })
    const darkRadio = themeCard.locator('label', { hasText: /ダーク|Dark/ })
    await expect(darkRadio.locator('input[type="radio"]')).toBeChecked()

    // Navigate back to projects page
    await page.goto('/projects')
    await page.waitForTimeout(500)

    // Verify dark mode persists
    const htmlClassAfterNav = await page.locator('html').getAttribute('class')
    expect(htmlClassAfterNav).toContain('dark')

    // Verify header segmented control still shows dark as selected
    const activeItem = page.locator('.app-header .el-segmented .el-segmented__item.is-selected')
    await expect(activeItem).toContainText(/ダーク|Dark/)
  })

  test('should persist theme across page reload', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')

    // Switch to dark mode
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)

    // Verify localStorage was updated
    const storedTheme = await page.evaluate(() => localStorage.getItem('wiremock-hub-theme'))
    expect(storedTheme).toBe('dark')

    // Reload the page
    await page.reload()
    await page.waitForTimeout(500)

    // Verify dark mode is still active after reload
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')

    // Verify the header toggle still shows dark
    const activeItem = page.locator('.app-header .el-segmented .el-segmented__item.is-selected')
    await expect(activeItem).toContainText(/ダーク|Dark/)
  })

  test('should sync header toggle and settings page', async ({ page }) => {
    // Set dark mode via header
    const segmented = page.locator('.app-header .el-segmented')
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)

    // Navigate to settings
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible()

    // Verify settings page shows dark as selected
    const themeCard = page.locator('.el-card', { hasText: /テーマ|Theme/ })
    const darkRadio = themeCard.locator('label', { hasText: /ダーク|Dark/ })
    await expect(darkRadio.locator('input[type="radio"]')).toBeChecked()

    // Switch to light via settings page
    await themeCard.locator('label', { hasText: /ライト|Light/ }).click()
    await page.waitForTimeout(500)

    // Verify header toggle also shows light
    const activeItem = page.locator('.app-header .el-segmented .el-segmented__item.is-selected')
    await expect(activeItem).toContainText(/ライト|Light/)

    // Verify dark class is removed
    const htmlClass = await page.locator('html').getAttribute('class') || ''
    expect(htmlClass).not.toContain('dark')
  })

  test('should apply correct CSS variables in dark mode', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented')

    // Switch to dark mode
    await segmented.getByText(/ダーク|Dark/).click()
    await page.waitForTimeout(500)

    // Verify dark CSS variables are applied
    const sidebarBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--wh-sidebar-bg').trim()
    })
    expect(sidebarBg).toBe('#1d1e1f')

    const mainBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--wh-main-bg').trim()
    })
    expect(mainBg).toBe('#141414')

    // Switch to light mode
    await segmented.getByText(/ライト|Light/).click()
    await page.waitForTimeout(500)

    // Verify light CSS variables are applied
    const sidebarBgLight = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--wh-sidebar-bg').trim()
    })
    expect(sidebarBgLight).toBe('#f5f7fa')

    const mainBgLight = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--wh-main-bg').trim()
    })
    expect(mainBgLight).toBe('#ffffff')
  })
})
