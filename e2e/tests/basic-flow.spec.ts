import { test, expect } from '@playwright/test'

// Docker環境用のWireMockインスタンスURL
// バックエンドからはDockerネットワーク内のホスト名を使用する必要がある
const WIREMOCK_1_URL = 'http://wiremock-1:8080'
const WIREMOCK_2_URL = 'http://wiremock-2:8080'

test.describe('WireMock JP E2E Tests - UI', () => {
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
    await page.goto('/projects')
    const card = page.locator('.el-card', { hasText: testProjectName })
    await card.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()
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
    await page.goto('/projects')
    const card = page.locator('.el-card', { hasText: healthTestProject })
    await card.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()
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
    await page.goto('/projects')
    const card = page.locator('.el-card', { hasText: testProjectName })
    await card.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()
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
    await page.goto('/projects')
    const card = page.locator('.el-card', { hasText: testProjectName })
    await card.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()
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
    await page.goto('/projects')
    const card = page.locator('.el-card', { hasText: errorTestProject })
    await card.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /削除|Delete/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes|確認/ }).click()
  })
})
