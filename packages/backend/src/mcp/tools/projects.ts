import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { callApi, toResult } from '../helpers.js';

export function registerProjectTools(server: McpServer, fastify: FastifyInstance): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List all projects with their WireMock instances and stub counts.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    async () => toResult(await callApi(fastify, { method: 'GET', url: '/api/projects' }))
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description: 'Get a single project with its WireMock instances and stubs.',
      inputSchema: { id: z.string().describe('Project ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ id }) =>
      toResult(await callApi(fastify, { method: 'GET', url: `/api/projects/${id}` }))
  );

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description: 'Create a new project.',
      inputSchema: {
        name: z.string().min(1).describe('Project name'),
        description: z.string().optional().describe('Optional project description')
      },
      annotations: { destructiveHint: false }
    },
    async ({ name, description }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: '/api/projects',
          payload: { name, description }
        })
      )
  );

  server.registerTool(
    'update_project',
    {
      title: 'Update project',
      description: 'Update an existing project name or description.',
      inputSchema: {
        id: z.string().describe('Project ID'),
        name: z.string().min(1).optional().describe('New project name'),
        description: z.string().optional().describe('New project description')
      },
      annotations: { destructiveHint: false }
    },
    async ({ id, name, description }) =>
      toResult(
        await callApi(fastify, {
          method: 'PUT',
          url: `/api/projects/${id}`,
          payload: { name, description }
        })
      )
  );

  server.registerTool(
    'duplicate_project',
    {
      title: 'Duplicate project',
      description: 'Duplicate a project including its WireMock instances and stubs.',
      inputSchema: {
        id: z.string().describe('Project ID to duplicate'),
        suffix: z.string().optional().describe('Name suffix for the copy (default "(Copy)")')
      },
      annotations: { destructiveHint: false }
    },
    async ({ id, suffix }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: `/api/projects/${id}/duplicate`,
          payload: { suffix }
        })
      )
  );
}
