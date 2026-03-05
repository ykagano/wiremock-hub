import { test, expect } from '@playwright/test'
import { WIREMOCK_1_URL, WIREMOCK_2_URL, cleanupProject, clearLocalStorage } from './helpers'

test.describe('Registered Stubs', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context)
    await page.goto('/')
  })

  test('should display registered stubs after sync', async ({ page }) => {
    const ts = Date.now()
    const testProjectName = `Registered Stubs Test ${ts}`
    const testUrl = `/api/reg-stubs-${ts}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Registered Stubs Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-card', { hasText: 'Registered Stubs Instance' })).toBeVisible({ timeout: 10000 })

    // Navigate to stubs tab and create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await expect(page.getByRole('button', { name: /新規作成|Create New/ }).first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill(testUrl)

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await responseTextarea.fill('{"message": "registered stubs test"}')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: testUrl })).toBeVisible({ timeout: 10000 })

    // Sync to instance
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced|Sync completed/i).first()).toBeVisible({ timeout: 15000 })

    // Navigate to Registered Stubs page via sidebar
    await page.locator('.el-aside').getByText(/登録済みスタブ|Registered Stubs/).click()
    await expect(page.getByRole('heading', { name: /登録済みスタブ|Registered Stubs/ })).toBeVisible({ timeout: 10000 })

    // Verify instance is auto-selected and mappings are loaded
    await expect(page.locator('.el-table__row').first()).toBeVisible({ timeout: 10000 })

    // Verify the mapping shows the correct URL (use unique timestamp URL to avoid duplicates)
    const targetRow = page.locator('.el-table__row', { hasText: testUrl }).first()
    await expect(targetRow).toBeVisible()

    // Verify the mapping shows the HTTP method (default is GET)
    await expect(targetRow.locator('.el-tag', { hasText: 'GET' })).toBeVisible()

    // Verify the project name tag is displayed (from hub_project_name metadata)
    await expect(targetRow.locator('.el-tag', { hasText: testProjectName })).toBeVisible()

    // Verify pagination is displayed
    const pagination = page.locator('.el-pagination')
    await expect(pagination).toBeVisible()

    // Verify pagination shows total count
    await expect(pagination.locator('.el-pagination__total')).toContainText(/Total \d+|合計 \d+/)

    // Verify page size selector is available
    const pageSizeSelector = pagination.locator('.el-pagination__sizes')
    await expect(pageSizeSelector).toBeVisible()

    // Change page size and verify it works
    await pageSizeSelector.locator('.el-select').click()
    await page.getByRole('option', { name: '10/page' }).click()
    // Table should still show the mapping after page size change
    await expect(page.locator('.el-table__row', { hasText: testUrl }).first()).toBeVisible()

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should show empty state when no mappings', async ({ page, request }) => {
    const testProjectName = `Empty Registered Stubs ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Empty Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-card', { hasText: 'Empty Instance' })).toBeVisible({ timeout: 10000 })

    // Delete all WireMock mappings to ensure clean state
    await request.delete('http://localhost:8082/__admin/mappings')

    // Navigate to Registered Stubs page
    await page.locator('.el-aside').getByText(/登録済みスタブ|Registered Stubs/).click()
    await expect(page.getByRole('heading', { name: /登録済みスタブ|Registered Stubs/ })).toBeVisible({ timeout: 10000 })

    // Verify empty state is displayed (el-empty component)
    await expect(page.locator('.el-empty', { hasText: /マッピングが登録されていません|No mappings registered/ })).toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should expand row to show mapping JSON', async ({ page }) => {
    const ts = Date.now()
    const testProjectName = `Expand Row Test ${ts}`
    const testUrl = `/api/expand-${ts}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Expand Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-card', { hasText: 'Expand Test Instance' })).toBeVisible({ timeout: 10000 })

    // Create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await expect(page.getByRole('button', { name: /新規作成|Create New/ }).first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill(testUrl)

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    const responseTextarea = page.getByPlaceholder('{"message": "success"}')
    await responseTextarea.fill('{"result": "expand test"}')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: testUrl })).toBeVisible({ timeout: 10000 })

    // Sync to instance
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced|Sync completed/i).first()).toBeVisible({ timeout: 15000 })

    // Navigate to Registered Stubs page
    await page.locator('.el-aside').getByText(/登録済みスタブ|Registered Stubs/).click()
    await expect(page.getByRole('heading', { name: /登録済みスタブ|Registered Stubs/ })).toBeVisible({ timeout: 10000 })

    // Wait for the table to load (use unique URL to find the correct row)
    const targetRow = page.locator('.el-table__row', { hasText: testUrl }).first()
    await expect(targetRow).toBeVisible({ timeout: 10000 })

    // Click expand button on the target row
    await targetRow.locator('.el-table__expand-icon').click()

    // Verify expanded row shows JSON content
    await expect(page.locator('.mapping-json').first()).toBeVisible()
    await expect(page.locator('.mapping-json').first()).toContainText(testUrl)

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should delete individual mapping from instance', async ({ page }) => {
    const ts = Date.now()
    const testProjectName = `Delete Mapping Test ${ts}`
    const testUrl = `/api/del-mapping-${ts}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Delete Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-card', { hasText: 'Delete Test Instance' })).toBeVisible({ timeout: 10000 })

    // Create a stub
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await expect(page.getByRole('button', { name: /新規作成|Create New/ }).first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    const urlInput = page.getByPlaceholder('e.g. /api/users')
    await expect(urlInput).toBeVisible()
    await urlInput.fill(testUrl)

    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    await page.getByPlaceholder('{"message": "success"}').fill('{"message": "delete test"}')

    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: testUrl })).toBeVisible({ timeout: 10000 })

    // Sync to instance
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced|Sync completed/i).first()).toBeVisible({ timeout: 15000 })

    // Navigate to Registered Stubs page
    await page.locator('.el-aside').getByText(/登録済みスタブ|Registered Stubs/).click()
    await expect(page.getByRole('heading', { name: /登録済みスタブ|Registered Stubs/ })).toBeVisible({ timeout: 10000 })

    // Wait for the table to load
    const targetRow = page.locator('.el-table__row', { hasText: testUrl }).first()
    await expect(targetRow).toBeVisible({ timeout: 10000 })

    // Click the delete button (danger type) on the row
    await targetRow.locator('.el-button--danger').click()

    // Confirm deletion
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()

    // Verify success message
    await expect(page.getByText(/success|成功/i).first()).toBeVisible({ timeout: 10000 })

    // Verify the mapping is removed from the table
    await expect(page.locator('.el-table__row', { hasText: testUrl })).not.toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should delete all mappings from instance', async ({ page }) => {
    const ts = Date.now()
    const testProjectName = `Delete All Test ${ts}`
    const testUrl1 = `/api/del-all-1-${ts}`
    const testUrl2 = `/api/del-all-2-${ts}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Delete All Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-card', { hasText: 'Delete All Instance' })).toBeVisible({ timeout: 10000 })

    // Create two stubs
    await page.getByRole('menuitem', { name: /スタブマッピング|Stub Mappings/ }).click()
    await expect(page.getByRole('button', { name: /新規作成|Create New/ }).first()).toBeVisible({ timeout: 10000 })

    // Stub 1
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    await page.getByPlaceholder('e.g. /api/users').fill(testUrl1)
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    await page.getByPlaceholder('{"message": "success"}').fill('{"message": "stub 1"}')
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: testUrl1 })).toBeVisible({ timeout: 10000 })

    // Stub 2
    await page.getByRole('button', { name: /新規作成|Create New/ }).first().click()
    await page.getByPlaceholder('e.g. /api/users').fill(testUrl2)
    await page.getByRole('tab', { name: /レスポンス|Response/ }).click()
    await page.getByPlaceholder('{"message": "success"}').fill('{"message": "stub 2"}')
    await page.getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-table__row', { hasText: testUrl2 })).toBeVisible({ timeout: 10000 })

    // Sync to instance
    await page.getByRole('button', { name: /全インスタンスに同期|Sync All/ }).click()
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced|Sync completed/i).first()).toBeVisible({ timeout: 15000 })

    // Navigate to Registered Stubs page
    await page.locator('.el-aside').getByText(/登録済みスタブ|Registered Stubs/).click()
    await expect(page.getByRole('heading', { name: /登録済みスタブ|Registered Stubs/ })).toBeVisible({ timeout: 10000 })

    // Wait for the table to load
    await expect(page.locator('.el-table__row', { hasText: testUrl1 }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.el-table__row', { hasText: testUrl2 }).first()).toBeVisible()

    // Click "Delete All" button
    await page.getByRole('button', { name: /すべて削除|Delete All/ }).click()

    // Confirm deletion
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()

    // Verify success message
    await expect(page.getByText(/success|成功/i).first()).toBeVisible({ timeout: 10000 })

    // Verify all mappings are removed - empty state should be shown
    await expect(page.locator('.el-empty', { hasText: /マッピングが登録されていません|No mappings registered/ })).toBeVisible({ timeout: 10000 })

    // Clean up
    await cleanupProject(page, testProjectName)
  })

  test('should refresh mappings on button click', async ({ page }) => {
    const testProjectName = `Refresh Mappings Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Refresh Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_1_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await expect(page.locator('.el-card', { hasText: 'Refresh Test Instance' })).toBeVisible({ timeout: 10000 })

    // Navigate to Registered Stubs page
    await page.locator('.el-aside').getByText(/登録済みスタブ|Registered Stubs/).click()
    await expect(page.getByRole('heading', { name: /登録済みスタブ|Registered Stubs/ })).toBeVisible({ timeout: 10000 })

    // Click refresh button and verify API request is made
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/wiremock-instances/') && resp.url().includes('/mappings'))
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    const response = await responsePromise
    expect(response.status()).toBe(200)

    // Page should still be functional (no errors)
    await expect(page.getByRole('heading', { name: /登録済みスタブ|Registered Stubs/ })).toBeVisible()

    // Clean up
    await cleanupProject(page, testProjectName)
  })
})
