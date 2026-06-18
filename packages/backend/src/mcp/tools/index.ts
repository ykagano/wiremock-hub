import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { registerProjectTools } from './projects.js';
import { registerStubTools } from './stubs.js';
import { registerSyncTools } from './sync.js';
import { registerImportExportTools } from './import-export.js';
import { registerInstanceTools } from './instances.js';
import { registerInstanceOpsTools } from './instance-ops.js';
import { registerRecordingTools } from './recording.js';

/**
 * Register all 33 MCP tools on the server. Each tool wraps an existing REST route
 * via fastify.inject(), reusing all backend logic and validation.
 */
export function registerAllTools(server: McpServer, fastify: FastifyInstance): void {
  registerProjectTools(server, fastify); // 5
  registerStubTools(server, fastify); // 6
  registerSyncTools(server, fastify); // 3
  registerImportExportTools(server, fastify); // 3
  registerInstanceTools(server, fastify); // 4
  registerInstanceOpsTools(server, fastify); // 7
  registerRecordingTools(server, fastify); // 5
}
