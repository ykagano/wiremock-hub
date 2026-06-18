import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestApp } from '../setup.js';
import { resetAndCreateProject } from '../helpers.js';

const MCP_HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream'
};

const PROTOCOL_VERSION = '2025-06-18';

/** Send a single JSON-RPC request to the stateless MCP endpoint and return the parsed body. */
async function rpc(body: Record<string, unknown>) {
  const app = await getTestApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/mcp',
    headers: MCP_HEADERS,
    payload: body
  });
  return res;
}

/** Call an MCP tool and return the parsed JSON of its (text) result content. */
async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await rpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      _meta: { protocolVersion: PROTOCOL_VERSION },
      name,
      arguments: args
    }
  });
  const body = res.json();
  return { res, body };
}

/** Extract the text payload from a tools/call result. */
function resultText(body: any): string {
  return body?.result?.content?.[0]?.text ?? '';
}

describe('MCP endpoint', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  describe('transport', () => {
    it('returns 405 for GET', async () => {
      const app = await getTestApp();
      // GET (SSE stream) carries no body, so do not set a JSON content-type.
      const res = await app.inject({
        method: 'GET',
        url: '/api/mcp',
        headers: { accept: 'application/json, text/event-stream' }
      });
      expect(res.statusCode).toBe(405);
      expect(res.json().error.message).toBe('Method not allowed.');
    });

    it('returns 405 for DELETE', async () => {
      const app = await getTestApp();
      // DELETE (session teardown) carries no body, so do not set a JSON content-type.
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/mcp',
        headers: { accept: 'application/json, text/event-stream' }
      });
      expect(res.statusCode).toBe(405);
      expect(res.json().error.message).toBe('Method not allowed.');
    });
  });

  describe('tools/list', () => {
    it('lists exactly the 33 expected tools', async () => {
      const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const names: string[] = (body.result.tools as Array<{ name: string }>).map((t) => t.name);

      const expected = [
        // projects (5)
        'list_projects',
        'get_project',
        'create_project',
        'update_project',
        'duplicate_project',
        // stubs (6)
        'list_stubs',
        'get_stub',
        'create_stub',
        'update_stub',
        'delete_stub',
        'test_stub',
        // sync (3)
        'sync_all_stubs',
        'append_all_stubs',
        'sync_stub',
        // import/export (3)
        'export_stubs',
        'import_stubs',
        'import_openapi',
        // instances (4)
        'list_instances',
        'get_instance',
        'create_instance',
        'update_instance',
        // instance ops (7)
        'get_instance_mappings',
        'delete_instance_mapping',
        'get_instance_requests',
        'get_instance_request',
        'clear_instance_requests',
        'reset_scenarios',
        'create_stub_from_request',
        // recording (5)
        'get_recording_status',
        'start_recording',
        'stop_recording',
        'start_recording_all',
        'stop_recording_all'
      ];

      expect(names.length).toBe(33);
      expect(new Set(names)).toEqual(new Set(expected));
    });

    it('annotates read-only and destructive tools correctly', async () => {
      const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
      const tools = res.json().result.tools as Array<{
        name: string;
        annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
      }>;
      const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

      expect(byName['list_stubs'].annotations?.readOnlyHint).toBe(true);
      expect(byName['delete_stub'].annotations?.destructiveHint).toBe(true);
      expect(byName['sync_all_stubs'].annotations?.destructiveHint).toBe(true);
      // create_stub is not destructive
      expect(byName['create_stub'].annotations?.destructiveHint).toBe(false);
    });
  });

  describe('tools/call - stub CRUD via inject', () => {
    let projectId: string;

    beforeEach(async () => {
      projectId = await resetAndCreateProject('MCP Test Project');
    });

    it('create_stub creates a stub visible in list_stubs', async () => {
      const created = await callTool('create_stub', {
        projectId,
        name: 'MCP Stub',
        mapping: { request: { url: '/mcp' }, response: { status: 200 } }
      });
      expect(created.body.result.isError).toBeFalsy();
      const createdStub = JSON.parse(resultText(created.body));
      expect(createdStub.name).toBe('MCP Stub');
      expect(createdStub.id).toBeTruthy();

      // Verify via list_stubs
      const listed = await callTool('list_stubs', { projectId });
      const stubs = JSON.parse(resultText(listed.body));
      expect(Array.isArray(stubs)).toBe(true);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].id).toBe(createdStub.id);

      // Verify in DB directly
      const app = await getTestApp();
      const dbStub = await app.prisma.stub.findUnique({ where: { id: createdStub.id } });
      expect(dbStub?.name).toBe('MCP Stub');
    });

    it('update_stub changes are reflected in get_stub', async () => {
      const created = await callTool('create_stub', {
        projectId,
        name: 'Before',
        mapping: { request: { url: '/before' }, response: { status: 200 } }
      });
      const stubId = JSON.parse(resultText(created.body)).id;

      const updated = await callTool('update_stub', {
        id: stubId,
        name: 'After',
        mapping: { request: { url: '/after' }, response: { status: 201 } }
      });
      expect(updated.body.result.isError).toBeFalsy();

      const fetched = await callTool('get_stub', { id: stubId });
      const stub = JSON.parse(resultText(fetched.body));
      expect(stub.name).toBe('After');
      expect(stub.mapping.request.url).toBe('/after');
    });

    it('delete_stub removes the stub', async () => {
      const created = await callTool('create_stub', {
        projectId,
        name: 'ToDelete',
        mapping: { request: { url: '/del' }, response: { status: 200 } }
      });
      const stubId = JSON.parse(resultText(created.body)).id;

      const deleted = await callTool('delete_stub', { id: stubId });
      expect(deleted.body.result.isError).toBeFalsy();

      const fetched = await callTool('get_stub', { id: stubId });
      expect(fetched.body.result.isError).toBe(true);
      expect(resultText(fetched.body)).toContain('Stub not found');

      const app = await getTestApp();
      const dbStub = await app.prisma.stub.findUnique({ where: { id: stubId } });
      expect(dbStub).toBeNull();
    });
  });

  describe('tools/call - projects', () => {
    it('list_projects returns the data payload only', async () => {
      await resetAndCreateProject('Visible Project');
      const listed = await callTool('list_projects');
      expect(listed.body.result.isError).toBeFalsy();
      const projects = JSON.parse(resultText(listed.body));
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.some((p: { name: string }) => p.name === 'Visible Project')).toBe(true);
    });

    it('shapes REST failures into isError results', async () => {
      // Valid input schema, but the stub does not exist -> REST 404 -> isError result.
      const fetched = await callTool('get_stub', {
        id: '00000000-0000-0000-0000-000000000000'
      });
      expect(fetched.body.result.isError).toBe(true);
      expect(resultText(fetched.body)).toBe('Error: Stub not found');
    });
  });
});
