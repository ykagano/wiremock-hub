import { test, expect } from '@playwright/test';
import { WIREMOCK_1_URL, WIREMOCK_2_URL, cleanupProject, clearLocalStorage } from './helpers';

test.describe('Recording', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context);
    await page.goto('/');
  });

  test('should display initial state and validate target URL input', async ({ page }) => {
    const testProjectName = `Recording Init Test ${Date.now()}`;

    // Ensure WireMock recording is stopped
    await page.request.post('http://localhost:8091/__admin/recordings/stop');

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
      .fill('Recording Instance');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(page.locator('.el-card', { hasText: 'Recording Instance' })).toBeVisible({
      timeout: 10000
    });

    // Navigate to Recording page via sidebar
    await page
      .locator('.el-aside')
      .getByText(/レコーディング|Recording/)
      .click();
    await expect(page.getByRole('heading', { name: /レコーディング|Recording/ })).toBeVisible({
      timeout: 10000
    });

    // ========== Verify initial state ==========
    // Verify recording status is displayed (NeverStarted or Stopped)
    await expect(
      page.locator('.el-tag', { hasText: /未開始|Never Started|停止|Stopped/ })
    ).toBeVisible({ timeout: 10000 });

    // Verify description alert is shown
    await expect(page.locator('.el-alert')).toBeVisible();

    // Verify target URL input is shown
    const targetUrlInput = page.getByPlaceholder(/https:\/\/api\.example\.com/);
    await expect(targetUrlInput).toBeVisible();

    // Verify start recording button is shown and disabled (no URL entered)
    const startButton = page
      .getByRole('button', { name: /レコーディング開始|Start Recording/ })
      .first();
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeDisabled();

    // Verify start all button is shown and disabled
    const startAllButton = page.getByRole('button', {
      name: /全インスタンスでレコーディング開始|Start Recording on All/
    });
    await expect(startAllButton).toBeVisible();
    await expect(startAllButton).toBeDisabled();

    // ========== Verify URL validation ==========
    // Enter target URL - buttons should become enabled
    await targetUrlInput.fill('http://wiremock-1:8080');
    await expect(startButton).toBeEnabled();
    await expect(startAllButton).toBeEnabled();

    // Clear target URL - buttons should become disabled again
    await targetUrlInput.fill('');
    await expect(startButton).toBeDisabled();
    await expect(startAllButton).toBeDisabled();

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should start and stop recording', async ({ page, request }) => {
    const testProjectName = `Recording Start Stop ${Date.now()}`;

    // Ensure WireMock recording is stopped before test
    await request.post('http://localhost:8091/__admin/recordings/stop');

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
      .fill('Recording Test Instance');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(page.locator('.el-card', { hasText: 'Recording Test Instance' })).toBeVisible({
      timeout: 10000
    });

    // Navigate to Recording page
    await page
      .locator('.el-aside')
      .getByText(/レコーディング|Recording/)
      .click();
    await expect(page.getByRole('heading', { name: /レコーディング|Recording/ })).toBeVisible({
      timeout: 10000
    });

    // Wait for status to load
    await expect(
      page.locator('.el-tag', { hasText: /未開始|Never Started|停止|Stopped/ })
    ).toBeVisible({ timeout: 10000 });

    // Enter target URL (use WireMock 2 as target)
    const targetUrlInput = page.getByPlaceholder(/https:\/\/api\.example\.com/);
    await targetUrlInput.fill('http://wiremock-2:8080');

    // Start recording button should now be enabled
    const startButton = page
      .getByRole('button', { name: /レコーディング開始|Start Recording/ })
      .first();
    await expect(startButton).toBeEnabled();

    // Click start recording
    await startButton.click();

    // Verify success message
    await expect(
      page.getByText(/レコーディングを開始しました|Recording started/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify status changed to Recording
    await expect(
      page.locator('.status-row .el-tag', { hasText: /レコーディング中|Recording/ })
    ).toBeVisible({ timeout: 10000 });

    // Verify stop recording button is now shown
    const stopButton = page
      .getByRole('button', { name: /レコーディング停止|Stop Recording/ })
      .first();
    await expect(stopButton).toBeVisible();

    // Verify target URL input is hidden during recording
    await expect(targetUrlInput).not.toBeVisible();

    // Click stop recording
    await stopButton.click();

    // Verify success message
    await expect(
      page.getByText(/レコーディングを停止しました|Recording stopped/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify status changed to Stopped
    await expect(page.locator('.el-tag', { hasText: /停止|Stopped/ })).toBeVisible({
      timeout: 10000
    });

    // Verify start recording button is shown again
    await expect(
      page.getByRole('button', { name: /レコーディング開始|Start Recording/ }).first()
    ).toBeVisible();

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should start and stop recording on all instances', async ({ page, request }) => {
    const testProjectName = `Recording All ${Date.now()}`;

    // Ensure WireMock recordings are stopped before test
    await request.post('http://localhost:8091/__admin/recordings/stop');
    await request.post('http://localhost:8092/__admin/recordings/stop');

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

    // Add instance 1
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Instance 1');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(page.locator('.el-card', { hasText: 'Instance 1' })).toBeVisible({
      timeout: 10000
    });

    // Add instance 2
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Instance 2');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(page.locator('.el-card', { hasText: 'Instance 2' })).toBeVisible({
      timeout: 10000
    });

    // Navigate to Recording page
    await page
      .locator('.el-aside')
      .getByText(/レコーディング|Recording/)
      .click();
    await expect(page.getByRole('heading', { name: /レコーディング|Recording/ })).toBeVisible({
      timeout: 10000
    });

    // Wait for status to load
    await expect(
      page.locator('.el-tag', { hasText: /未開始|Never Started|停止|Stopped/ })
    ).toBeVisible({ timeout: 10000 });

    // Enter target URL
    const targetUrlInput = page.getByPlaceholder(/https:\/\/api\.example\.com/);
    await targetUrlInput.fill('http://wiremock-2:8080');

    // Click start recording on all instances
    const startAllButton = page.getByRole('button', {
      name: /全インスタンスでレコーディング開始|Start Recording on All/
    });
    await expect(startAllButton).toBeEnabled();
    await startAllButton.click();

    // Verify success message (should show success count)
    await expect(
      page
        .getByText(
          /全インスタンスでレコーディングを開始しました|Recording started on all instances/i
        )
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Verify status changed to Recording
    await expect(
      page.locator('.status-row .el-tag', { hasText: /レコーディング中|Recording/ })
    ).toBeVisible({ timeout: 10000 });

    // Verify stop all button is now shown
    const stopAllButton = page.getByRole('button', {
      name: /全インスタンスでレコーディング停止|Stop Recording on All/
    });
    await expect(stopAllButton).toBeVisible();

    // Click stop recording on all instances
    await stopAllButton.click();

    // Verify success message
    await expect(
      page
        .getByText(
          /全インスタンスでレコーディングを停止しました|Recording stopped on all instances/i
        )
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Verify status changed to Stopped
    await expect(page.locator('.el-tag', { hasText: /停止|Stopped/ })).toBeVisible({
      timeout: 10000
    });

    // Verify start all button is shown again
    await expect(
      page.getByRole('button', {
        name: /全インスタンスでレコーディング開始|Start Recording on All/
      })
    ).toBeVisible();

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should display proxied response body correctly in request log', async ({
    page,
    request
  }) => {
    const testProjectName = `Recording Body Test ${Date.now()}`;

    // Ensure WireMock recordings are stopped
    await request.post('http://localhost:8091/__admin/recordings/stop');
    await request.post('http://localhost:8092/__admin/recordings/stop');

    // Register a stub directly on WireMock-2 (the proxy target)
    await request.post('http://localhost:8092/__admin/mappings', {
      data: {
        request: { method: 'GET', urlPath: '/api/recording-body-test' },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { message: 'proxied response body test', status: 'ok' }
        }
      }
    });

    // Create project with WireMock-1 instance
    await page
      .locator('.page-header')
      .getByRole('button', { name: /プロジェクト追加|Add Project/ })
      .click();
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();

    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Recording Body Instance');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(
      page.locator('.el-card', { hasText: 'Recording Body Instance' })
    ).toBeVisible({ timeout: 10000 });

    // Navigate to Recording page and start recording
    await page
      .locator('.el-aside')
      .getByText(/レコーディング|Recording/)
      .click();
    await expect(
      page.getByRole('heading', { name: /レコーディング|Recording/ })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('.el-tag', { hasText: /未開始|Never Started|停止|Stopped/ })
    ).toBeVisible({ timeout: 10000 });

    // Enter target URL and start recording
    const targetUrlInput = page.getByPlaceholder(/https:\/\/api\.example\.com/);
    await targetUrlInput.fill('http://wiremock-2:8080');
    const startButton = page
      .getByRole('button', { name: /レコーディング開始|Start Recording/ })
      .first();
    await startButton.click();
    await expect(
      page.getByText(/レコーディングを開始しました|Recording started/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Make a proxied request through WireMock-1 → WireMock-2
    await request.get('http://localhost:8091/api/recording-body-test');

    // Stop recording
    const stopButton = page
      .getByRole('button', { name: /レコーディング停止|Stop Recording/ })
      .first();
    await stopButton.click();
    await expect(
      page.getByText(/レコーディングを停止しました|Recording stopped/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Navigate to request log page
    await page
      .locator('.el-aside')
      .getByText(/リクエストログ|Request Log/)
      .click();
    await page.waitForTimeout(1000);

    // Verify the proxied request appears in the log
    await expect(
      page.locator('code', { hasText: '/api/recording-body-test' }).first()
    ).toBeVisible({ timeout: 10000 });

    // Click detail to view the request
    const requestRow = page
      .locator('.el-table__row:visible', { hasText: '/api/recording-body-test' })
      .first();
    await requestRow.getByRole('button', { name: /詳細|Detail/ }).click();

    // Verify we're on the detail page
    await expect(page.getByRole('button', { name: /戻る|Back/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('/api/recording-body-test')).toBeVisible({ timeout: 10000 });

    // Verify response body is displayed correctly (not garbled)
    await expect(
      page.locator('.body-content', { hasText: 'proxied response body test' })
    ).toBeVisible({ timeout: 5000 });

    // Clean up: delete stub on WireMock-2 and project
    await request.post('http://localhost:8092/__admin/mappings/reset');
    await cleanupProject(page, testProjectName);
  });

  test('should show no instances message', async ({ page }) => {
    const testProjectName = `Recording No Instances ${Date.now()}`;

    // Create project without instances
    await page
      .locator('.page-header')
      .getByRole('button', { name: /プロジェクト追加|Add Project/ })
      .click();
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();

    // Go to project detail (to select the project)
    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();
    await expect(page.getByRole('heading', { name: testProjectName })).toBeVisible({
      timeout: 10000
    });

    // Navigate to Recording page
    await page
      .locator('.el-aside')
      .getByText(/レコーディング|Recording/)
      .click();
    await expect(page.getByRole('heading', { name: /レコーディング|Recording/ })).toBeVisible({
      timeout: 10000
    });

    // Verify empty state
    await expect(
      page.locator('.el-empty', { hasText: /インスタンスがありません|No instances/ })
    ).toBeVisible({ timeout: 10000 });

    // Clean up
    await cleanupProject(page, testProjectName);
  });
});
