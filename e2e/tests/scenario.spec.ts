import { test, expect } from '@playwright/test';
import { WIREMOCK_1_URL, cleanupProject, clearLocalStorage, fillMonacoEditor } from './helpers';

// Helper: create a project and navigate to its detail page
async function createProjectAndNavigate(page: import('@playwright/test').Page, name: string) {
  await page
    .locator('.page-header')
    .getByRole('button', { name: /プロジェクト追加|Add Project/ })
    .click();
  await page.getByLabel(/プロジェクト名|Name/).fill(name);
  await page
    .locator('.el-dialog')
    .getByRole('button', { name: /保存|Save/ })
    .click();

  const projectCard = page.locator('.el-card', { hasText: name });
  await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);
}

// Helper: create a stub on the mappings page
async function createStub(
  page: import('@playwright/test').Page,
  url: string,
  responseBody: string
) {
  await page
    .getByRole('button', { name: /新規作成|Create New/ })
    .first()
    .click();
  await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
  await page.getByPlaceholder('e.g. /api/users').fill(url);
  await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
  await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
  await fillMonacoEditor(page, responseBody, '[data-testid="response-body"]');
  await page.getByRole('button', { name: /保存|Save/ }).click();
  await expect(page.locator('.el-table__row', { hasText: url })).toBeVisible({
    timeout: 10000
  });
}

test.describe('Scenario', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context);
    await page.goto('/');
  });

  test('should create scenario, add steps, and remove a step', async ({ page }) => {
    const ts = Date.now();
    const testProjectName = `Scenario Test ${ts}`;
    const scenarioName = `test-scenario-${ts}`;
    const testUrl1 = `/api/scenario1-${ts}`;
    const testUrl2 = `/api/scenario2-${ts}`;
    const testUrl3 = `/api/scenario3-${ts}`;

    await createProjectAndNavigate(page, testProjectName);

    // Create three stubs
    await page.goto('/mappings');
    await expect(page.getByRole('button', { name: /新規作成|Create New/ }).first()).toBeVisible({
      timeout: 10000
    });
    await createStub(page, testUrl1, '{"step": 1}');
    await createStub(page, testUrl2, '{"step": 2}');
    await createStub(page, testUrl3, '{"step": 3}');

    // Navigate to scenarios page and verify empty state
    await page.goto('/scenarios');
    await expect(page.locator('.scenarios-page h2')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/シナリオがありません|No scenarios/)).toBeVisible({
      timeout: 10000
    });

    // Try to create without name (validation)
    await page.getByRole('button', { name: /新規作成|Create New/ }).click();
    await expect(page.locator('.el-dialog')).toBeVisible();
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /新規作成|Create New/ })
      .click();
    await expect(page.getByText(/シナリオ名を入力|Scenario name is required/i)).toBeVisible();

    // Fill in scenario name and select first stub
    await page
      .locator('.el-dialog')
      .getByLabel(/シナリオ名|Scenario Name/)
      .fill(scenarioName);
    const stubItem = page.locator('.stub-select-list li', { hasText: testUrl1 });
    await stubItem.click();
    await expect(stubItem).toHaveClass(/selected/);

    // Create the scenario
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /新規作成|Create New/ })
      .click();

    // Verify scenario appears with flow
    await expect(page.locator('.scenario-name-list li', { hasText: scenarioName })).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('.detail-header h3', { hasText: scenarioName })).toBeVisible();
    await expect(page.locator('.step-card')).toHaveCount(1);
    await expect(page.locator('.state-name', { hasText: 'Started' })).toBeVisible();
    await expect(page.locator('.step-url', { hasText: testUrl1 })).toBeVisible();

    // Add second step
    await page.getByRole('button', { name: /ステップ追加|Add Step/ }).click();
    let addStepDialog = page.locator('.el-dialog').last();
    await expect(addStepDialog).toBeVisible();
    await addStepDialog.locator('.stub-select-list li', { hasText: testUrl2 }).click();
    await addStepDialog.getByRole('button', { name: /ステップ追加|Add Step/ }).click();
    await expect(page.locator('.step-card')).toHaveCount(2, { timeout: 10000 });

    // Add third step
    await page
      .getByRole('button', { name: /ステップ追加|Add Step/ })
      .first()
      .click();
    addStepDialog = page.locator('.el-dialog').last();
    await expect(addStepDialog).toBeVisible();
    await addStepDialog.locator('.stub-select-list li', { hasText: testUrl3 }).click();
    await addStepDialog.getByRole('button', { name: /ステップ追加|Add Step/ }).click();
    await expect(page.locator('.step-card')).toHaveCount(3, { timeout: 10000 });

    // Verify all three URLs are visible
    await expect(page.locator('.step-url', { hasText: testUrl1 })).toBeVisible();
    await expect(page.locator('.step-url', { hasText: testUrl2 })).toBeVisible();
    await expect(page.locator('.step-url', { hasText: testUrl3 })).toBeVisible();

    // Remove one step
    await page.locator('.step-card .remove-btn').first().click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();
    await expect(page.locator('.step-card')).toHaveCount(2, { timeout: 10000 });

    // Clean up
    await cleanupProject(page, testProjectName);
  });
});

test.describe('Registered Stubs - Scenario Reset', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context);
    await page.goto('/');
  });

  test('should reset scenarios on WireMock instance', async ({ page }) => {
    const ts = Date.now();
    const testProjectName = `Scenario Reset Test ${ts}`;

    await createProjectAndNavigate(page, testProjectName);

    // Add instance
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Scenario Reset Instance');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await expect(page.locator('.el-card', { hasText: 'Scenario Reset Instance' })).toBeVisible({
      timeout: 10000
    });

    // Navigate to registered stubs page
    await page.goto('/registered-stubs');
    await page.waitForTimeout(1000);

    // The instance should be auto-selected (first instance)
    await expect(page.locator('.header-actions .el-select')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click the scenario reset button
    await page.getByRole('button', { name: /シナリオリセット|Reset Scenarios/ }).click();

    // Verify success message
    await expect(page.getByText(/リセット|reset|成功|success/i).first()).toBeVisible({
      timeout: 10000
    });

    // Clean up
    await cleanupProject(page, testProjectName);
  });
});
