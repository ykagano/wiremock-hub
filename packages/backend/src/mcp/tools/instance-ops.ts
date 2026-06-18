import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { callApi, toResult } from '../helpers.js';

export function registerInstanceOpsTools(server: McpServer, fastify: FastifyInstance): void {
  server.registerTool(
    'get_instance_mappings',
    {
      title: 'Get instance mappings',
      description: 'Fetch the live mappings currently registered on a WireMock instance.',
      inputSchema: { id: z.string().describe('Instance ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ id }) =>
      toResult(
        await callApi(fastify, { method: 'GET', url: `/api/wiremock-instances/${id}/mappings` })
      )
  );

  server.registerTool(
    'delete_instance_mapping',
    {
      title: 'Delete instance mapping',
      description: 'Delete a single mapping from a WireMock instance by its WireMock mapping ID.',
      inputSchema: {
        id: z.string().describe('Instance ID'),
        mappingId: z.string().describe('WireMock mapping ID to delete')
      },
      annotations: { destructiveHint: true }
    },
    async ({ id, mappingId }) =>
      toResult(
        await callApi(fastify, {
          method: 'DELETE',
          url: `/api/wiremock-instances/${id}/mappings/${mappingId}`
        })
      )
  );

  server.registerTool(
    'get_instance_requests',
    {
      title: 'Get instance requests',
      description:
        'Fetch the recent request log from a WireMock instance. Use `limit` to cap how many ' +
        'entries are returned (default 50).',
      inputSchema: {
        id: z.string().describe('Instance ID'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of request log entries (default 50)')
      },
      annotations: { readOnlyHint: true }
    },
    async ({ id, limit }) =>
      toResult(
        await callApi(fastify, {
          method: 'GET',
          url: `/api/wiremock-instances/${id}/requests`,
          query: { limit: String(limit ?? 50) }
        })
      )
  );

  server.registerTool(
    'get_instance_request',
    {
      title: 'Get instance request',
      description: 'Fetch a single request log entry from a WireMock instance by its request ID.',
      inputSchema: {
        id: z.string().describe('Instance ID'),
        requestId: z.string().describe('WireMock request log entry ID')
      },
      annotations: { readOnlyHint: true }
    },
    async ({ id, requestId }) =>
      toResult(
        await callApi(fastify, {
          method: 'GET',
          url: `/api/wiremock-instances/${id}/requests/${requestId}`
        })
      )
  );

  server.registerTool(
    'clear_instance_requests',
    {
      title: 'Clear instance requests',
      description: 'Clear the entire request log on a WireMock instance.',
      inputSchema: { id: z.string().describe('Instance ID') },
      annotations: { destructiveHint: true, openWorldHint: true }
    },
    async ({ id }) =>
      toResult(
        await callApi(fastify, { method: 'DELETE', url: `/api/wiremock-instances/${id}/requests` })
      )
  );

  server.registerTool(
    'reset_scenarios',
    {
      title: 'Reset scenarios',
      description:
        'Reset all scenarios on a WireMock instance back to the "Started" state. This resets ' +
        'stateful behaviour without deleting any mappings.',
      inputSchema: { id: z.string().describe('Instance ID') },
      annotations: { idempotentHint: true, openWorldHint: true }
    },
    async ({ id }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: `/api/wiremock-instances/${id}/scenarios/reset`
        })
      )
  );

  server.registerTool(
    'create_stub_from_request',
    {
      title: 'Create stub from request',
      description:
        'Create a new stub from a logged WireMock request. Lets you choose how the URL and body ' +
        'are matched and which request/response headers to capture.',
      inputSchema: {
        id: z.string().describe('Instance ID the request was logged on'),
        requestId: z.string().describe('WireMock request log entry ID to convert'),
        projectId: z.string().describe('Project ID to create the stub in'),
        name: z.string().min(1).describe('Name for the new stub'),
        urlMatchType: z
          .enum(['url', 'urlPath', 'urlPattern', 'urlPathPattern'])
          .describe('How to match the request URL'),
        urlPattern: z.string().min(1).describe('URL or pattern value for the chosen match type'),
        matchHeaders: z
          .array(z.string())
          .optional()
          .describe('Request header names to match exactly'),
        bodyMatchType: z
          .enum(['equalTo', 'equalToJson', 'contains', 'matches'])
          .optional()
          .describe('How to match the request body'),
        bodyMatchOptions: z
          .object({
            ignoreArrayOrder: z.boolean().optional(),
            ignoreExtraElements: z.boolean().optional()
          })
          .optional()
          .describe('equalToJson body matching options'),
        responseHeaders: z
          .array(z.string())
          .optional()
          .describe('Response header names to capture into the stub'),
        enableTemplating: z
          .boolean()
          .optional()
          .describe('Add the response-template transformer to the stub')
      },
      annotations: { destructiveHint: false }
    },
    async ({ id, requestId, ...body }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: `/api/wiremock-instances/${id}/requests/${requestId}/import`,
          payload: body
        })
      )
  );
}
