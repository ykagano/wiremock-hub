import { test, expect } from '@playwright/test';
import { WIREMOCK_1_URL, WIREMOCK_2_URL, cleanupProject, clearLocalStorage } from './helpers';

test.describe('WireMock Instance', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context);
    await page.goto('/');
  });

  test('should manage instance lifecycle', async ({ page }) => {
    const testProjectName = `Instance Lifecycle ${Date.now()}`;

    // Create project
    await page
      .locator('.page-header')
      .getByRole('button', { name: /プロジェクト追加|Add Project/ })
      .click();
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();

    // Verify Project ID is displayed (UUID format) and copy button works
    const projectIdCell = page.locator('.project-id-cell');
    await expect(projectIdCell).toBeVisible();
    const projectIdCode = projectIdCell.locator('span.project-id');
    await expect(projectIdCode).toBeVisible();
    const projectIdText = await projectIdCode.textContent();
    expect(projectIdText).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    await projectIdCell.locator('button').click();
    await expect(
      page.getByText(/プロジェクトIDをコピーしました|Project ID copied to clipboard/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Add instance
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Test Instance');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Verify instance was created
    await expect(page.locator('.el-card', { hasText: 'Test Instance' })).toBeVisible();

    // Wait for success message to disappear
    await page.waitForTimeout(1500);

    // Health check via dropdown
    const instanceCard = page.locator('.el-card', { hasText: 'Test Instance' });
    await instanceCard.locator('.el-dropdown').click();
    await page.getByRole('menuitem', { name: /ヘルスチェック|Health Check|接続確認/ }).click();
    await expect(page.getByText(/接続に成功|接続OK|Healthy|success/i).first()).toBeVisible({
      timeout: 10000
    });

    // Wait for success message to disappear
    await page.waitForTimeout(1500);

    // Edit instance: change name and URL via dropdown
    await instanceCard.locator('.el-dropdown').click();
    await page.getByRole('menuitem', { name: /編集|Edit/ }).click();
    const nameInput = page.locator('.el-dialog').getByLabel(/インスタンス名|Name/);
    await nameInput.clear();
    await nameInput.fill('Updated Instance');
    const urlInput = page.locator('.el-dialog').getByLabel(/URL/);
    await urlInput.clear();
    await urlInput.fill(WIREMOCK_2_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Verify instance was updated
    await expect(page.locator('.el-card', { hasText: 'Updated Instance' })).toBeVisible();
    await expect(page.locator('.el-card', { hasText: 'Test Instance' })).not.toBeVisible();
    await expect(page.locator('.instance-url', { hasText: WIREMOCK_2_URL })).toBeVisible();

    // Wait for success message to disappear
    await page.waitForTimeout(1500);

    // Delete instance via dropdown
    const updatedCard = page.locator('.el-card', { hasText: 'Updated Instance' });
    await updatedCard.locator('.el-dropdown').click();
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes|確認/ })
      .click();

    // Verify dialog closes and instance is deleted
    await expect(page.locator('.el-message-box')).not.toBeVisible();
    await expect(page.locator('.el-card', { hasText: 'Updated Instance' })).not.toBeVisible();

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should sync to individual instance', async ({ page, request }) => {
    const testProjectName = `Individual Sync Test ${Date.now()}`;

    // Create project
    await page
      .locator('.page-header')
      .getByRole('button', { name: /プロジェクト追加|Add Project/ })
      .click();
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();

    // Add two instances
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Sync Instance 1');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Sync Instance 2');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('/api/individual-sync-test');

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    const responseTextarea = page.getByPlaceholder('{"message": "success"}');
    await responseTextarea.fill('{"message": "Individual sync test"}');

    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(
      page.locator('.el-table__row', { hasText: '/api/individual-sync-test' })
    ).toBeVisible({ timeout: 10000 });

    // Navigate back to project detail
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click();
    await page.waitForTimeout(500);

    // Click Sync button on Instance 1 only
    const instance1Card = page.locator('.el-card', { hasText: 'Sync Instance 1' });
    await instance1Card.getByRole('button', { name: /同期|Sync/ }).click();

    // Confirm sync dialog and check "Don't show again"
    await expect(page.locator('.el-message-box')).toBeVisible();
    await page
      .locator('.el-message-box')
      .getByText(/以降表示しない|Don't show again/)
      .click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();

    // Wait for sync success message
    await expect(page.getByText(/同期完了|Sync completed/i).first()).toBeVisible({
      timeout: 15000
    });
    await page.waitForTimeout(1000);

    // Verify stub is accessible on Instance 1 (localhost:8081)
    const response1 = await request.get('http://localhost:8081/api/individual-sync-test');
    expect(response1.status()).toBe(200);
    const body1 = await response1.json();
    expect(body1.message).toBe('Individual sync test');

    // Verify stub is NOT synced to Instance 2 (localhost:8082)
    const response2 = await request.get('http://localhost:8082/api/individual-sync-test');
    expect(response2.status()).not.toBe(200);

    // Sync Instance 2 - confirmation dialog should be skipped due to "Don't show again"
    const instance2Card = page.locator('.el-card', { hasText: 'Sync Instance 2' });
    await instance2Card.getByRole('button', { name: /同期|Sync/ }).click();
    await expect(page.getByText(/同期完了|Sync completed/i).first()).toBeVisible({
      timeout: 15000
    });
    await page.waitForTimeout(1000);

    // Verify stub is now accessible on Instance 2
    const response3 = await request.get('http://localhost:8082/api/individual-sync-test');
    expect(response3.status()).toBe(200);

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should append to individual instance without resetting', async ({ page, request }) => {
    const testProjectName = `Individual Append Test ${Date.now()}`;

    // Create project
    await page
      .locator('.page-header')
      .getByRole('button', { name: /プロジェクト追加|Add Project/ })
      .click();
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();

    // Add instance
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Append Instance 1');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Navigate to stubs tab and create first stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('/api/append-test-1');

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    const responseTextarea = page.getByPlaceholder('{"message": "success"}');
    await responseTextarea.fill('{"message": "First stub"}');

    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/append-test-1' })).toBeVisible({
      timeout: 10000
    });

    // Navigate to project detail and sync first stub
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click();
    await page.waitForTimeout(500);

    const instance1Card = page.locator('.el-card', { hasText: 'Append Instance 1' });
    await instance1Card.getByRole('button', { name: /^(同期|Sync)$/ }).click();

    await expect(page.locator('.el-message-box')).toBeVisible();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();
    await expect(page.getByText(/同期完了|Sync completed/i).first()).toBeVisible({
      timeout: 15000
    });
    await page.waitForTimeout(1000);

    // Verify first stub is accessible
    const response1 = await request.get('http://localhost:8081/api/append-test-1');
    expect(response1.status()).toBe(200);

    // Create second stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput2 = page.getByPlaceholder('e.g. /api/users');
    await expect(urlInput2).toBeVisible();
    await urlInput2.fill('/api/append-test-2');

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    const responseTextarea2 = page.getByPlaceholder('{"message": "success"}');
    await responseTextarea2.fill('{"message": "Second stub"}');

    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/append-test-2' })).toBeVisible({
      timeout: 10000
    });

    // Navigate to project detail and use Append button (not Sync)
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click();
    await page.waitForTimeout(500);

    const instanceCard = page.locator('.el-card', { hasText: 'Append Instance 1' });
    await instanceCard.getByRole('button', { name: /^(追記|Append)$/ }).click();

    // Confirm append dialog
    await expect(page.locator('.el-message-box')).toBeVisible();
    await page
      .locator('.el-message-box')
      .getByText(/以降表示しない|Don't show again/)
      .click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();

    await expect(page.getByText(/追記完了|Append completed/i).first()).toBeVisible({
      timeout: 15000
    });
    await page.waitForTimeout(1000);

    // Verify both stubs are accessible (first was NOT reset, second was appended)
    const responseAfter1 = await request.get('http://localhost:8081/api/append-test-1');
    expect(responseAfter1.status()).toBe(200);
    const responseAfter2 = await request.get('http://localhost:8081/api/append-test-2');
    expect(responseAfter2.status()).toBe(200);

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should append to all instances from project detail', async ({ page, request }) => {
    const testProjectName = `Append All Test ${Date.now()}`;

    // Create project
    await page
      .locator('.page-header')
      .getByRole('button', { name: /プロジェクト追加|Add Project/ })
      .click();
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();

    // Add two instances
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Append All Instance 1');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Append All Instance 2');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('/api/append-all-test');

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    const responseTextarea = page.getByPlaceholder('{"message": "success"}');
    await responseTextarea.fill('{"message": "Append all test"}');

    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/append-all-test' })).toBeVisible({
      timeout: 10000
    });

    // Navigate to project detail and click "Append All Instances"
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click();
    await page.waitForTimeout(500);

    await page
      .locator('.section-header')
      .getByRole('button', { name: /全インスタンスに追記|Append All/ })
      .click();

    // Confirm dialog
    await expect(page.locator('.el-message-box')).toBeVisible();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();

    await expect(page.getByText(/追記完了|appended/i).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify stubs are accessible on both instances
    const response1 = await request.get('http://localhost:8081/api/append-all-test');
    expect(response1.status()).toBe(200);
    const response2 = await request.get('http://localhost:8082/api/append-all-test');
    expect(response2.status()).toBe(200);

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should validate instance form and handle errors', async ({ page }) => {
    const testProjectName = `Instance Validation ${Date.now()}`;

    // Create project
    await page
      .locator('.page-header')
      .getByRole('button', { name: /プロジェクト追加|Add Project/ })
      .click();
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();

    // Open instance add dialog
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();

    // Try to save without filling anything → validation error
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(page.locator('.el-form-item__error').first()).toBeVisible();

    // Fill name but leave URL empty → validation error
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Test Instance');
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(page.locator('.el-form-item__error').first()).toBeVisible();

    // Fill invalid URL format → validation error
    const urlInput = page.locator('.el-dialog').getByLabel(/URL/);
    await urlInput.fill('not-a-valid-url');
    await urlInput.blur();
    await page.waitForTimeout(500);
    await expect(page.locator('.el-form-item__error').first()).toBeVisible();

    // Fill valid URL → validation should pass
    await urlInput.clear();
    await urlInput.fill('http://valid-host:8080');
    await urlInput.blur();
    await page.waitForTimeout(500);

    // Close dialog
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /キャンセル|Cancel/ })
      .click();

    // Add instance with non-existent host
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Invalid Instance');
    await page.locator('.el-dialog').getByLabel(/URL/).fill('http://nonexistent-host:8080');
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Health check via dropdown → verify unhealthy/error message
    const instanceCard = page.locator('.el-card', { hasText: 'Invalid Instance' });
    await instanceCard.locator('.el-dropdown').click();
    await page.getByRole('menuitem', { name: /ヘルスチェック|Health Check|接続確認/ }).click();
    await expect(
      page.getByText(/接続に失敗|接続エラー|Unhealthy|エラー|failed/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Clean up
    await cleanupProject(page, testProjectName);
  });
});
