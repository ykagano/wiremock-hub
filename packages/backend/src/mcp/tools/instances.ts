import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { callApi, toResult } from '../helpers.js';

export function registerInstanceTools(server: McpServer, fastify: FastifyInstance): void {
  server.registerTool(
    'list_instances',
    {
      title: 'List instances',
      description: 'List all WireMock instances registered in a project.',
      inputSchema: { projectId: z.string().describe('Project ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ projectId }) =>
      toResult(
        await callApi(fastify, {
          method: 'GET',
          url: '/api/wiremock-instances',
          query: { projectId }
        })
      )
  );

  server.registerTool(
    'get_instance',
    {
      title: 'Get instance',
      description: 'Get a WireMock instance with a live health check.',
      inputSchema: { id: z.string().describe('Instance ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ id }) =>
      toResult(await callApi(fastify, { method: 'GET', url: `/api/wiremock-instances/${id}` }))
  );

  server.registerTool(
    'create_instance',
    {
      title: 'Create instance',
      description: 'Register a new WireMock instance in a project.',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        name: z.string().min(1).describe('Instance name'),
        url: z.string().url().describe('WireMock base URL (e.g. http://wiremock-1:8080)')
      },
      annotations: { destructiveHint: false }
    },
    async ({ projectId, name, url }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: '/api/wiremock-instances',
          payload: { projectId, name, url }
        })
      )
  );

  server.registerTool(
    'update_instance',
    {
      title: 'Update instance',
      description: 'Update a WireMock instance name, URL, or active state.',
      inputSchema: {
        id: z.string().describe('Instance ID'),
        name: z.string().min(1).optional().describe('New instance name'),
        url: z.string().url().optional().describe('New WireMock base URL'),
        isActive: z.boolean().optional().describe('Whether the instance is active')
      },
      annotations: { destructiveHint: false }
    },
    async ({ id, name, url, isActive }) =>
      toResult(
        await callApi(fastify, {
          method: 'PUT',
          url: `/api/wiremock-instances/${id}`,
          payload: { name, url, isActive }
        })
      )
  );
}
