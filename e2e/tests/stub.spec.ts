import { test, expect } from '@playwright/test'
import { WIREMOCK_1_URL, WIREMOCK_2_URL, cleanupProject } from './helpers'

test.describe('Stub', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.removeItem('wiremock-hub-locale')
    })
    await page.goto('/')
  })

  test('should create stub and sync to instances', async ({ page }) => {
    const testProjectName = `Sync Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
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
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()

    // Wait for sync to complete
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 })

    // Also test sync from Mappings view
    await page.locator('.el-aside').getByText(/スタブマッピング|マッピング|Mappings/).click()
    await page.waitForTimeout(1000)

    // Click sync all instances button on mappings view
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()

    // Verify confirmation dialog appears and confirm
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should create stub with all parameters', async ({ page }) => {
    const testProjectName = `Stub Create Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
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

  test('should reset all stubs in wiremock-hub', async ({ page, request }) => {
    const testProjectName = `Reset Stubs Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
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
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 })
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
    await page.getByRole('button', { name: /すべて削除|Delete All/ }).click()

    // Verify confirmation dialog shows the new message with note
    await expect(page.locator('.el-message-box')).toContainText(/プロジェクト内のすべてのスタブを削除|Delete all stubs in this project/)
    await expect(page.locator('.el-message-box')).toContainText(/全インスタンスに同期|Sync All Instances/)

    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()

    // Wait for reset to complete - should show success message
    await expect(page.getByText(/すべてのスタブを削除しました|All stubs have been deleted/i).first()).toBeVisible({ timeout: 10000 })
    // Should also show note about syncing WireMock
    await expect(page.getByText(/全インスタンスに同期|Sync All Instances/i).first()).toBeVisible({ timeout: 5000 })

    // Verify stub list in wiremock-hub is now empty
    await page.waitForTimeout(1000)
    await expect(page.locator('code', { hasText: '/api/reset-test' })).not.toBeVisible()

    // Verify stub is STILL accessible on WireMock (Delete All only deletes wiremock-hub stubs, not WireMock mappings)
    const responseAfterReset = await request.get('http://localhost:8082/api/reset-test')
    // WireMock still has the mapping until user runs "Sync All Instances"
    expect(responseAfterReset.status()).toBe(200)

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should export stubs to JSON file', async ({ page }) => {
    const testProjectName = `Export Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    // Fill in stub
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill('/api/export-test')

    // Go to response tab and fill in response body
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea).toBeVisible()
    await responseTextarea.fill('{"message": "Export test response"}')

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/export-test' })).toBeVisible({ timeout: 10000 })

    // Click export button and wait for download
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /エクスポート|Export/ }).click()
    const download = await downloadPromise

    // Verify download filename contains project name
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/.*-stubs-.*\.json/)

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should import stubs from JSON file', async ({ page }) => {
    const testProjectName = `Import Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    // Prepare import data
    const importData = {
      version: '1.0',
      projectName: 'Test Project',
      exportedAt: new Date().toISOString(),
      stubs: [
        {
          name: 'Imported Stub 1',
          description: 'First imported stub',
          isActive: true,
          mapping: {
            request: {
              method: 'GET',
              urlPath: '/api/imported-1'
            },
            response: {
              status: 200,
              jsonBody: { message: 'Imported stub 1' },
              headers: { 'Content-Type': 'application/json' }
            }
          }
        },
        {
          name: 'Imported Stub 2',
          description: 'Second imported stub',
          isActive: true,
          mapping: {
            request: {
              method: 'POST',
              urlPath: '/api/imported-2'
            },
            response: {
              status: 201,
              jsonBody: { id: 123 },
              headers: { 'Content-Type': 'application/json' }
            }
          }
        }
      ]
    }

    // Set up filechooser listener BEFORE clicking the button
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /インポート|Import/ }).click()
    const fileChooser = await fileChooserPromise

    // Create a temporary file with import data
    const buffer = Buffer.from(JSON.stringify(importData))
    await fileChooser.setFiles({
      name: 'test-import.json',
      mimeType: 'application/json',
      buffer: buffer
    })

    // Verify imported stubs appear in the list
    await expect(page.locator('.el-table__row', { hasText: '/api/imported-1' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.el-table__row', { hasText: '/api/imported-2' })).toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should export and import stubs between projects', async ({ page }) => {
    const sourceProjectName = `Export Source ${Date.now()}`
    const targetProjectName = `Import Target ${Date.now()}`

    // Create source project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(sourceProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to source project detail
    let projectCard = page.locator('.el-card', { hasText: sourceProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create stubs
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    // Create first stub
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    const urlInput1 = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput1).toBeVisible()
    await urlInput1.fill('/api/roundtrip-1')
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea1 = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea1).toBeVisible()
    await responseTextarea1.fill('{"data": "roundtrip-1"}')
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/roundtrip-1' })).toBeVisible({ timeout: 10000 })

    // Create second stub
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    const urlInput2 = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput2).toBeVisible()
    await urlInput2.fill('/api/roundtrip-2')
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea2 = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea2).toBeVisible()
    await responseTextarea2.fill('{"data": "roundtrip-2"}')
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/roundtrip-2' })).toBeVisible({ timeout: 10000 })

    // Export stubs
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /エクスポート|Export/ }).click()
    const download = await downloadPromise

    // Save download to temporary path
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()

    // Create target project
    await page.goto('/projects')
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(targetProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to target project detail
    projectCard = page.locator('.el-card', { hasText: targetProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    // Import the exported file
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /インポート|Import/ }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(downloadPath!)

    // Verify imported stubs appear in the target project
    await expect(page.locator('.el-table__row', { hasText: '/api/roundtrip-1' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.el-table__row', { hasText: '/api/roundtrip-2' })).toBeVisible({ timeout: 10000 })

    // Clean up both projects
    await cleanupProject(page, targetProjectName)
    await cleanupProject(page, sourceProjectName)
  })

  test('should show error for invalid import file', async ({ page }) => {
    const testProjectName = `Invalid Import Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    // Try to import invalid JSON
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /インポート|Import/ }).click()
    const fileChooser = await fileChooserPromise

    // Create invalid JSON file
    const invalidBuffer = Buffer.from('{ invalid json }')
    await fileChooser.setFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: invalidBuffer
    })

    // Wait for error message
    await expect(page.getByText(/エラー|error|parse|JSON/i).first()).toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })
})

