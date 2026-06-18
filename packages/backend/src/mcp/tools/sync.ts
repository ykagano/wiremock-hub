import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { callApi, toResult, listActiveInstances } from '../helpers.js';

/**
 * Apply POST /api/stubs/sync-all to one or all active instances of a project.
 * When instanceId is supplied, only that instance is targeted; otherwise the
 * operation fans out across every active instance and results are aggregated.
 */
async function syncAll(
  fastify: FastifyInstance,
  projectId: string,
  resetBeforeSync: boolean,
  instanceId?: string
) {
  if (instanceId) {
    return toResult(
      await callApi(fastify, {
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: { projectId, instanceId, resetBeforeSync }
      })
    );
  }

  const instances = await listActiveInstances(fastify, projectId);
  if (instances.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Error: No active WireMock instances found in this project'
        }
      ],
      isError: true
    };
  }

  const perInstance: Array<Record<string, unknown>> = [];
  let anyFailure = false;
  for (const instance of instances) {
    const res = await callApi(fastify, {
      method: 'POST',
      url: '/api/stubs/sync-all',
      payload: { projectId, instanceId: instance.id, resetBeforeSync }
    });
    const ok = res.statusCode < 400 && res.json?.success !== false;
    if (!ok) anyFailure = true;
    perInstance.push({
      instanceId: instance.id,
      instanceName: instance.name,
      ok,
      ...(ok
        ? { result: res.json?.data }
        : { error: res.json?.error || res.json?.message || `HTTP ${res.statusCode}` })
    });
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ instances: perInstance }, null, 2)
      }
    ],
    ...(anyFailure ? { isError: true } : {})
  };
}

export function registerSyncTools(server: McpServer, fastify: FastifyInstance): void {
  server.registerTool(
    'sync_all_stubs',
    {
      title: 'Sync all stubs',
      description:
        'Reset the target WireMock instance(s) and register all active stubs from the project ' +
        '(UI "Sync" behaviour). When instanceId is omitted, applies to every active instance.',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        instanceId: z
          .string()
          .optional()
          .describe('Target instance ID (omit to apply to all active instances)')
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
    },
    async ({ projectId, instanceId }) => syncAll(fastify, projectId, true, instanceId)
  );

  server.registerTool(
    'append_all_stubs',
    {
      title: 'Append all stubs',
      description:
        'Register all active stubs from the project on top of existing mappings without ' +
        'resetting (UI "Append" behaviour). When instanceId is omitted, applies to every ' +
        'active instance. Running repeatedly may create duplicate mappings.',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        instanceId: z
          .string()
          .optional()
          .describe('Target instance ID (omit to apply to all active instances)')
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async ({ projectId, instanceId }) => syncAll(fastify, projectId, false, instanceId)
  );

  server.registerTool(
    'sync_stub',
    {
      title: 'Sync stub',
      description: 'Sync a single stub to a specific WireMock instance.',
      inputSchema: {
        id: z.string().describe('Stub ID'),
        instanceId: z.string().describe('Target WireMock instance ID')
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async ({ id, instanceId }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: `/api/stubs/${id}/sync`,
          payload: { instanceId }
        })
      )
  );
}
