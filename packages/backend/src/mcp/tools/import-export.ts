import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { callApi, toResult } from '../helpers.js';

export function registerImportExportTools(server: McpServer, fastify: FastifyInstance): void {
  server.registerTool(
    'export_stubs',
    {
      title: 'Export stubs',
      description: 'Export all stubs of a project as a WireMock-compatible mappings JSON.',
      inputSchema: { projectId: z.string().describe('Project ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ projectId }) =>
      toResult(
        await callApi(fastify, { method: 'GET', url: '/api/stubs/export', query: { projectId } })
      )
  );

  server.registerTool(
    'import_stubs',
    {
      title: 'Import stubs',
      description:
        'Import stubs into a project from WireMock-compatible JSON. `data` accepts either a ' +
        '`{ mappings: [...] }` object (WireMock format) or the legacy `{ stubs: [...] }` Hub format.',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        data: z
          .record(z.string(), z.any())
          .describe('Import payload: `{ mappings: [...] }` or legacy `{ stubs: [...] }`')
      },
      annotations: { destructiveHint: false }
    },
    async ({ projectId, data }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: '/api/stubs/import',
          payload: { projectId, data }
        })
      )
  );

  server.registerTool(
    'import_openapi',
    {
      title: 'Import OpenAPI',
      description:
        'Generate stubs from an OpenAPI/Swagger specification and import them into a project.',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        content: z.string().describe('Raw OpenAPI/Swagger spec content (JSON or YAML)'),
        format: z
          .enum(['json', 'yaml'])
          .optional()
          .describe('Spec format (auto-detected when omitted)')
      },
      annotations: { destructiveHint: false }
    },
    async ({ projectId, content, format }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: '/api/stubs/import-openapi',
          payload: { projectId, content, format }
        })
      )
  );
}
