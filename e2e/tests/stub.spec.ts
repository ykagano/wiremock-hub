import { test, expect } from '@playwright/test';
import {
  WIREMOCK_1_URL,
  WIREMOCK_2_URL,
  cleanupProject,
  clearLocalStorage,
  fillMonacoEditor,
  getMonacoEditorValue
} from './helpers';

// Helper: create a stub via UI with specified parameters
async function createStubViaUI(
  page: import('@playwright/test').Page,
  opts: {
    name: string;
    description?: string;
    method?: string;
    url: string;
    status?: number;
    responseBody?: string;
  }
) {
  await page
    .getByRole('button', { name: /新規作成|Create New/ })
    .first()
    .click();

  // Fill name
  const nameInput = page.getByPlaceholder(/外部API|External API/);
  await expect(nameInput).toBeVisible();
  await nameInput.fill(opts.name);

  // Fill description if provided
  if (opts.description) {
    await page.getByPlaceholder(/スタブの説明|Stub description/).fill(opts.description);
  }

  // Switch to Request tab
  await page.getByRole('tab', { name: /リクエスト|Request/ }).click();

  // Select method if not GET (default)
  if (opts.method && opts.method !== 'GET') {
    const methodFormItem = page.locator('.el-form-item', { hasText: /メソッド|Method/ });
    await methodFormItem.locator('.el-select').click();
    await page.waitForTimeout(300);
    await page.locator('.el-select-dropdown__item:visible', { hasText: opts.method }).click();
  }

  // Fill URL
  await page.getByPlaceholder('e.g. /api/users').fill(opts.url);

  // Switch to Response tab
  await page.getByRole('tab', { name: /レスポンス|Response/ }).click();

  // Change status code if not 200 (default)
  if (opts.status && opts.status !== 200) {
    const statusInput = page.locator('.el-input-number').first().locator('input');
    await statusInput.fill(String(opts.status));
  }

  // Fill response body if provided (Monaco Editor)
  if (opts.responseBody) {
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(page, opts.responseBody, '[data-testid="response-body"]');
  }

  // Save
  await page.getByRole('button', { name: /保存|Save/ }).click();

  // Wait for the stub to appear in the list
  await expect(page.locator('.el-table__row', { hasText: opts.name })).toBeVisible({
    timeout: 10000
  });
}

