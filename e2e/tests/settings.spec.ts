import { test, expect } from '@playwright/test';
import { LOCALE_KEY, THEME_KEY } from './helpers';

test.describe('Settings', () => {
  // NOTE: Do NOT use addInitScript (clearLocalStorage) here.
  // addInitScript runs on every page.goto() / reload(), which would
  // clear localStorage on navigation and break persistence tests.
  // Playwright creates a fresh BrowserContext per test, so localStorage
  // is already empty without explicit clearing.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should switch language and persist across reload', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible();

    // Switch to English
    await page.locator('label', { hasText: 'English' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

    // Switch to Japanese
    await page.locator('label', { hasText: '日本語' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /設定/ })).toBeVisible();

    // Switch back to English and verify persistence
    await page.locator('label', { hasText: 'English' }).click();
    await page.waitForTimeout(500);
    const storedLocale = await page.evaluate((key) => localStorage.getItem(key), LOCALE_KEY);
    expect(storedLocale).toBe('en');

    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();
  });

  test('should switch, sync, and persist theme', async ({ page }) => {
    const segmented = page.locator('.app-header .el-segmented');
    const activeItem = segmented.locator('.el-segmented__item.is-selected');

    // 1. Default should be System
    await expect(activeItem).toContainText(/システム|System/);

    // 2. Switch to Dark via header, verify dark class and CSS variable
    await segmented.getByText(/ダーク|Dark/).click();
    await page.waitForTimeout(500);
    expect(await page.locator('html').getAttribute('class')).toContain('dark');
    await expect(activeItem).toContainText(/ダーク|Dark/);
    const sidebarBgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--wh-sidebar-bg').trim()
    );
    expect(sidebarBgDark).toBe('#1d1e1f');

    // 3. Switch to Light via header, verify no dark class and CSS variable
    await segmented.getByText(/ライト|Light/).click();
    await page.waitForTimeout(500);
    expect((await page.locator('html').getAttribute('class')) || '').not.toContain('dark');
    await expect(activeItem).toContainText(/ライト|Light/);
    const sidebarBgLight = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--wh-sidebar-bg').trim()
    );
    expect(sidebarBgLight).toBe('#f5f7fa');

    // 4. Switch back to System, verify active item
    await segmented.getByText(/システム|System/).click();
    await page.waitForTimeout(500);
    await expect(activeItem).toContainText(/システム|System/);

    // 5. Set Dark via header
    await segmented.getByText(/ダーク|Dark/).click();
    await page.waitForTimeout(500);

    // 6. Navigate to /settings, verify radio reflects dark
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible();
    const themeCard = page.locator('.el-card', { hasText: /テーマ|Theme/ });
    await expect(
      themeCard.locator('label', { hasText: /ダーク|Dark/ }).locator('input[type="radio"]')
    ).toBeChecked();

    // 7. Switch to Light via settings radio, verify header toggle updated and no dark class
    await themeCard.locator('label', { hasText: /ライト|Light/ }).click();
    await page.waitForTimeout(500);
    await expect(activeItem).toContainText(/ライト|Light/);
    expect((await page.locator('html').getAttribute('class')) || '').not.toContain('dark');

    // 8. Switch to Dark again via header
    await segmented.getByText(/ダーク|Dark/).click();
    await page.waitForTimeout(500);

    // 9. Verify localStorage has 'dark'
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('dark');

    // 10. Navigate to /settings, verify dark class persists
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /設定|Settings/ })).toBeVisible();
    expect((await page.locator('html').getAttribute('class')) || '').toContain('dark');

    // 11. Navigate to /projects, verify dark class persists
    await page.goto('/projects');
    await page.waitForTimeout(500);
    expect((await page.locator('html').getAttribute('class')) || '').toContain('dark');

    // 12. Reload, verify dark class persists and header toggle shows Dark
    await page.reload();
    await page.waitForTimeout(500);
    expect((await page.locator('html').getAttribute('class')) || '').toContain('dark');
    await expect(activeItem).toContainText(/ダーク|Dark/);
  });
});
