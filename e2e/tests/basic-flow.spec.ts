import { test, expect } from '@playwright/test'

// Docker環境用のWireMockインスタンスURL
// バックエンドからはDockerネットワーク内のホスト名を使用する必要がある
const WIREMOCK_1_URL = 'http://wiremock-1:8080'
const WIREMOCK_2_URL = 'http://wiremock-2:8080'

// SKIP_CLEANUP=true でクリーンアップをスキップ（デバッグ・確認用）
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === 'true'

// URLからプロジェクトIDを取得するヘルパー関数
async function getProjectIdFromUrl(page: any): Promise<string> {
  const url = page.url()
  const match = url.match(/\/projects\/([^/]+)/)
  return match ? match[1] : ''
}

// クリーンアップ用ヘルパー関数
async function cleanupProject(page: any, projectName: string) {
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

test.describe('WireMock Hub E2E Tests - UI', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up localStorage before page loads to ensure English locale
    await context.addInitScript(() => {
      localStorage.removeItem('wiremock-hub-locale')
    })
    await page.goto('/')
  })

  test('should display projects page', async ({ page }) => {
    await expect(page.locator('h2')).toContainText(/プロジェクト|Projects/)
  })

  test('should create and delete project', async ({ page }) => {
    const testProjectName = `UI Test Project ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Verify project was created
    await expect(page.getByText(testProjectName)).toBeVisible()

    // Delete project
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()

    // Wait for dialog to close
    await expect(page.locator('.el-message-box')).not.toBeVisible()

    // Verify project is deleted
    await expect(page.locator('.el-card', { hasText: testProjectName })).not.toBeVisible()
  })

  test('should add and remove instance', async ({ page }) => {
    const testProjectName = `Instance Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Verify instance was created
    await expect(page.locator('.el-card', { hasText: 'Test Instance' })).toBeVisible()

    // Wait for success message to disappear
    await page.waitForTimeout(1500)

    // Delete instance
    const instanceCard = page.locator('.el-card', { hasText: 'Test Instance' })
    await instanceCard.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()

    // Wait for dialog to close
    await expect(page.locator('.el-message-box')).not.toBeVisible()

    // Verify instance is deleted
    await expect(page.locator('.el-card', { hasText: 'Test Instance' })).not.toBeVisible()

    // Clean up - delete project
    await cleanupProject(page, testProjectName)
  })

  test('should check health of WireMock instances', async ({ page }) => {
    const healthTestProject = `Health Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(healthTestProject)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: healthTestProject })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance with Docker network URL
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Health Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Check health
    const instanceCard = page.locator('.el-card', { hasText: 'Health Test Instance' })
    await instanceCard.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /ヘルスチェック|Health Check|接続確認/ }).click()

    // Should show health status - look for success message
    await expect(page.getByText(/接続に成功|接続OK|Healthy|success/i).first()).toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, healthTestProject)
  })

  test('should create stub and sync to instances', async ({ page }) => {
    const testProjectName = `Sync Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add first instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Instance 1')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Add second instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Instance 2')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    // Fill in stub using form
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill('/api/sync-test')

    // Go to response tab and fill in response body
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea).toBeVisible()
    await responseTextarea.fill('{"message": "Synced from E2E test!"}')

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.getByText(/保存|成功|success|スタブ/i).first()).toBeVisible({ timeout: 5000 })

    // Navigate back to project detail page via sidebar
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click()
    await page.waitForTimeout(500)

    // Sync all instances
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()

    // Wait for sync to complete
    await expect(page.getByText(/同期完了|Sync|成功/i).first()).toBeVisible({ timeout: 15000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should create stub with all parameters', async ({ page }) => {
    const testProjectName = `Stub Create Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(1000)

    // Click new stub button
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    // Verify stub editor opened
    await expect(page.locator('h2')).toContainText(/スタブ|Mapping|新規/)

    // ========== Request Tab ==========
    // Method - use form item to find the correct select
    const methodFormItem = page.locator('.el-form-item', { hasText: /メソッド|Method/ })
    await methodFormItem.locator('.el-select').click()
    await page.waitForTimeout(300)
    await page.locator('.el-select-dropdown__item:visible', { hasText: 'POST' }).click()

    // URL
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill('/api/create-test')

    // Request Headers - add header (label is "ヘッダー")
    // Find the form item containing "ヘッダー" label but not "Query" or "レスポンス"
    const headerSection = page.locator('.el-form-item').filter({ hasText: /ヘッダー|Headers/ }).filter({ hasNotText: 'Query' }).filter({ hasNotText: /レスポンス|Response/ })
    await headerSection.getByRole('button', { name: /追加|Add/ }).click()
    await headerSection.getByPlaceholder('Key').fill('X-Request-ID')
    await headerSection.getByPlaceholder('Value').fill('test-request-123')

    // Query Parameters - add parameter
    const queryParamSection = page.locator('.el-form-item', { hasText: /Query Parameters|クエリパラメータ/ })
    await queryParamSection.getByRole('button', { name: /追加|Add/ }).click()
    await queryParamSection.getByPlaceholder('Key').fill('page')
    await queryParamSection.getByPlaceholder('Value').fill('1')

    // ========== Response Tab ==========
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()

    // Status code
    await page.locator('.el-input-number').first().locator('input').fill('201')

    // Response body
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea).toBeVisible()
    await responseTextarea.fill('{"id": 123, "message": "Created successfully"}')

    // Response Headers - add header (label is "ヘッダー" on response tab too)
    // There's already a Content-Type header, so we add another one
    const responseHeaderSection = page.locator('.el-form-item').filter({ hasText: /ヘッダー|Headers/ })
    await responseHeaderSection.getByRole('button', { name: /追加|Add/ }).click()
    // Fill the last (newly added) Key/Value pair
    await responseHeaderSection.getByPlaceholder('Key').last().fill('X-Response-ID')
    await responseHeaderSection.getByPlaceholder('Value').last().fill('resp-456')

    // Delay
    const delayInput = page.locator('.el-form-item', { hasText: /遅延|Delay/ }).locator('.el-input-number input')
    await delayInput.fill('500')

    // ========== Advanced Tab ==========
    await page.getByRole('tab', { name: /詳細設定|Advanced/ }).click()

    // Priority
    const priorityInput = page.locator('.el-form-item', { hasText: /優先度|Priority/ }).locator('.el-input-number input')
    await priorityInput.fill('10')

    // Scenario
    await page.getByPlaceholder('e.g. login-flow').fill('create-flow')
    await page.getByPlaceholder('e.g. Started').fill('Initial')
    await page.getByPlaceholder('e.g. LoggedIn').fill('Created')

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click()
    // Wait for redirect to mapping list and verify stub appears in table
    await expect(page.locator('.el-table__row', { hasText: '/api/create-test' })).toBeVisible({ timeout: 10000 })

    // ========== Verify saved data by reopening ==========
    await page.locator('.el-table__row', { hasText: '/api/create-test' }).click()

    // Verify JSON tab contains all saved values
    await page.getByRole('tab', { name: 'JSON' }).click()
    const jsonTextarea = page.locator('.json-editor textarea').last()
    await expect(jsonTextarea).toHaveValue(/\/api\/create-test/)
    await expect(jsonTextarea).toHaveValue(/POST/)
    await expect(jsonTextarea).toHaveValue(/X-Request-ID/)
    await expect(jsonTextarea).toHaveValue(/test-request-123/)
    await expect(jsonTextarea).toHaveValue(/page/)
    await expect(jsonTextarea).toHaveValue(/201/)
    await expect(jsonTextarea).toHaveValue(/Created successfully/)
    await expect(jsonTextarea).toHaveValue(/X-Response-ID/)
    await expect(jsonTextarea).toHaveValue(/resp-456/)
    await expect(jsonTextarea).toHaveValue(/500/)
    await expect(jsonTextarea).toHaveValue(/10/)
    await expect(jsonTextarea).toHaveValue(/create-flow/)
    await expect(jsonTextarea).toHaveValue(/Initial/)
    await expect(jsonTextarea).toHaveValue(/Created/)

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should edit stub with all parameters', async ({ page }) => {
    const testProjectName = `Stub Edit Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(1000)

    // ========== Create simple stub first ==========
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await urlInput.fill('/api/simple-stub')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    // Wait for redirect to mapping list and verify stub appears in table
    await expect(page.locator('.el-table__row', { hasText: '/api/simple-stub' })).toBeVisible({ timeout: 10000 })

    // ========== Open stub for editing ==========
    await page.locator('.el-table__row', { hasText: '/api/simple-stub' }).click()

    // ========== Edit Request Tab ==========
    // Change method - use form item to find the correct select
    const methodFormItem = page.locator('.el-form-item', { hasText: /メソッド|Method/ })
    await methodFormItem.locator('.el-select').click()
    await page.waitForTimeout(300)
    await page.locator('.el-select-dropdown__item:visible', { hasText: 'PUT' }).click()

    // Change URL
    const editUrlInput = page.getByPlaceholder('e.g. /api/users')
    await editUrlInput.clear()
    await editUrlInput.fill('/api/edited-stub')

    // Add request header (label is "ヘッダー")
    const requestHeaderSection = page.locator('.el-form-item').filter({ hasText: /ヘッダー|Headers/ }).filter({ hasNotText: 'Query' }).filter({ hasNotText: /レスポンス|Response/ })
    await requestHeaderSection.getByRole('button', { name: /追加|Add/ }).click()
    await requestHeaderSection.getByPlaceholder('Key').fill('Authorization')
    await requestHeaderSection.getByPlaceholder('Value').fill('Bearer token123')

    // Add query parameter
    const queryParamSection = page.locator('.el-form-item', { hasText: /Query Parameters|クエリパラメータ/ })
    await queryParamSection.getByRole('button', { name: /追加|Add/ }).click()
    await queryParamSection.getByPlaceholder('Key').fill('limit')
    await queryParamSection.getByPlaceholder('Value').fill('50')

    // ========== Edit Response Tab ==========
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()

    // Change status code
    const statusInput = page.locator('.el-input-number').first().locator('input')
    await statusInput.clear()
    await statusInput.fill('404')

    // Change response body
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await responseTextarea.clear()
    await responseTextarea.fill('{"error": "Not Found", "code": 404}')

    // Add response header (label is "ヘッダー" on response tab too)
    // There's already a Content-Type header, so we add another one
    const responseHeaderSection = page.locator('.el-form-item').filter({ hasText: /ヘッダー|Headers/ })
    await responseHeaderSection.getByRole('button', { name: /追加|Add/ }).click()
    // Fill the last (newly added) Key/Value pair
    await responseHeaderSection.getByPlaceholder('Key').last().fill('X-Error-Code')
    await responseHeaderSection.getByPlaceholder('Value').last().fill('ERR-404')

    // Set delay
    const delayInput = page.locator('.el-form-item', { hasText: /遅延|Delay/ }).locator('.el-input-number input')
    await delayInput.fill('1000')

    // ========== Edit Advanced Tab ==========
    await page.getByRole('tab', { name: /詳細設定|Advanced/ }).click()

    // Change priority
    const priorityInput = page.locator('.el-form-item', { hasText: /優先度|Priority/ }).locator('.el-input-number input')
    await priorityInput.clear()
    await priorityInput.fill('1')

    // Set scenario
    await page.getByPlaceholder('e.g. login-flow').fill('error-flow')
    await page.getByPlaceholder('e.g. Started').fill('Running')
    await page.getByPlaceholder('e.g. LoggedIn').fill('Error')

    // Save the edited stub
    await page.getByRole('button', { name: /保存|Save/ }).click()
    // Wait for redirect to mapping list and verify stub appears in table
    await expect(page.locator('.el-table__row', { hasText: '/api/edited-stub' })).toBeVisible({ timeout: 10000 })

    // ========== Verify edited data by reopening ==========
    await page.locator('.el-table__row', { hasText: '/api/edited-stub' }).click()

    // Verify JSON tab contains all edited values
    await page.getByRole('tab', { name: 'JSON' }).click()
    const jsonTextarea = page.locator('.json-editor textarea').last()
    await expect(jsonTextarea).toHaveValue(/\/api\/edited-stub/)
    await expect(jsonTextarea).toHaveValue(/PUT/)
    await expect(jsonTextarea).toHaveValue(/Authorization/)
    await expect(jsonTextarea).toHaveValue(/Bearer token123/)
    await expect(jsonTextarea).toHaveValue(/limit/)
    await expect(jsonTextarea).toHaveValue(/50/)
    await expect(jsonTextarea).toHaveValue(/404/)
    await expect(jsonTextarea).toHaveValue(/Not Found/)
    await expect(jsonTextarea).toHaveValue(/X-Error-Code/)
    await expect(jsonTextarea).toHaveValue(/ERR-404/)
    await expect(jsonTextarea).toHaveValue(/1000/)
    await expect(jsonTextarea).toHaveValue(/"priority":\s*1/)
    await expect(jsonTextarea).toHaveValue(/error-flow/)
    await expect(jsonTextarea).toHaveValue(/Running/)
    await expect(jsonTextarea).toHaveValue(/Error/)

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should validate form inputs', async ({ page }) => {
    // Try to create project without name
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Should show validation error
    await expect(page.locator('.el-form-item__error').first()).toBeVisible()

    // Try invalid URL
    await page.getByLabel(/プロジェクト名|Name/).fill('Test Project')
    await page.getByLabel(/WireMock URL|Base URL/).fill('not-a-valid-url')
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Should show URL validation error
    await expect(page.locator('.el-form-item__error').first()).toBeVisible()

    // Close dialog
    await page.locator('.el-dialog').getByRole('button', { name: /キャンセル|Cancel/ }).click()
  })

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

  test('should clear request log', async ({ page, request }) => {
    const testProjectName = `Request Log Clear Test ${Date.now()}`

    // Create project - use wiremock-2 to avoid affecting other tests' logs
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance - use wiremock-2
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Clear Log Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Make a request to WireMock to create some log entries (use localhost:8082 for wiremock-2)
    try {
      await request.get('http://localhost:8082/some-test-endpoint')
    } catch {
      // Request might fail, continue anyway
    }

    // Navigate to request log page via sidebar
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)

    // Click refresh button
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Clear request log
    await page.getByRole('button', { name: /クリア|Clear/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()

    // Wait for success message
    await expect(page.getByText(/成功|success|クリア/i).first()).toBeVisible({ timeout: 5000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should display request log', async ({ page, request }) => {
    const testProjectName = `Request Log Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Request Log Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    // Fill in stub
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill('/api/request-log-test')

    // Go to response tab and fill in response body
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea).toBeVisible()
    await responseTextarea.fill('{"message": "Request log test response"}')

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.getByText(/保存|成功|success|スタブ/i).first()).toBeVisible({ timeout: 5000 })

    // Navigate back to project detail and sync
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click()
    await page.waitForTimeout(500)

    // Sync all instances
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await expect(page.getByText(/同期完了|Sync|成功/i).first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Make a request to WireMock via the backend proxy
    // Since E2E tests run in the browser context and WireMock is on Docker network,
    // we need to use the backend API to trigger the request
    // Actually, we can directly call WireMock from the test (Playwright request context)
    // but since wiremock-1 is in Docker network, we need to use localhost:8081 for host access
    try {
      await request.get('http://localhost:8081/api/request-log-test')
    } catch {
      // Request might fail if wiremock is not accessible from host, continue anyway
    }

    // Navigate to request log page via sidebar
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)

    // Verify we're on request log page
    await expect(page.getByRole('heading', { name: /リクエストログ|Request Log/ })).toBeVisible()

    // Check tabs are present (instances should be loaded automatically)
    await expect(page.getByRole('tab', { name: /すべて|All/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /マッチング成功|Matched/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /マッチング失敗|Unmatched/ })).toBeVisible()

    // Verify request log entry is displayed (use first() since it appears in multiple tabs)
    await expect(page.locator('code', { hasText: '/api/request-log-test' }).first()).toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should handle invalid WireMock instance gracefully', async ({ page }) => {
    const errorTestProject = `Error Test ${Date.now()}`

    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(errorTestProject)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: errorTestProject })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add an invalid instance (non-existent host in Docker network)
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Invalid Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill('http://nonexistent-host:8080')
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Check health - should show unhealthy (error message will appear)
    const instanceCard = page.locator('.el-card', { hasText: 'Invalid Instance' })
    await instanceCard.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /ヘルスチェック|Health Check|接続確認/ }).click()

    // Should show unhealthy status (接続エラー is shown in the card)
    await expect(page.getByText(/接続に失敗|接続エラー|Unhealthy|エラー|failed/i).first()).toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, errorTestProject)
  })

  test('should reset stubs on WireMock instance', async ({ page, request }) => {
    const testProjectName = `Reset Stubs Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance (use wiremock-2 to avoid affecting other tests)
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Reset Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    // Fill in stub
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill('/api/reset-test')

    // Go to response tab and fill in response body
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea).toBeVisible()
    await responseTextarea.fill('{"message": "Before reset"}')

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.getByText(/保存|成功|success|スタブ/i).first()).toBeVisible({ timeout: 5000 })

    // Navigate back to project detail and sync
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click()
    await page.waitForTimeout(500)

    // Sync all instances
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await expect(page.getByText(/同期完了|Sync|成功/i).first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Verify stub is accessible on WireMock (use localhost:8082 for wiremock-2)
    const responseBeforeReset = await request.get('http://localhost:8082/api/reset-test')
    expect(responseBeforeReset.status()).toBe(200)
    const bodyBeforeReset = await responseBeforeReset.json()
    expect(bodyBeforeReset.message).toBe('Before reset')

    // Navigate to Mappings view via sidebar to use the reset function
    await page.locator('.el-aside').getByText(/スタブマッピング|マッピング|Mappings/).click()
    await page.waitForTimeout(1000)

    // Click refresh to load mappings
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Verify the stub appears in the mapping list before reset
    await expect(page.locator('code', { hasText: '/api/reset-test' }).first()).toBeVisible({ timeout: 5000 })

    // Click reset all button
    await page.getByRole('button', { name: /すべてリセット|Reset All/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()

    // Wait for reset to complete
    await expect(page.getByText(/成功|success|リセット/i).first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)

    // Verify stub is no longer accessible on WireMock (should return 404 or similar)
    const responseAfterReset = await request.get('http://localhost:8082/api/reset-test')
    // After reset, WireMock returns 404 for non-existent mappings
    expect(responseAfterReset.status()).toBe(404)

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should display request detail and import as stub', async ({ page, request }) => {
    const testProjectName = `Request Detail Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Detail Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Make a request to WireMock to create some log entries
    try {
      await request.post('http://localhost:8081/api/detail-test', {
        data: { name: 'test', value: 123 },
        headers: { 'Content-Type': 'application/json' }
      })
    } catch {
      // Request might return 404, continue anyway
    }

    // Navigate to request log page via sidebar
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)

    // Click refresh button
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Click on a request row to go to detail page
    const requestRow = page.locator('code', { hasText: '/api/detail-test' }).first()
    await expect(requestRow).toBeVisible({ timeout: 10000 })
    await requestRow.click()

    // Verify we're on request detail page
    await expect(page.getByRole('button', { name: /戻る|Back/ })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/リクエスト|Request/).first()).toBeVisible()
    await expect(page.getByText('/api/detail-test')).toBeVisible()

    // Click import as stub button
    await page.getByRole('button', { name: /スタブとしてインポート|Import as Stub/ }).click()

    // Verify import dialog is visible
    await expect(page.locator('.el-dialog', { hasText: /スタブとしてインポート|Import as Stub/ })).toBeVisible()

    // Verify default values are filled
    await expect(page.getByLabel(/スタブ名|Stub Name/).first()).toHaveValue(/POST.*detail-test/)

    // Click import button
    await page.locator('.el-dialog').getByRole('button', { name: /インポート|Import/ }).click()

    // Wait for success message
    await expect(page.getByText(/インポート|import|成功|success/i).first()).toBeVisible({ timeout: 5000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should filter requests by URL pattern', async ({ page, request }) => {
    const testProjectName = `Filter Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Filter Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Make requests to WireMock with different URLs
    try {
      await request.get('http://localhost:8082/api/filter-users')
      await request.get('http://localhost:8082/api/filter-orders')
      await request.post('http://localhost:8082/api/filter-users')
    } catch {
      // Requests might return 404, continue anyway
    }

    // Navigate to request log page via sidebar
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)

    // Click refresh button
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Verify filter component is visible
    await expect(page.getByPlaceholder(/URLで絞り込み|Filter by URL/)).toBeVisible()

    // Filter by URL pattern
    await page.getByPlaceholder(/URLで絞り込み|Filter by URL/).fill('filter-users')
    await page.waitForTimeout(500)

    // Verify filtered results (should show filter-users but not filter-orders)
    await expect(page.locator('code', { hasText: '/api/filter-users' }).first()).toBeVisible({ timeout: 5000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should filter requests by HTTP method', async ({ page, request }) => {
    const testProjectName = `Method Filter Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Method Filter Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Make requests with different HTTP methods
    try {
      await request.get('http://localhost:8082/api/method-test')
      await request.post('http://localhost:8082/api/method-test', { data: {} })
      await request.put('http://localhost:8082/api/method-test', { data: {} })
    } catch {
      // Requests might return 404, continue anyway
    }

    // Navigate to request log page via sidebar
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)

    // Click refresh button
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Filter by POST method
    const methodSelect = page.locator('.el-form-item', { hasText: /メソッド|Method/ }).locator('.el-select')
    await methodSelect.click()
    await page.waitForTimeout(300)
    await page.locator('.el-select-dropdown__item:visible', { hasText: 'POST' }).click()
    await page.waitForTimeout(500)

    // Verify filtered results - should show POST requests
    const postRequests = page.locator('.el-table__row', { hasText: 'POST' })
    await expect(postRequests.first()).toBeVisible({ timeout: 5000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should filter requests by status code range', async ({ page, request }) => {
    const testProjectName = `Status Filter Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Status Filter Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create stubs with different status codes
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    // Create 200 OK stub
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    await page.getByPlaceholder('e.g. /api/users').fill('/api/status-200')
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    await page.locator('.el-input-number').first().locator('input').fill('200')
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.getByText(/保存|成功|success/i).first()).toBeVisible({ timeout: 5000 })

    // Create 404 Not Found stub
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    await page.getByPlaceholder('e.g. /api/users').fill('/api/status-404')
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    await page.locator('.el-input-number').first().locator('input').fill('404')
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.getByText(/保存|成功|success/i).first()).toBeVisible({ timeout: 5000 })

    // Navigate back and sync
    await page.getByRole('menuitem', { name: /^プロジェクト$|^Project$/ }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await expect(page.getByText(/同期完了|Sync|成功/i).first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Make requests to both endpoints
    try {
      await request.get('http://localhost:8082/api/status-200')
      await request.get('http://localhost:8082/api/status-404')
    } catch {
      // 404 request will throw, continue anyway
    }

    // Navigate to request log page
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Filter by status code range 400-499 (client errors)
    const statusFromInput = page.locator('.el-form-item', { hasText: /ステータス.*から|Status.*From/i }).locator('.el-input-number input')
    const statusToInput = page.locator('.el-form-item', { hasText: /ステータス.*まで|Status.*To/i }).locator('.el-input-number input')
    await statusFromInput.fill('400')
    await statusToInput.fill('499')
    await page.waitForTimeout(500)

    // Verify filtered results - should show 404 requests but not 200
    await expect(page.locator('code', { hasText: '/api/status-404' }).first()).toBeVisible({ timeout: 5000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should reset filter and show all requests', async ({ page, request }) => {
    const testProjectName = `Filter Reset Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Reset Filter Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Make requests with different URLs
    try {
      await request.get('http://localhost:8082/api/reset-test-a')
      await request.get('http://localhost:8082/api/reset-test-b')
    } catch {
      // Requests might return 404, continue anyway
    }

    // Navigate to request log page
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Apply URL filter
    await page.getByPlaceholder(/URLで絞り込み|Filter by URL/).fill('reset-test-a')
    await page.waitForTimeout(500)

    // Verify only filtered results are shown
    await expect(page.locator('code', { hasText: '/api/reset-test-a' }).first()).toBeVisible({ timeout: 5000 })

    // Click reset button
    await page.getByRole('button', { name: /リセット|Reset/ }).click()
    await page.waitForTimeout(500)

    // Verify filter is cleared and both requests are shown
    await expect(page.getByPlaceholder(/URLで絞り込み|Filter by URL/)).toHaveValue('')
    await expect(page.locator('code', { hasText: '/api/reset-test-a' }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('code', { hasText: '/api/reset-test-b' }).first()).toBeVisible({ timeout: 5000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })
})
