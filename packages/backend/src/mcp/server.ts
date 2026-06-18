import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { registerAllTools } from './tools/index.js';

/**
 * Build an MCP server exposing WireMock Hub functionality as tools.
 * Tools delegate to the existing REST routes via fastify.inject().
 */
export function buildMcpServer(fastify: FastifyInstance): McpServer {
  const server = new McpServer(
    { name: 'wiremock-hub', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );
  registerAllTools(server, fastify);
  return server;
}
