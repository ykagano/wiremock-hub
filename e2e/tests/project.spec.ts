import { test, expect } from '@playwright/test'
import { LOCALE_KEY, cleanupProject, clearLocalStorage } from './helpers'

test.describe('Project', () => {
  test.beforeEach(async ({ page, context }) => {
    await clearLocalStorage(context, [LOCALE_KEY])
    await page.goto('/')
  })

  test('should display projects page', async ({ page }) => {
    await expect(page.locator('h2')).toContainText(/プロジェクト|Projects/)
  })

  test('should create and delete project', async ({ page }) => {
    const testProjectName = `UI Test Project ${Date.now()}`
    const testDescription = 'Test project description for E2E testing'

    // Create project with description
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/説明|Description/).fill(testDescription)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Verify project was created with description
    await expect(page.getByText(testProjectName)).toBeVisible()
    await expect(page.getByText(testDescription)).toBeVisible()

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

  test('should validate form inputs', async ({ page }) => {
    // Try to create project without name
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Should show validation error
    await expect(page.locator('.el-form-item__error').first()).toBeVisible()

    // Close dialog
    await page.locator('.el-dialog').getByRole('button', { name: /キャンセル|Cancel/ }).click()
  })

  test('should edit project name and description', async ({ page }) => {
    const testProjectName = `Edit Project Test ${Date.now()}`
    const testDescription = 'Original description'

    // Create project with description
    await page.locator('.page-header').getByRole('button', { name: /プロジェクト追加|Add Project/ }).click()
    await page.getByLabel(/プロジェクト名|Name/).fill(testProjectName)
    await page.getByLabel(/説明|Description/).fill(testDescription)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Verify project was created
    await expect(page.getByText(testProjectName)).toBeVisible()
    await expect(page.getByText(testDescription)).toBeVisible()

    // Open edit dialog via dropdown menu
    const projectCard = page.locator('.el-card', { hasText: testProjectName })
    await projectCard.locator('.el-dropdown').click()
    await page.getByRole('menuitem', { name: /編集|Edit/ }).click()

    // Edit name and description
    const updatedName = `${testProjectName} Updated`
    const updatedDescription = 'Updated description for E2E testing'
    await page.getByLabel(/プロジェクト名|Name/).clear()
    await page.getByLabel(/プロジェクト名|Name/).fill(updatedName)
    await page.getByLabel(/説明|Description/).clear()
    await page.getByLabel(/説明|Description/).fill(updatedDescription)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Verify project was updated (scope assertions to the specific card)
    const updatedCard = page.locator('.el-card', { hasText: updatedName })
    await expect(updatedCard).toBeVisible()
    await expect(updatedCard.getByText(updatedDescription)).toBeVisible()
    await updatedCard.getByRole('button', { name: /詳細|Detail/ }).click()

    // Click edit button in project detail header
    await page.locator('.header-actions').getByRole('button', { name: /編集|Edit/ }).click()

    // Edit description in detail view
    const finalDescription = 'Final description from detail view'
    const descInput = page.locator('.el-dialog').getByLabel(/説明|Description/)
    await descInput.clear()
    await descInput.fill(finalDescription)
    await page.locator('.el-dialog').getByRole('button', { name: /保存|Save/ }).click()

    // Verify update on detail page
    await expect(page.getByText(finalDescription)).toBeVisible()

    // Clean up (use updatedName since the project was renamed)
    await cleanupProject(page, updatedName)
  })

})