test.describe('Stub', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context);
    await page.goto('/');
  });

  test('should create stub and sync to instances', async ({ page }) => {
    const testProjectName = `Sync Test ${Date.now()}`;

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

    // Add first instance
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

    // Add second instance
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

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();

    // Switch to Request tab (Basic Info is now the default)
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();

    // Fill in stub using form
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('/api/sync-test');

    // Go to response tab and fill in response body
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(
      page,
      '{"message": "Synced from E2E test!"}',
      '[data-testid="response-body"]'
    );

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.getByText(/保存|成功|success|スタブ/i).first()).toBeVisible({
      timeout: 5000
    });

    // Navigate back to project detail page via sidebar
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click();
    await page.waitForTimeout(500);

    // Sync all instances and check "Don't show again"
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click();
    await expect(page.locator('.el-message-box')).toBeVisible();
    await page
      .locator('.el-message-box')
      .getByText(/以降表示しない|Don't show again/)
      .click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();

    // Wait for sync to complete
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 });

    // Also test sync from Mappings view
    await page
      .locator('.el-aside')
      .getByText(/スタブマッピング|マッピング|Mappings/)
      .click();
    await page.waitForTimeout(1000);

    // Click sync all instances button on mappings view - dialog should be skipped
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click();
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 });

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should create stub with all parameters', async ({ page }) => {
    const testProjectName = `Stub Create Test ${Date.now()}`;

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
    await page.waitForTimeout(1000);

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(1000);

    // Click new stub button
    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();

    // Verify stub editor opened
    await expect(page.locator('h2')).toContainText(/スタブ|Mapping|新規/);

    // ========== Basic Info Tab ==========
    // Fill in name and description
    await page.getByPlaceholder(/外部API|External API/).fill('Create Test Stub');
    await page.getByPlaceholder(/スタブの説明|Stub description/).fill('A stub for creation test');

    // ========== Request Tab ==========
    // Switch to Request tab (Basic Info is now the default)
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();

    // Method - use form item to find the correct select
    const methodFormItem = page.locator('.el-form-item', { hasText: /メソッド|Method/ });
    await methodFormItem.locator('.el-select').click();
    await page.waitForTimeout(300);
    await page.locator('.el-select-dropdown__item:visible', { hasText: 'POST' }).click();

    // URL
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('/api/create-test');

    // Request Headers - add header (label is "ヘッダー")
    // Find the form item containing "ヘッダー" label but not "Query" or "レスポンス"
    const headerSection = page
      .locator('.el-form-item')
      .filter({ hasText: /ヘッダー|Headers/ })
      .filter({ hasNotText: 'Query' })
      .filter({ hasNotText: /レスポンス|Response/ });
    await headerSection.getByRole('button', { name: /追加|Add/ }).click();
    await headerSection.getByPlaceholder('Key').fill('X-Request-ID');
    await headerSection.getByPlaceholder('Value').fill('test-request-123');

    // Query Parameters - add parameter
    const queryParamSection = page.locator('.el-form-item', {
      hasText: /Query Parameters|クエリパラメータ/
    });
    await queryParamSection.getByRole('button', { name: /追加|Add/ }).click();
    await queryParamSection.getByPlaceholder('Key').fill('page');
    await queryParamSection.getByPlaceholder('Value').fill('1');

    // Request Body
    await page.waitForSelector('[data-testid="request-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(
      page,
      '{"username": "testuser", "email": "test@example.com"}',
      '[data-testid="request-body"]'
    );

    // ========== Response Tab ==========
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();

    // Status code
    await page.locator('.el-input-number').first().locator('input').fill('201');

    // Response body
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(
      page,
      '{"id": 123, "message": "Created successfully"}',
      '[data-testid="response-body"]'
    );

    // Response Headers - add header (label is "ヘッダー" on response tab too)
    // There's already a Content-Type header, so we add another one
    const responseHeaderSection = page
      .locator('.el-form-item')
      .filter({ hasText: /ヘッダー|Headers/ });
    await responseHeaderSection.getByRole('button', { name: /追加|Add/ }).click();
    // Fill the last (newly added) Key/Value pair
    await responseHeaderSection.getByPlaceholder('Key').last().fill('X-Response-ID');
    await responseHeaderSection.getByPlaceholder('Value').last().fill('resp-456');

    // Delay
    const delayInput = page
      .locator('.el-form-item', { hasText: /遅延|Delay/ })
      .locator('.el-input-number input');
    await delayInput.fill('500');

    // ========== Advanced Tab ==========
    await page.getByRole('tab', { name: /詳細設定|Advanced/ }).click();

    // Priority
    const priorityInput = page
      .locator('.el-form-item', { hasText: /優先度|Priority/ })
      .locator('.el-input-number input');
    await priorityInput.fill('10');

    // Scenario
    await page.getByPlaceholder('e.g. login-flow').fill('create-flow');
    await page.getByPlaceholder('e.g. Started').fill('Initial');
    await page.getByPlaceholder('e.g. LoggedIn').fill('Created');

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click();
    // Wait for redirect to mapping list and verify stub appears in table
    await expect(page.locator('.el-table__row', { hasText: '/api/create-test' })).toBeVisible({
      timeout: 10000
    });

    // ========== Verify saved data by reopening ==========
    await page.locator('.el-table__row', { hasText: '/api/create-test' }).click();

    // Verify Basic Info tab contains name and description
    await expect(page.getByPlaceholder(/外部API|External API/)).toHaveValue('Create Test Stub');
    await expect(page.getByPlaceholder(/スタブの説明|Stub description/)).toHaveValue(
      'A stub for creation test'
    );

    // Verify JSON tab contains all saved values
    await page.getByRole('tab', { name: 'JSON' }).click();
    await page.waitForSelector('.json-editor .monaco-editor', { timeout: 10000 });
    const jsonContent = await getMonacoEditorValue(page, '.json-editor');
    expect(jsonContent).toMatch(/\/api\/create-test/);
    expect(jsonContent).toMatch(/POST/);
    expect(jsonContent).toMatch(/X-Request-ID/);
    expect(jsonContent).toMatch(/test-request-123/);
    expect(jsonContent).toMatch(/page/);
    expect(jsonContent).toMatch(/testuser/);
    expect(jsonContent).toMatch(/201/);
    expect(jsonContent).toMatch(/Created successfully/);
    expect(jsonContent).toMatch(/X-Response-ID/);
    expect(jsonContent).toMatch(/resp-456/);
    expect(jsonContent).toMatch(/500/);
    expect(jsonContent).toMatch(/10/);
    expect(jsonContent).toMatch(/create-flow/);
    expect(jsonContent).toMatch(/Initial/);
    expect(jsonContent).toMatch(/Created/);

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should edit stub with all parameters', async ({ page }) => {
    const testProjectName = `Stub Edit Test ${Date.now()}`;

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
    await page.waitForTimeout(1000);

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(1000);

    // ========== Create simple stub first ==========
    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();

    // Switch to Request tab (Basic Info is now the default)
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();

    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await urlInput.fill('/api/simple-stub');

    await page.getByRole('button', { name: /保存|Save/ }).click();
    // Wait for redirect to mapping list and verify stub appears in table
    await expect(page.locator('.el-table__row', { hasText: '/api/simple-stub' })).toBeVisible({
      timeout: 10000
    });

    // ========== Open stub for editing ==========
    await page.locator('.el-table__row', { hasText: '/api/simple-stub' }).click();

    // ========== Edit Basic Info Tab ==========
    // Fill in name and description
    await page.getByPlaceholder(/外部API|External API/).fill('Edited Stub Name');
    await page.getByPlaceholder(/スタブの説明|Stub description/).fill('Edited stub description');

    // ========== Edit Request Tab ==========
    // Switch to Request tab (Basic Info is now the default)
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();

    // Change method - use form item to find the correct select
    const methodFormItem = page.locator('.el-form-item', { hasText: /メソッド|Method/ });
    await methodFormItem.locator('.el-select').click();
    await page.waitForTimeout(300);
    await page.locator('.el-select-dropdown__item:visible', { hasText: 'PUT' }).click();

    // Change URL
    const editUrlInput = page.getByPlaceholder('e.g. /api/users');
    await editUrlInput.clear();
    await editUrlInput.fill('/api/edited-stub');

    // Add request header (label is "ヘッダー")
    const requestHeaderSection = page
      .locator('.el-form-item')
      .filter({ hasText: /ヘッダー|Headers/ })
      .filter({ hasNotText: 'Query' })
      .filter({ hasNotText: /レスポンス|Response/ });
    await requestHeaderSection.getByRole('button', { name: /追加|Add/ }).click();
    await requestHeaderSection.getByPlaceholder('Key').fill('Authorization');
    await requestHeaderSection.getByPlaceholder('Value').fill('Bearer token123');

    // Add query parameter
    const queryParamSection = page.locator('.el-form-item', {
      hasText: /Query Parameters|クエリパラメータ/
    });
    await queryParamSection.getByRole('button', { name: /追加|Add/ }).click();
    await queryParamSection.getByPlaceholder('Key').fill('limit');
    await queryParamSection.getByPlaceholder('Value').fill('50');

    // Add request body
    await page.waitForSelector('[data-testid="request-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(
      page,
      '{"action": "update", "data": {"id": 1}}',
      '[data-testid="request-body"]'
    );

    // ========== Edit Response Tab ==========
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();

    // Change status code
    const statusInput = page.locator('.el-input-number').first().locator('input');
    await statusInput.clear();
    await statusInput.fill('404');

    // Change response body
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(
      page,
      '{"error": "Not Found", "code": 404}',
      '[data-testid="response-body"]'
    );

    // Add response header (label is "ヘッダー" on response tab too)
    // There's already a Content-Type header, so we add another one
    const responseHeaderSection = page
      .locator('.el-form-item')
      .filter({ hasText: /ヘッダー|Headers/ });
    await responseHeaderSection.getByRole('button', { name: /追加|Add/ }).click();
    // Fill the last (newly added) Key/Value pair
    await responseHeaderSection.getByPlaceholder('Key').last().fill('X-Error-Code');
    await responseHeaderSection.getByPlaceholder('Value').last().fill('ERR-404');

    // Set delay
    const delayInput = page
      .locator('.el-form-item', { hasText: /遅延|Delay/ })
      .locator('.el-input-number input');
    await delayInput.fill('1000');

    // ========== Edit Advanced Tab ==========
    await page.getByRole('tab', { name: /詳細設定|Advanced/ }).click();

    // Change priority
    const priorityInput = page
      .locator('.el-form-item', { hasText: /優先度|Priority/ })
      .locator('.el-input-number input');
    await priorityInput.clear();
    await priorityInput.fill('1');

    // Set scenario
    await page.getByPlaceholder('e.g. login-flow').fill('error-flow');
    await page.getByPlaceholder('e.g. Started').fill('Running');
    await page.getByPlaceholder('e.g. LoggedIn').fill('Error');

    // Save the edited stub
    await page.getByRole('button', { name: /保存|Save/ }).click();
    // Wait for redirect to mapping list and verify stub appears in table
    await expect(page.locator('.el-table__row', { hasText: '/api/edited-stub' })).toBeVisible({
      timeout: 10000
    });

    // ========== Verify edited data by reopening ==========
    await page.locator('.el-table__row', { hasText: '/api/edited-stub' }).click();

    // Verify Basic Info tab contains edited name and description
    await expect(page.getByPlaceholder(/外部API|External API/)).toHaveValue('Edited Stub Name');
    await expect(page.getByPlaceholder(/スタブの説明|Stub description/)).toHaveValue(
      'Edited stub description'
    );

    // Verify JSON tab contains all edited values
    await page.getByRole('tab', { name: 'JSON' }).click();
    await page.waitForSelector('.json-editor .monaco-editor', { timeout: 10000 });
    const jsonContent = await getMonacoEditorValue(page, '.json-editor');
    expect(jsonContent).toMatch(/\/api\/edited-stub/);
    expect(jsonContent).toMatch(/PUT/);
    expect(jsonContent).toMatch(/Authorization/);
    expect(jsonContent).toMatch(/Bearer token123/);
    expect(jsonContent).toMatch(/limit/);
    expect(jsonContent).toMatch(/50/);
    expect(jsonContent).toMatch(/update/);
    expect(jsonContent).toMatch(/404/);
    expect(jsonContent).toMatch(/Not Found/);
    expect(jsonContent).toMatch(/X-Error-Code/);
    expect(jsonContent).toMatch(/ERR-404/);
    expect(jsonContent).toMatch(/1000/);
    expect(jsonContent).toMatch(/"priority":\s*1/);
    expect(jsonContent).toMatch(/error-flow/);
    expect(jsonContent).toMatch(/Running/);
    expect(jsonContent).toMatch(/Error/);

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should save changes made via JSON editor tab', async ({ page }) => {
    const testProjectName = `JSON Edit Test ${Date.now()}`;

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
    await page.waitForTimeout(1000);

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(1000);

    // Create a simple stub first
    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await urlInput.fill('/api/json-edit-test');
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(page, '{"message": "original"}', '[data-testid="response-body"]');
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/json-edit-test' })).toBeVisible({
      timeout: 10000
    });

    // Open stub for editing
    await page.locator('.el-table__row', { hasText: '/api/json-edit-test' }).click();

    // Switch to JSON tab
    await page.getByRole('tab', { name: 'JSON' }).click();
    await page.waitForSelector('.json-editor .monaco-editor', { timeout: 10000 });

    // Get current JSON, modify response body and URL via JSON editor
    const currentJson = await getMonacoEditorValue(page, '.json-editor');
    const parsed = JSON.parse(currentJson);
    parsed.request.url = '/api/json-edited';
    parsed.response.body = '{"message": "edited-via-json"}';
    parsed.response.status = 201;

    // Set new JSON via Monaco Editor
    await fillMonacoEditor(page, JSON.stringify(parsed, null, 2), '.json-editor');

    // Click save
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/json-edited' })).toBeVisible({
      timeout: 10000
    });

    // Reopen stub and verify changes were saved
    await page.locator('.el-table__row', { hasText: '/api/json-edited' }).click();

    // Verify via JSON tab
    await page.getByRole('tab', { name: 'JSON' }).click();
    await page.waitForSelector('.json-editor .monaco-editor', { timeout: 10000 });
    const verifyJson = await getMonacoEditorValue(page, '.json-editor');
    expect(verifyJson).toMatch(/\/api\/json-edited/);
    expect(verifyJson).toMatch(/edited-via-json/);
    expect(verifyJson).toMatch(/201/);

    // Also verify form fields were synced
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    await expect(page.getByPlaceholder('e.g. /api/users')).toHaveValue('/api/json-edited');

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await page.waitForTimeout(500);
    const editorValue = await getMonacoEditorValue(page, '[data-testid="response-body"]');
    expect(editorValue).toBe('{"message": "edited-via-json"}');

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should clear request body when text is emptied', async ({ page }) => {
    const testProjectName = `Body Clear Test ${Date.now()}`;

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
    await page.waitForTimeout(1000);

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(1000);

    // Create a stub with request body
    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await urlInput.fill('/api/body-clear-test');
    await page.waitForSelector('[data-testid="request-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(page, '{"name": "to-be-deleted"}', '[data-testid="request-body"]');
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/body-clear-test' })).toBeVisible({
      timeout: 10000
    });

    // Verify body was saved by checking JSON
    await page.locator('.el-table__row', { hasText: '/api/body-clear-test' }).click();
    await page.getByRole('tab', { name: 'JSON' }).click();
    await page.waitForSelector('.json-editor .monaco-editor', { timeout: 10000 });
    const jsonContent = await getMonacoEditorValue(page, '.json-editor');
    expect(jsonContent).toMatch(/to-be-deleted/);

    // Go to Request tab and clear the body
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    await page.waitForSelector('[data-testid="request-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(page, '', '[data-testid="request-body"]');

    // Save
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/body-clear-test' })).toBeVisible({
      timeout: 10000
    });

    // Reopen and verify body is gone
    await page.locator('.el-table__row', { hasText: '/api/body-clear-test' }).click();
    await page.getByRole('tab', { name: 'JSON' }).click();
    await page.waitForSelector('.json-editor .monaco-editor', { timeout: 10000 });
    const verifyJson = await getMonacoEditorValue(page, '.json-editor');
    expect(verifyJson).not.toMatch(/to-be-deleted/);
    expect(verifyJson).not.toMatch(/bodyPatterns/);

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should reset all stubs in wiremock-hub', async ({ page, request }) => {
    const testProjectName = `Reset Stubs Test ${Date.now()}`;

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

    // Add instance (use wiremock-2 to avoid affecting other tests)
    await page
      .locator('.section-header')
      .getByRole('button', { name: /インスタンス追加|Add Instance/ })
      .click();
    await page
      .locator('.el-dialog')
      .getByLabel(/インスタンス名|Name/)
      .fill('Reset Test Instance');
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL);
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /保存|Save/ })
      .click();
    await page.waitForTimeout(1000);

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();

    // Switch to Request tab (Basic Info is now the default)
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();

    // Fill in stub
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('/api/reset-test');

    // Go to response tab and fill in response body
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(page, '{"message": "Before reset"}', '[data-testid="response-body"]');

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.getByText(/保存|成功|success|スタブ/i).first()).toBeVisible({
      timeout: 5000
    });

    // Navigate back to project detail and sync
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click();
    await page.waitForTimeout(500);

    // Sync all instances
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Verify stub is accessible on WireMock (use localhost:8082 for wiremock-2)
    const responseBeforeReset = await request.get('http://localhost:8082/api/reset-test');
    expect(responseBeforeReset.status()).toBe(200);
    const bodyBeforeReset = await responseBeforeReset.json();
    expect(bodyBeforeReset.message).toBe('Before reset');

    // Navigate to Mappings view via sidebar to use the reset function
    await page
      .locator('.el-aside')
      .getByText(/スタブマッピング|マッピング|Mappings/)
      .click();
    await page.waitForTimeout(1000);

    // Click refresh to load mappings
    await page.getByRole('button', { name: /更新|Refresh/ }).click();
    await page.waitForTimeout(500);

    // Verify the stub appears in the mapping list before reset
    await expect(page.locator('code', { hasText: '/api/reset-test' }).first()).toBeVisible({
      timeout: 5000
    });

    // Click reset all button
    await page.getByRole('button', { name: /すべて削除|Delete All/ }).click();

    // Verify confirmation dialog shows the new message with note
    await expect(page.locator('.el-message-box')).toContainText(
      /プロジェクト内のすべてのスタブを削除|Delete all stubs in this project/
    );
    await expect(page.locator('.el-message-box')).toContainText(
      /全インスタンスに同期|Sync All Instances/
    );

    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes|確認/ })
      .click();

    // Wait for reset to complete - should show success message
    await expect(
      page.getByText(/すべてのスタブを削除しました|All stubs have been deleted/i).first()
    ).toBeVisible({ timeout: 10000 });
    // Should also show note about syncing WireMock
    await expect(page.getByText(/全インスタンスに同期|Sync All Instances/i).first()).toBeVisible({
      timeout: 5000
    });

    // Verify stub list in wiremock-hub is now empty
    await page.waitForTimeout(1000);
    await expect(page.locator('code', { hasText: '/api/reset-test' })).not.toBeVisible();

    // Verify stub is STILL accessible on WireMock (Delete All only deletes wiremock-hub stubs, not WireMock mappings)
    const responseAfterReset = await request.get('http://localhost:8082/api/reset-test');
    // WireMock still has the mapping until user runs "Sync All Instances"
    expect(responseAfterReset.status()).toBe(200);

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should delete individual stub', async ({ page }) => {
    const testProjectName = `Stub Delete Test ${Date.now()}`;

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
    await page.waitForTimeout(1000);

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    // Create first stub
    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput1 = page.getByPlaceholder('e.g. /api/users');
    await urlInput1.fill('/api/delete-test-1');
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/delete-test-1' })).toBeVisible({
      timeout: 10000
    });

    // Create second stub
    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput2 = page.getByPlaceholder('e.g. /api/users');
    await urlInput2.fill('/api/delete-test-2');
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/delete-test-2' })).toBeVisible({
      timeout: 10000
    });

    // Verify both stubs exist
    await expect(page.locator('.el-table__row')).toHaveCount(2);

    // Delete the first stub using the delete button in the row
    const row1 = page.locator('.el-table__row', { hasText: '/api/delete-test-1' });
    await row1.locator('.el-button--danger').click();

    // Confirm deletion
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes|確認/ })
      .click();

    // Wait for deletion to complete
    await expect(page.locator('.el-message-box')).not.toBeVisible();
    await page.waitForTimeout(500);

    // Verify first stub is deleted and second remains
    await expect(
      page.locator('.el-table__row', { hasText: '/api/delete-test-1' })
    ).not.toBeVisible();
    await expect(page.locator('.el-table__row', { hasText: '/api/delete-test-2' })).toBeVisible();

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should export and import stubs in unified WireMock-compatible format', async ({ page }) => {
    const testProjectName = `Export Import ${Date.now()}`;

    // Create project with 11 stubs
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
    await page.waitForTimeout(1000);
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    const stubs = [
      {
        name: 'Get Users',
        description: 'Returns a list of all users',
        url: '/api/users',
        responseBody: '{"users": [{"id": 1, "name": "Alice"}], "total": 1}'
      },
      {
        name: 'Get User by ID',
        description: 'Returns a single user',
        url: '/api/users/1',
        responseBody: '{"id": 1, "name": "Alice", "role": "admin"}'
      },
      {
        name: 'Create User',
        method: 'POST',
        url: '/api/users',
        status: 201,
        responseBody: '{"id": 3, "name": "Charlie"}'
      },
      {
        name: 'Update User',
        method: 'PUT',
        url: '/api/users/1',
        responseBody: '{"id": 1, "name": "Alice Smith"}'
      },
      { name: 'Delete User', method: 'DELETE', url: '/api/users/1', status: 204 },
      {
        name: 'User Not Found',
        url: '/api/users/999',
        status: 404,
        responseBody: '{"error": "Not Found"}'
      },
      {
        name: 'Get Products',
        url: '/api/products',
        responseBody: '{"products": [{"id": 1, "name": "Laptop"}]}'
      },
      {
        name: 'Search Products',
        url: '/api/products/search',
        responseBody: '{"results": [], "query": "laptop"}'
      },
      {
        name: 'Create Order',
        method: 'POST',
        url: '/api/orders',
        status: 201,
        responseBody: '{"orderId": "ORD-001"}'
      },
      {
        name: 'Login',
        method: 'POST',
        url: '/api/auth/login',
        responseBody: '{"token": "eyJhbG..."}'
      },
      {
        name: 'Health Check Error',
        url: '/api/health',
        status: 503,
        responseBody: '{"status": "unavailable"}'
      }
    ];

    for (const stub of stubs) {
      await createStubViaUI(page, stub);
    }
    await expect(page.locator('.el-table__row')).toHaveCount(11, { timeout: 10000 });

    const { readFileSync } = await import('fs');

    // ========== Export → Delete All → Import ==========
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /エクスポート|Export/ }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    const exportJson = JSON.parse(readFileSync(downloadPath!, 'utf-8'));
    expect(exportJson.mappings).toHaveLength(11);
    expect(exportJson.meta.total).toBe(11);

    // Verify unified format: name at mapping level, hub metadata in metadata
    const getUsersMapping = exportJson.mappings.find((m: any) => m.name === 'Get Users');
    expect(getUsersMapping).toBeTruthy();
    expect(getUsersMapping.metadata.hub_description).toBe('Returns a list of all users');
    expect(getUsersMapping.metadata.hub_isActive).toBe(true);
    expect(getUsersMapping.request).toBeDefined();
    expect(getUsersMapping.response).toBeDefined();
    expect(getUsersMapping).not.toHaveProperty('id');
    expect(getUsersMapping).not.toHaveProperty('uuid');

    // Delete all stubs
    await page.getByRole('button', { name: /すべて削除|Delete All/ }).click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes|確認/ })
      .click();
    await expect(page.locator('.el-table__row')).toHaveCount(0, { timeout: 10000 });

    // Import JSON
    await page.getByRole('button', { name: /^インポート$|^Import$/ }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page
      .locator('.el-dropdown-menu__item:visible')
      .filter({ hasText: 'WireMock' })
      .first()
      .click();
    const chooser = await chooserPromise;
    await chooser.setFiles(downloadPath!);

    // Verify all 11 stubs restored by name
    for (const stub of stubs) {
      await expect(page.locator('.el-table__row', { hasText: stub.name })).toBeVisible({
        timeout: 10000
      });
    }

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should import stubs from OpenAPI spec', async ({ page }) => {
    const testProjectName = `OpenAPI Import ${Date.now()}`;

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

    const projectCard = page.locator('.el-card', { hasText: testProjectName });
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    const openapiSpec = {
      openapi: '3.0.0',
      info: { title: 'Pet Store API', version: '1.0.0' },
      paths: {
        '/api/pets': {
          get: {
            summary: 'List pets',
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { id: { type: 'integer' }, name: { type: 'string' } }
                      }
                    }
                  }
                }
              }
            }
          },
          post: {
            summary: 'Create pet',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { name: { type: 'string' }, species: { type: 'string' } }
                  }
                }
              }
            },
            responses: {
              '201': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'integer' }, name: { type: 'string' } }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/pets/{petId}': {
          get: {
            summary: 'Get pet by ID',
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        species: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    // Import OpenAPI spec
    await page.getByRole('button', { name: /^インポート$|^Import$/ }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page
      .locator('.el-dropdown-menu__item:visible')
      .filter({ hasText: /OpenAPI/ })
      .first()
      .click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'petstore.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(openapiSpec))
    });

    // OpenAPI spec has 3 operations: GET /api/pets, POST /api/pets, GET /api/pets/{petId}
    await expect(page.locator('.el-table__row')).toHaveCount(3, { timeout: 10000 });
    await expect(page.locator('.el-table__row', { hasText: '/api/pets' }).first()).toBeVisible();

    // Verify POST stub has request body
    await page.locator('.el-table__row', { hasText: 'POST' }).click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    await page.waitForSelector('[data-testid="request-body"] .monaco-editor', { timeout: 10000 });
    const requestBody = await getMonacoEditorValue(page, '[data-testid="request-body"]');
    expect(requestBody).toContain('name');
    expect(requestBody).toContain('species');

    // Verify response has generated sample
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await page.waitForTimeout(500);
    const responseBody = await getMonacoEditorValue(page, '[data-testid="response-body"]');
    expect(responseBody).toContain('id');
    expect(responseBody).toContain('name');

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should show error for invalid import file', async ({ page }) => {
    const testProjectName = `Invalid Import Test ${Date.now()}`;

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
    await page.waitForTimeout(1000);

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    // Try to import invalid JSON via dropdown
    await page.getByRole('button', { name: /^インポート$|^Import$/ }).click();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page
      .locator('.el-dropdown-menu__item:visible')
      .filter({ hasText: 'WireMock' })
      .first()
      .click();
    const fileChooser = await fileChooserPromise;

    // Create invalid JSON file
    const invalidBuffer = Buffer.from('{ invalid json }');
    await fileChooser.setFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: invalidBuffer
    });

    // Wait for error message
    await expect(page.getByText(/エラー|error|parse|JSON/i).first()).toBeVisible({
      timeout: 10000
    });

    // Clean up
    await cleanupProject(page, testProjectName);
  });
});

