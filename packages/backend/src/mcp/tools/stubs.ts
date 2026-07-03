import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { callApi, toResult } from '../helpers.js';

// WireMock mapping JSON is arbitrary; accept any object shape.
const mappingSchema = z.record(z.string(), z.any());

export function registerStubTools(server: McpServer, fastify: FastifyInstance): void {
  server.registerTool(
    'list_stubs',
    {
      title: 'List stubs',
      description: 'List all stubs in a project.',
      inputSchema: { projectId: z.string().describe('Project ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ projectId }) =>
      toResult(await callApi(fastify, { method: 'GET', url: '/api/stubs', query: { projectId } }))
  );

  server.registerTool(
    'get_stub',
    {
      title: 'Get stub',
      description: 'Get a single stub by its ID.',
      inputSchema: { id: z.string().describe('Stub ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ id }) => toResult(await callApi(fastify, { method: 'GET', url: `/api/stubs/${id}` }))
  );

  server.registerTool(
    'create_stub',
    {
      title: 'Create stub',
      description:
        'Create a stub in a project. The mapping is a WireMock stub mapping JSON object ' +
        '(with `request` and `response` keys).',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        mapping: mappingSchema.describe('WireMock mapping JSON (request/response definition)'),
        name: z.string().optional().describe('Optional stub name'),
        description: z.string().optional().describe('Optional stub description')
      },
      annotations: { destructiveHint: false }
    },
    async ({ projectId, mapping, name, description }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: '/api/stubs',
          payload: { projectId, mapping, name, description }
        })
      )
  );

  server.registerTool(
    'update_stub',
    {
      title: 'Update stub',
      description: 'Update an existing stub. Only provided fields are changed.',
      inputSchema: {
        id: z.string().describe('Stub ID'),
        mapping: mappingSchema.optional().describe('New WireMock mapping JSON'),
        name: z.string().optional().describe('New stub name'),
        description: z.string().nullable().optional().describe('New stub description'),
        isActive: z.boolean().optional().describe('Whether the stub is active')
      },
      annotations: { destructiveHint: false }
    },
    async ({ id, mapping, name, description, isActive }) =>
      toResult(
        await callApi(fastify, {
          method: 'PUT',
          url: `/api/stubs/${id}`,
          payload: { mapping, name, description, isActive }
        })
      )
  );

  server.registerTool(
    'delete_stub',
    {
      title: 'Delete stub',
      description: 'Delete a stub by its ID.',
      inputSchema: { id: z.string().describe('Stub ID') },
      annotations: { destructiveHint: true }
    },
    async ({ id }) =>
      toResult(await callApi(fastify, { method: 'DELETE', url: `/api/stubs/${id}` }))
  );

  server.registerTool(
    'test_stub',
    {
      title: 'Test stub',
      description:
        'Send a request derived from a stub mapping to every active WireMock instance in its ' +
        'project and report whether the response matches. Optional overrides let you supply a ' +
        'URL (required for pattern-based matchers), headers, body, or query parameters. ' +
        'Header and query parameter overrides REPLACE the values derived from the stub ' +
        '(they are not merged), so pass the complete set you want to send.',
      inputSchema: {
        id: z.string().describe('Stub ID'),
        url: z.string().optional().describe('Override request URL (required for urlPattern stubs)'),
        headers: z
          .record(z.string(), z.string())
          .optional()
          .describe('Replace request headers entirely (stub-derived headers are not merged in)'),
        body: z.string().optional().describe('Override request body'),
        queryParameters: z
          .record(z.string(), z.string())
          .optional()
          .describe('Replace query parameters entirely (stub-derived params are not merged in)')
      },
      annotations: { readOnlyHint: false, openWorldHint: true }
    },
    async ({ id, url, headers, body, queryParameters }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: `/api/stubs/${id}/test`,
          payload: { url, headers, body, queryParameters }
        })
      )
  );
}
