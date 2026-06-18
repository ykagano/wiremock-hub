import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { callApi, toResult } from '../helpers.js';

export function registerRecordingTools(server: McpServer, fastify: FastifyInstance): void {
  server.registerTool(
    'get_recording_status',
    {
      title: 'Get recording status',
      description: 'Get the recording status of a WireMock instance.',
      inputSchema: { id: z.string().describe('Instance ID') },
      annotations: { readOnlyHint: true }
    },
    async ({ id }) =>
      toResult(
        await callApi(fastify, {
          method: 'GET',
          url: `/api/wiremock-instances/${id}/recording/status`
        })
      )
  );

  server.registerTool(
    'start_recording',
    {
      title: 'Start recording',
      description: 'Start recording on a WireMock instance, proxying to the given target base URL.',
      inputSchema: {
        id: z.string().describe('Instance ID'),
        targetBaseUrl: z.string().url().describe('Upstream base URL to proxy and record')
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async ({ id, targetBaseUrl }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: `/api/wiremock-instances/${id}/recording/start`,
          payload: { targetBaseUrl }
        })
      )
  );

  server.registerTool(
    'stop_recording',
    {
      title: 'Stop recording',
      description: 'Stop recording on a WireMock instance and return the captured mappings.',
      inputSchema: { id: z.string().describe('Instance ID') },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async ({ id }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: `/api/wiremock-instances/${id}/recording/stop`
        })
      )
  );

  server.registerTool(
    'start_recording_all',
    {
      title: 'Start recording on all instances',
      description:
        'Start recording on every active WireMock instance in a project, proxying to the given ' +
        'target base URL.',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        targetBaseUrl: z.string().url().describe('Upstream base URL to proxy and record')
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async ({ projectId, targetBaseUrl }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: '/api/wiremock-instances/recording/start-all',
          payload: { projectId, targetBaseUrl }
        })
      )
  );

  server.registerTool(
    'stop_recording_all',
    {
      title: 'Stop recording on all instances',
      description: 'Stop recording on every active WireMock instance in a project.',
      inputSchema: { projectId: z.string().describe('Project ID') },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async ({ projectId }) =>
      toResult(
        await callApi(fastify, {
          method: 'POST',
          url: '/api/wiremock-instances/recording/stop-all',
          payload: { projectId }
        })
      )
  );
}
