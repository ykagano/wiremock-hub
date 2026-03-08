import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { cleanupProject, clearLocalStorage, createProjectViaApi } from './helpers';

const API_BASE = 'http://localhost:3000/api';

// --- API helpers ---

async function selectProject(page: Page, projectId: string | number) {
  await page.goto(`/projects/${projectId}`);
  await expect(page.locator('.project-detail')).toBeVisible({ timeout: 5000 });
}

async function createScenarioStub(
  request: APIRequestContext,
  projectId: string | number,
  url: string,
  scenarioName: string,
  requiredState: string,
  newState?: string
): Promise<string> {
  const mapping: Record<string, unknown> = {
    request: { method: 'GET', url },
    response: { status: 200, body: '{}' },
    scenarioName,
    requiredScenarioState: requiredState
  };
  if (newState) {
    mapping.newScenarioState = newState;
  }

  const res = await request.post(`${API_BASE}/stubs`, {
    data: { projectId, mapping }
  });
  const body = await res.json();
  return body.data.id;
}

// --- UI helpers ---

/** Get step URLs in display order */
async function getStepUrls(page: Page): Promise<string[]> {
  const urls = page.locator('.step-url');
  const count = await urls.count();
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push((await urls.nth(i).textContent()) || '');
  }
  return result;
}

/** Drag step from one position to another using mouse events on drag handles */
async function dragStepToPosition(page: Page, fromIndex: number, toIndex: number) {
  const handles = page.locator('.drag-handle');
  const fromHandle = handles.nth(fromIndex);
  const toHandle = handles.nth(toIndex);

  const fromBox = await fromHandle.boundingBox();
  const toBox = await toHandle.boundingBox();
  if (!fromBox || !toBox) throw new Error('Cannot find drag handle bounding boxes');

  const fromX = fromBox.x + fromBox.width / 2;
  const fromY = fromBox.y + fromBox.height / 2;
  const toX = toBox.x + toBox.width / 2;
  const toY = toBox.y + toBox.height / 2;

  // Sortable.js requires: hover → mousedown → small move (trigger drag) → move to target → mouseup
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.waitForTimeout(100);
  // Small move to trigger drag recognition
  await page.mouse.move(fromX, fromY + 10, { steps: 3 });
  await page.waitForTimeout(100);
  // Move to target
  await page.mouse.move(toX, toY, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  // Wait for success message to confirm reorder completed, then wait for it to disappear
  await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.el-message--success')).toHaveCount(0, { timeout: 5000 });
}

test.describe('Scenario Reorder', () => {
  test.beforeEach(async ({ context }) => {
    await clearLocalStorage(context);
  });

  test('should reorder steps without chain', async ({ page, request }) => {
    const ts = Date.now();
    const projectName = `Reorder No Chain ${ts}`;
    const scenarioName = `reorder-nochain-${ts}`;
    const urlA = `/api/reorder-a-${ts}`;
    const urlB = `/api/reorder-b-${ts}`;
    const urlC = `/api/reorder-c-${ts}`;

    // Setup via API: project + 3 stubs WITHOUT chain (no newScenarioState)
    const project = await createProjectViaApi(request, projectName);
    await createScenarioStub(request, project.id, urlA, scenarioName, 'Started');
    await createScenarioStub(request, project.id, urlB, scenarioName, 'Step_2');
    await createScenarioStub(request, project.id, urlC, scenarioName, 'Step_3');

    // Select project and navigate to scenarios
    await selectProject(page, project.id);
    await page.goto('/scenarios');
    await expect(page.locator('.scenarios-page h2')).toBeVisible({ timeout: 10000 });

    // Select the scenario
    await page.locator('.scenario-name-list li', { hasText: scenarioName }).click();
    await expect(page.locator('.step-card')).toHaveCount(3, { timeout: 10000 });

    // All steps should show end state (no chain)
    await expect(page.locator('.end-state')).toHaveCount(3);

    // Read initial order from UI (API returns stubs in updatedAt desc, so order is not creation order)
    const initialUrls = await getStepUrls(page);
    expect(initialUrls).toHaveLength(3);

    // Drag index 1 to index 0: the second item should move to first position
    const movedUrl = initialUrls[1];
    await dragStepToPosition(page, 1, 0);

    const afterUrls = await getStepUrls(page);
    expect(afterUrls[0]).toContain(movedUrl.trim());

    // Drag index 2 to index 1: swap 2nd and 3rd positions
    const movedUrl2 = afterUrls[2].trim();
    await dragStepToPosition(page, 2, 1);

    const afterUrls2 = await getStepUrls(page);
    expect(afterUrls2[1]).toContain(movedUrl2);

    // Clean up
    await cleanupProject(page, projectName);
  });

  test('should reorder steps with chain (API update)', async ({ page, request }) => {
    const ts = Date.now();
    const projectName = `Reorder With Chain ${ts}`;
    const scenarioName = `reorder-chain-${ts}`;
    const urlA = `/api/chain-a-${ts}`;
    const urlB = `/api/chain-b-${ts}`;
    const urlC = `/api/chain-c-${ts}`;

    // Setup via API: project + 3 chained stubs
    const project = await createProjectViaApi(request, projectName);
    await createScenarioStub(request, project.id, urlA, scenarioName, 'Started', 'Step_2');
    await createScenarioStub(request, project.id, urlB, scenarioName, 'Step_2', 'Step_3');
    await createScenarioStub(request, project.id, urlC, scenarioName, 'Step_3');

    // Select project and navigate to scenarios
    await selectProject(page, project.id);
    await page.goto('/scenarios');
    await expect(page.locator('.scenarios-page h2')).toBeVisible({ timeout: 10000 });

    // Select the scenario
    await page.locator('.scenario-name-list li', { hasText: scenarioName }).click();
    await expect(page.locator('.step-card')).toHaveCount(3, { timeout: 10000 });

    // With chain, orderByStateChain follows links: A(Started→Step_2)→B(Step_2→Step_3)→C(Step_3)
    let urls = await getStepUrls(page);
    expect(urls[0]).toContain(urlA);
    expect(urls[1]).toContain(urlB);
    expect(urls[2]).toContain(urlC);

    // Drag B (index 1) to position 0 → [B, A, C]
    await dragStepToPosition(page, 1, 0);
    urls = await getStepUrls(page);
    expect(urls[0]).toContain(urlB);
    expect(urls[1]).toContain(urlA);
    expect(urls[2]).toContain(urlC);

    // Drag C (index 2) to index 1 → [B, C, A]
    await dragStepToPosition(page, 2, 1);
    urls = await getStepUrls(page);
    expect(urls[0]).toContain(urlB);
    expect(urls[1]).toContain(urlC);
    expect(urls[2]).toContain(urlA);

    // Clean up
    await cleanupProject(page, projectName);
  });
});
