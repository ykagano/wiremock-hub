import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from '../mcp/server.js';

/**
 * MCP endpoint using a stateless Streamable HTTP transport with JSON responses.
 *
 * Stateless: a fresh server + transport is created per request, so there is no
 * session affinity. enableJsonResponse avoids SSE so responses are plain JSON,
 * which keeps proxies (nginx) and tests simple.
 */
export async function mcpRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const server = buildMcpServer(fastify);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    reply.raw.on('close', () => {
      transport.close();
      server.close();
    });

    // Hand the raw response to the SDK; Fastify must not also send a reply.
    reply.hijack();
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  const notAllowed = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.code(405).send({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null
    });

  fastify.get('/', notAllowed);
  fastify.delete('/', notAllowed);
}
