import { test, expect } from '@playwright/test';

// The MCP feature is reachable two ways from the same backend endpoint. The demo
// stack is the standalone build (UI served at '/'), so the direct pattern applies:
//   http://localhost:3000/api/mcp
const MCP_ENDPOINT = 'http://localhost:3000/api/mcp';

// All 33 tools the server is expected to expose, and the ones that must NOT exist.
const EXPECTED_TOOLS = [
  'list_projects',
  'get_project',
  'create_project',
  'update_project',
  'duplicate_project',
  'list_stubs',
  'get_stub',
  'create_stub',
  'update_stub',
  'delete_stub',
  'test_stub',
  'sync_all_stubs',
  'append_all_stubs',
  'sync_stub',
  'export_stubs',
  'import_stubs',
  'import_openapi',
  'list_instances',
  'get_instance',
  'create_instance',
  'update_instance',
  'get_instance_mappings',
  'delete_instance_mapping',
  'get_instance_requests',
  'get_instance_request',
  'clear_instance_requests',
  'reset_scenarios',
  'create_stub_from_request',
  'get_recording_status',
  'start_recording',
  'stop_recording',
  'start_recording_all',
  'stop_recording_all'
];

const EXCLUDED_TOOLS = [
  'reset_instance',
  'delete_project',
  'delete_instance',
  'bulk_update_instances',
  'delete_all_stubs'
];

test.describe('MCP', () => {
  test('info page shows the endpoint, config examples, and tool list', async ({ page }) => {
    await page.goto('/mcp');

    // Heading
    await expect(page.getByRole('heading', { name: /MCP Server|MCP サーバー/ })).toBeVisible();

    // The live endpoint URL is rendered and points at /api/mcp
    await expect(page.locator('code.mcp-url')).toContainText('/api/mcp');

    // Claude Code CLI example is shown with the live URL
    await expect(page.getByText('claude mcp add --transport http wiremock-hub')).toBeVisible();

    // No-authentication warning is shown
    await expect(page.getByText(/No authentication|認証なし/)).toBeVisible();

    // Tools are inside a collapse; expand the Projects group and verify a tool appears
    await page.locator('.el-collapse-item__header', { hasText: /Projects|プロジェクト/ }).click();
    await expect(page.getByText('list_projects', { exact: true })).toBeVisible();
  });

  test('endpoint responds to tools/list with exactly the expected tools', async ({ request }) => {
    const res = await request.post(MCP_ENDPOINT, {
      headers: {
        'content-type': 'application/json',
        // Streamable HTTP requires the client to accept both content types
        accept: 'application/json, text/event-stream'
      },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
    });

    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    const tools = body.result?.tools ?? [];
    const names: string[] = tools.map((t: { name: string }) => t.name);

    expect(names.length).toBe(33);
    for (const name of EXPECTED_TOOLS) {
      expect(names).toContain(name);
    }
    for (const name of EXCLUDED_TOOLS) {
      expect(names).not.toContain(name);
    }

    // Destructive tools carry the destructiveHint annotation
    const syncAll = tools.find((t: { name: string }) => t.name === 'sync_all_stubs');
    expect(syncAll?.annotations?.destructiveHint).toBe(true);

    // Read tools carry readOnlyHint
    const listStubs = tools.find((t: { name: string }) => t.name === 'list_stubs');
    expect(listStubs?.annotations?.readOnlyHint).toBe(true);
  });
});
