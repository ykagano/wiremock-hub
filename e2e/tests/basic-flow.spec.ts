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
  test.beforeEach(async ({ page }) => {
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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Health Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Check health
    const instanceCard = page.locator('.el-card', { hasText: 'Health Test Instance' })
    await instanceCard.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /ヘルスチェック|Check Health|接続確認/ }).click()

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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Instance 1')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Add second instance
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Instance 2')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Navigate to stubs tab and create a stub
    await page.getByRole('tab', { name: /スタブ|Stubs/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|マッピング追加|Add/ }).first().click()

    // Fill in stub using form
    const urlInput = page.getByPlaceholder('/api/users')
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
    await page.locator('.el-aside').getByText(/プロジェクト|Projects/).click()
    await page.waitForTimeout(500)

    // Go to project detail
    const projectCardAfterStub = page.locator('.el-card', { hasText: testProjectName })
    await projectCardAfterStub.getByRole('button', { name: /詳細|Detail/ }).click()

    // Click on instances tab
    await page.getByRole('tab', { name: /インスタンス|Instances/ }).click()

    // Sync all instances
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()

    // Wait for sync to complete
    await expect(page.getByText(/同期完了|Sync|成功/i).first()).toBeVisible({ timeout: 15000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should create stub using form', async ({ page }) => {
    const testProjectName = `Stub Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/WireMock URL|Base URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Navigate to stubs tab
    await page.getByRole('tab', { name: /スタブ|Stubs/ }).click()
    await page.waitForTimeout(500)

    // Click new stub button
    await page.getByRole('button', { name: /新規作成|マッピング追加|Add/ }).first().click()

    // Verify stub editor opened
    await expect(page.locator('h2')).toContainText(/スタブ|Mapping|新規/)

    // Fill in stub using form (request tab is default)
    // URL field should be visible and fill it
    const urlInput = page.getByPlaceholder('/api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill('/api/e2e-test')

    // Go to response tab and fill in response body
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()

    // Fill response body textarea using placeholder
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await expect(responseTextarea).toBeVisible()
    await responseTextarea.fill('{"message": "Hello from E2E test!"}')

    // Save the stub
    await page.getByRole('button', { name: /保存|Save/ }).click()

    // Should show success message or redirect back to stubs list
    await expect(page.getByText(/保存|成功|success|スタブ/i).first()).toBeVisible({ timeout: 5000 })

    // Clean up - go back and delete project
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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
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
    await page.locator('.el-aside').getByText(/リクエスト|Requests/).click()
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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Request Log Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create a stub
    await page.getByRole('tab', { name: /スタブ|Stubs/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|マッピング追加|Add/ }).first().click()

    // Fill in stub
    const urlInput = page.getByPlaceholder('/api/users')
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
    await page.locator('.el-aside').getByText(/プロジェクト|Projects/).click()
    await page.waitForTimeout(500)

    const projectCardForSync = page.locator('.el-card', { hasText: testProjectName })
    await projectCardForSync.getByRole('button', { name: /詳細|Detail/ }).click()

    // Click on instances tab
    await page.getByRole('tab', { name: /インスタンス|Instances/ }).click()

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
    await page.locator('.el-aside').getByText(/リクエスト|Requests/).click()
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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Invalid Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill('http://nonexistent-host:8080')
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Check health - should show unhealthy (error message will appear)
    const instanceCard = page.locator('.el-card', { hasText: 'Invalid Instance' })
    await instanceCard.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /ヘルスチェック|Check Health|接続確認/ }).click()

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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Reset Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Navigate to stubs tab and create a stub
    await page.getByRole('tab', { name: /スタブ|Stubs/ }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /新規作成|マッピング追加|Add/ }).first().click()

    // Fill in stub
    const urlInput = page.getByPlaceholder('/api/users')
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
    await page.locator('.el-aside').getByText(/プロジェクト|Projects/).click()
    await page.waitForTimeout(500)

    const projectCardForSync = page.locator('.el-card', { hasText: testProjectName })
    await projectCardForSync.getByRole('button', { name: /詳細|Detail/ }).click()

    // Click on instances tab
    await page.getByRole('tab', { name: /インスタンス|Instances/ }).click()

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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
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
    await page.locator('.el-aside').getByText(/リクエスト|Requests/).click()
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
    await page.locator('.tab-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
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
    await page.locator('.el-aside').getByText(/リクエスト|Requests/).click()
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
})
