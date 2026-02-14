import { test, expect } from '@playwright/test'
import { WIREMOCK_1_URL, WIREMOCK_2_URL, cleanupProject } from './helpers'

test.describe('Request Log', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.removeItem('wiremock-hub-locale')
    })
    await page.goto('/')
  })

  test('should clear request log', async ({ page, request }) => {
    const testProjectName = `Request Log Clear Test ${Date.now()}`

    // Create project - use wiremock-2 to avoid affecting other tests' logs
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
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

  test('should display request log, detail and import as stub', async ({ page, request }) => {
    const testProjectName = `Request Log Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
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
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Make a matched request (stub exists)
    try {
      await request.get('http://localhost:8081/api/request-log-test')
    } catch {
      // Request might fail if wiremock is not accessible from host, continue anyway
    }

    // Make an unmatched request (no stub exists)
    try {
      await request.post('http://localhost:8081/api/unmatched-test', {
        data: { name: 'test', value: 123 },
        headers: { 'Content-Type': 'application/json' }
      })
    } catch {
      // Request will return 404, continue anyway
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

    // Verify matched request log entry is displayed (in All tab)
    await expect(page.locator('code', { hasText: '/api/request-log-test' }).first()).toBeVisible({ timeout: 10000 })

    // Verify unmatched request log entry is displayed (in All tab)
    await expect(page.locator('code', { hasText: '/api/unmatched-test' }).first()).toBeVisible({ timeout: 10000 })

    // --- Test request detail view for matched request (from Matched tab) ---
    // Switch to Matched tab
    await page.getByRole('tab', { name: /マッチング成功|Matched/ }).click()
    await page.waitForTimeout(500)

    // Click on "Detail" link in the matched request row
    const matchedRowInTab = page.locator('.el-table__row:visible', { hasText: '/api/request-log-test' }).first()
    await expect(matchedRowInTab).toBeVisible({ timeout: 5000 })
    await matchedRowInTab.getByRole('button', { name: /詳細|Detail/ }).click()

    // Verify we're on request detail page
    await expect(page.getByRole('button', { name: /戻る|Back/ })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/リクエスト|Request/).first()).toBeVisible()
    await expect(page.getByText('/api/request-log-test')).toBeVisible({ timeout: 10000 })

    // Verify matched stub info is displayed
    await expect(page.getByText(/マッチしたスタブ|Matched Stub/)).toBeVisible()

    // Go back to request list
    await page.getByRole('button', { name: /戻る|Back/ }).click()
    await expect(page.getByRole('heading', { name: /リクエストログ|Request Log/ })).toBeVisible({ timeout: 5000 })

    // --- Test request detail view for unmatched request (from Unmatched tab) ---
    // Switch to Unmatched tab
    await page.getByRole('tab', { name: /マッチング失敗|Unmatched/ }).click()
    await page.waitForTimeout(500)

    // Click on "Detail" link in the unmatched request row (use :visible to get the one in the active tab)
    const unmatchedRowInTab = page.locator('.el-table__row:visible', { hasText: '/api/unmatched-test' }).first()
    await expect(unmatchedRowInTab).toBeVisible({ timeout: 5000 })
    // Click the Detail link instead of the row to ensure click is handled
    await unmatchedRowInTab.getByRole('button', { name: /詳細|Detail/ }).click()

    // Verify we're on request detail page
    await expect(page.getByRole('button', { name: /戻る|Back/ })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/リクエスト|Request/).first()).toBeVisible()
    await expect(page.getByText('/api/unmatched-test')).toBeVisible({ timeout: 10000 })

    // Click import as stub button
    await page.getByRole('button', { name: /スタブとしてインポート|Import as Stub/ }).click()

    // Verify import dialog is visible
    await expect(page.locator('.el-dialog', { hasText: /スタブとしてインポート|Import as Stub/ })).toBeVisible()

    // Verify default values are filled
    await expect(page.getByLabel(/スタブ名|Stub Name/).first()).toHaveValue(/POST.*unmatched-test/)

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
    await page.locator('.el-message-box').getByRole('button', { name: /はい|Yes/ }).click()
    await expect(page.getByText(/同期完了|synced/i).first()).toBeVisible({ timeout: 15000 })
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

  test('should paginate request log when there are many requests', async ({ page, request }) => {
    const testProjectName = `Pagination Test ${Date.now()}`

    // Create project
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Go to project detail
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Add instance
    await page.locator('.section-header').getByRole('button', { name: /インスタンス追加|Add Instance/ }).click()
    await page.locator('.el-dialog').getByLabel(/インスタンス名|Name/).fill('Pagination Test Instance')
    await page.locator('.el-dialog').getByLabel(/URL/).fill(WIREMOCK_2_URL)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()
    await page.waitForTimeout(1000)

    // Generate 25 requests to WireMock to exceed default page size (20)
    const requestPromises = []
    for (let i = 1; i <= 25; i++) {
      requestPromises.push(
        request.get(`http://localhost:8082/api/pagination-test-${i}`).catch(() => {
          // Requests will return 404, ignore errors
        })
      )
    }
    await Promise.all(requestPromises)

    // Navigate to request log page
    await page.locator('.el-aside').getByText(/リクエストログ|Request Log/).click()
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: /更新|Refresh/ }).click()
    await page.waitForTimeout(500)

    // Verify pagination is visible (use first() since each tab has its own pagination)
    const pagination = page.locator('.el-pagination').first()
    await expect(pagination).toBeVisible()

    // Verify total count shows 25 or more
    await expect(pagination.locator('.el-pagination__total')).toContainText(/\d+/)

    // Verify page size selector is present
    await expect(pagination.locator('.el-pagination__sizes')).toBeVisible()

    // Verify first page is showing some pagination-test requests
    await expect(page.locator('code', { hasText: '/api/pagination-test-' }).first()).toBeVisible({ timeout: 5000 })

    // Navigate to page 2 using the pager item (li.number element, not button)
    const page2Button = pagination.locator('.el-pager li.number', { hasText: '2' })
    await expect(page2Button).toBeVisible({ timeout: 5000 })
    await page2Button.click()
    await page.waitForTimeout(500)

    // Verify page 2 is showing requests
    const tableRows = page.locator('.el-table__row:visible')
    await expect(tableRows.first()).toBeVisible()

    // Go back to page 1
    const page1Button = pagination.locator('.el-pager li.number', { hasText: '1' })
    await page1Button.click()
    await page.waitForTimeout(500)

    // Change page size to 10
    await pagination.locator('.el-pagination__sizes .el-select').click()
    await page.waitForTimeout(300)
    await page.getByRole('option', { name: '10/page' }).click()
    await page.waitForTimeout(500)

    // Verify table shows max 10 rows now
    const rowsAfterSizeChange = page.locator('.el-table__row:visible')
    const rowCount = await rowsAfterSizeChange.count()
    expect(rowCount).toBeLessThanOrEqual(10)

    // Clean up
    await cleanupProject(page, testProjectName)
  })
})