test.describe('Stub Test Feature', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context);
    await page.goto('/');
  });

  test('should display test UI and show dialog preview', async ({ page }) => {
    const testProjectName = `Test UI ${Date.now()}`;

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
    await page.waitForTimeout(1000);

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    // Create a stub with POST method
    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();

    // Switch to Request tab
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();

    // Set method to POST
    const methodFormItem = page.locator('.el-form-item', { hasText: /メソッド|Method/ });
    await methodFormItem.locator('.el-select').click();
    await page.waitForTimeout(300);
    await page.locator('.el-select-dropdown__item:visible', { hasText: 'POST' }).click();

    // Fill URL
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await urlInput.fill('/api/test-ui');

    // Save
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/test-ui' })).toBeVisible({
      timeout: 10000
    });

    // ========== Verify test button in table ==========
    const row = page.locator('.el-table__row', { hasText: '/api/test-ui' });
    await expect(row.locator('.el-button--success')).toBeVisible();

    // ========== Click test button, verify dialog ==========
    await row.locator('.el-button--success').click();

    // Verify dialog is visible
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible();

    // Verify POST tag visible in dialog
    await expect(page.locator('.el-dialog').locator('.el-tag', { hasText: 'POST' })).toBeVisible();

    // Verify URL input has /api/test-ui
    const urlField = page.locator('.el-dialog').locator('.el-input input').first();
    await expect(urlField).toHaveValue('/api/test-ui');

    // Verify send button is present
    await expect(
      page.locator('.el-dialog').getByRole('button', { name: /テスト送信|Send Test/ })
    ).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click();

    // ========== Open stub in editor ==========
    await row.click();

    // ========== Verify test button in editor ==========
    await expect(
      page.locator('.header-actions').getByRole('button', { name: /テスト|Test/ })
    ).toBeVisible();

    // ========== Click test button in editor ==========
    await page
      .locator('.header-actions')
      .getByRole('button', { name: /テスト|Test/ })
      .click();
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click();

    // Go back
    await page.getByRole('button', { name: /戻る|Back/ }).click();

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should execute test and display results', async ({ page }) => {
    const testProjectName = `Test Exec ${Date.now()}`;

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

    // Add WireMock instances
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

    // Navigate to stubs and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await urlInput.fill('/api/exec-test');

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click();
    await page.waitForSelector('[data-testid="response-body"] .monaco-editor', { timeout: 10000 });
    await fillMonacoEditor(page, '{"status": "ok"}', '[data-testid="response-body"]');

    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/exec-test' })).toBeVisible({
      timeout: 10000
    });

    // Sync all instances first
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click();
    await page
      .locator('.el-message-box')
      .getByRole('button', { name: /はい|Yes/ })
      .click();
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click the test button
    const row = page.locator('.el-table__row', { hasText: '/api/exec-test' });
    await row.locator('.el-button--success').click();

    // Wait for dialog
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible();

    // Click send test
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /テスト送信|Send Test/ })
      .click();

    // Wait for results to appear
    await expect(
      page.locator('.el-dialog').locator('.el-alert', { hasText: /インスタンス|instances/ })
    ).toBeVisible({ timeout: 15000 });

    // Verify results table shows both instances
    const resultRows = page.locator('.el-dialog').locator('.el-table__row');
    await expect(resultRows).toHaveCount(2, { timeout: 10000 });

    // Verify at least some result shows status info
    await expect(
      page
        .locator('.el-dialog')
        .locator('.el-tag', { hasText: /合格|Pass/ })
        .first()
    ).toBeVisible({ timeout: 5000 });

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click();

    // Clean up
    await cleanupProject(page, testProjectName);
  });

  test('should show error for no instances', async ({ page }) => {
    const testProjectName = `No Instance Test ${Date.now()}`;

    // Create project (without adding instances)
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
    await page.waitForTimeout(1000);

    // Navigate to stubs and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click();
    await page.waitForTimeout(500);

    await page
      .getByRole('button', { name: /新規作成|Create New/ })
      .first()
      .click();
    await page.getByRole('tab', { name: /リクエスト|Request/ }).click();
    const urlInput = page.getByPlaceholder('e.g. /api/users');
    await urlInput.fill('/api/no-instance-test');

    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.el-table__row', { hasText: '/api/no-instance-test' })).toBeVisible({
      timeout: 10000
    });

    // Click the test button
    const row = page.locator('.el-table__row', { hasText: '/api/no-instance-test' });
    await row.locator('.el-button--success').click();

    // Wait for dialog
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible();

    // Click send test
    await page
      .locator('.el-dialog')
      .getByRole('button', { name: /テスト送信|Send Test/ })
      .click();

    // Verify error message is shown inline (not toast)
    await expect(page.locator('.el-dialog').locator('.el-alert--error')).toBeVisible({
      timeout: 10000
    });
    await expect(page.locator('.el-dialog').locator('.el-alert--error')).toContainText(
      /instance|インスタンス/i
    );

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click();

    // Clean up
    await cleanupProject(page, testProjectName);
  });
});