test.describe('Stub Test Feature', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.removeItem('wiremock-hub-locale')
    })
    await page.goto('/')
  })

  test('should display test button on stub list', async ({ page }) => {
    const testProjectName = `Stub Test Button ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill('/api/test-button-test')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/test-button-test' })).toBeVisible({ timeout: 10000 })

    // Verify test button (green CaretRight button) exists in the action column
    const row = page.locator('.el-table__row', { hasText: '/api/test-button-test' })
    const testButton = row.locator('.el-button--success')
    await expect(testButton).toBeVisible()

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should open test dialog and show request preview', async ({ page }) => {
    const testProjectName = `Test Dialog ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()

    // Set method to POST
    const methodFormItem = page.locator('.el-form-item', { hasText: /メソッド|Method/ })
    await methodFormItem.locator('.el-select').click()
    await page.waitForTimeout(300)
    await page.locator('.el-select-dropdown__item:visible', { hasText: 'POST' }).click()

    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await urlInput.fill('/api/dialog-test')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/dialog-test' })).toBeVisible({ timeout: 10000 })

    // Click the test button
    const row = page.locator('.el-table__row', { hasText: '/api/dialog-test' })
    await row.locator('.el-button--success').click()

    // Verify dialog is visible
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible()

    // Verify request preview shows the method and URL
    await expect(page.locator('.el-dialog').locator('.el-tag', { hasText: 'POST' })).toBeVisible()
    const urlField = page.locator('.el-dialog').locator('.el-input input').first()
    await expect(urlField).toHaveValue('/api/dialog-test')

    // Verify send button is present
    await expect(page.locator('.el-dialog').getByRole('button', { name: /テスト送信|Send Test/ })).toBeVisible()

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click()

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should execute test and display results', async ({ page }) => {
    const testProjectName = `Test Exec ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add WireMock instances
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Instance 1')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Instance 2')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Navigate to stubs and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await urlInput.fill('/api/exec-test')

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await responseTextarea.fill('{"status": "ok"}')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/exec-test' })).toBeVisible({ timeout: 10000 })

    // Sync all instances first
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Click the test button
    const row = page.locator('.el-table__row', { hasText: '/api/exec-test' })
    await row.locator('.el-button--success').click()

    // Wait for dialog
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible()

    // Click send test
    await page.locator('.el-dialog').getByRole('button', { name: /テスト送信|Send Test/ }).click()

    // Wait for results to appear
    await expect(page.locator('.el-dialog').locator('.el-alert', { hasText: /インスタンス|instances/ })).toBeVisible({ timeout: 15000 })

    // Verify results table shows both instances
    const resultRows = page.locator('.el-dialog').locator('.el-table__row')
    await expect(resultRows).toHaveCount(2, { timeout: 10000 })

    // Verify at least some result shows status info
    await expect(page.locator('.el-dialog').locator('.el-tag', { hasText: /合格|Pass/ }).first()).toBeVisible({ timeout: 5000 })

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click()

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should show test button on editor view', async ({ page }) => {
    const testProjectName = `Editor Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await urlInput.fill('/api/editor-test')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/editor-test' })).toBeVisible({ timeout: 10000 })

    // Open the stub in editor
    await page.locator('.el-table__row', { hasText: '/api/editor-test' }).click()

    // Verify the test button is visible in the editor toolbar
    await expect(page.locator('.header-actions').getByRole('button', { name: /テスト|Test/ })).toBeVisible()

    // Click the test button to verify dialog opens
    await page.locator('.header-actions').getByRole('button', { name: /テスト|Test/ }).click()
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible()

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click()

    // Go back
    await page.getByRole('button', { name: /戻る|Back/ }).click()

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should show error for no instances', async ({ page }) => {
    const testProjectName = `No Instance Test ${Date.now()}`

    // Create project (without adding instances)
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await urlInput.fill('/api/no-instance-test')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: '/api/no-instance-test' })).toBeVisible({ timeout: 10000 })

    // Click the test button
    const row = page.locator('.el-table__row', { hasText: '/api/no-instance-test' })
    await row.locator('.el-button--success').click()

    // Wait for dialog
    await expect(page.locator('.el-dialog', { hasText: /スタブテスト|Stub Test/ })).toBeVisible()

    // Click send test
    await page.locator('.el-dialog').getByRole('button', { name: /テスト送信|Send Test/ }).click()

    // Verify error message is shown inline (not toast)
    await expect(page.locator('.el-dialog').locator('.el-alert--error')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.el-dialog').locator('.el-alert--error')).toContainText(/instance|インスタンス/i)

    // Close dialog
    await page.locator('.el-dialog__headerbtn').click()

    // Clean up
    await cleanupProject(page, testProjectName)
  })
})
