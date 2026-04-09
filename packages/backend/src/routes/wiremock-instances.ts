import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { gunzipSync } from 'node:zlib';

const createInstanceSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url()
});

const updateInstanceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional()
});

const startRecordingSchema = z.object({
  targetBaseUrl: z.string().url()
});

const startRecordingAllSchema = z.object({
  projectId: z.string().uuid(),
  targetBaseUrl: z.string().url()
});

const stopRecordingAllSchema = z.object({
  projectId: z.string().uuid()
});

const importStubSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  urlMatchType: z.enum(['url', 'urlPath', 'urlPattern', 'urlPathPattern']),
  urlPattern: z.string().min(1),
  matchHeaders: z.array(z.string()).optional().default([]),
  bodyMatchType: z.enum(['equalTo', 'equalToJson', 'contains', 'matches']).optional(),
  bodyMatchOptions: z
    .object({
      ignoreArrayOrder: z.boolean().optional(),
      ignoreExtraElements: z.boolean().optional()
    })
    .optional(),
  responseHeaders: z.array(z.string()).optional().default([]),
  enableTemplating: z.boolean().optional().default(false)
});

export async function wiremockInstanceRoutes(fastify: FastifyInstance) {
  // Helper to check project exists
  async function checkProjectExists(projectId: string) {
    const project = await fastify.prisma.project.findUnique({
      where: { id: projectId }
    });
    return project;
  }

  // List instances for a project
  fastify.get(
    '/',
    async (
      request: FastifyRequest<{ Querystring: { projectId: string } }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.query;

      if (!projectId) {
        return reply.status(400).send({
          success: false,
          error: 'projectId is required'
        });
      }

      const project = await checkProjectExists(projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      const instances = await fastify.prisma.wiremockInstance.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({
        success: true,
        data: instances
      });
    }
  );

  // Get single instance with health status
  fastify.get(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      // Check WireMock health
      let isHealthy = false;
      try {
        const response = await axios.get(`${instance.url}/__admin/mappings`, {
          timeout: 5000
        });
        isHealthy = response.status === 200;
      } catch {
        isHealthy = false;
      }

      return reply.send({
        success: true,
        data: {
          ...instance,
          isHealthy
        }
      });
    }
  );

  // Create instance
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createInstanceSchema.parse(request.body);

      const project = await checkProjectExists(body.projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      const instance = await fastify.prisma.wiremockInstance.create({
        data: body
      });

      return reply.status(201).send({
        success: true,
        data: instance
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }
      throw error;
    }
  });

  // Update instance
  fastify.put(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = updateInstanceSchema.parse(request.body);

        const existing = await fastify.prisma.wiremockInstance.findUnique({
          where: { id }
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: 'Instance not found'
          });
        }

        const instance = await fastify.prisma.wiremockInstance.update({
          where: { id },
          data: body
        });

        return reply.send({
          success: true,
          data: instance
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.issues
          });
        }
        throw error;
      }
    }
  );

  // Delete instance
  fastify.delete(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const existing = await fastify.prisma.wiremockInstance.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      await fastify.prisma.wiremockInstance.delete({
        where: { id }
      });

      return reply.send({
        success: true,
        message: 'Instance deleted successfully'
      });
    }
  );

  // Get mappings from WireMock instance
  fastify.get(
    '/:id/mappings',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        const response = await axios.get(`${instance.url}/__admin/mappings`, {
          timeout: 10000
        });

        return reply.send({
          success: true,
          data: response.data
        });
      } catch (error) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to fetch mappings from WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Get requests from WireMock instance
  fastify.get(
    '/:id/requests',
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { limit } = request.query;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        // Default limit to 1000 to prevent fetching too many requests
        const requestLimit = limit ? parseInt(limit, 10) : 1000;
        const response = await axios.get(`${instance.url}/__admin/requests`, {
          timeout: 10000,
          params: { limit: requestLimit }
        });

        // Decode base64/gzip bodies in request log entries
        const data = response.data;
        if (data.requests && Array.isArray(data.requests)) {
          for (const entry of data.requests) {
            decodeRequestLogBodies(entry);
          }
        }

        return reply.send({
          success: true,
          data
        });
      } catch (error) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to fetch requests from WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Get single request from WireMock instance
  fastify.get(
    '/:id/requests/:requestId',
    async (
      request: FastifyRequest<{ Params: { id: string; requestId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, requestId } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        const response = await axios.get(`${instance.url}/__admin/requests/${requestId}`, {
          timeout: 10000
        });

        // Decode base64/gzip body in request log entry
        decodeRequestLogBodies(response.data);

        return reply.send({
          success: true,
          data: response.data
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return reply.status(404).send({
            success: false,
            error: 'Request not found'
          });
        }
        return reply.status(502).send({
          success: false,
          error: 'Failed to fetch request from WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Import request as stub
  fastify.post(
    '/:id/requests/:requestId/import',
    async (
      request: FastifyRequest<{ Params: { id: string; requestId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, requestId } = request.params;

      try {
        const body = importStubSchema.parse(request.body);

        const instance = await fastify.prisma.wiremockInstance.findUnique({
          where: { id },
          include: { project: true }
        });

        if (!instance) {
          return reply.status(404).send({
            success: false,
            error: 'Instance not found'
          });
        }

        // Verify project exists
        const project = await fastify.prisma.project.findUnique({
          where: { id: body.projectId }
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: 'Project not found'
          });
        }

        // Fetch the request from WireMock
        let wiremockRequest;
        try {
          const response = await axios.get(`${instance.url}/__admin/requests/${requestId}`, {
            timeout: 10000
          });
          wiremockRequest = response.data;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return reply.status(404).send({
              success: false,
              error: 'Request not found'
            });
          }
          throw error;
        }

        // Generate mapping from request
        const mapping = generateMapping(wiremockRequest, body);

        // Create stub in database
        const stub = await fastify.prisma.stub.create({
          data: {
            projectId: body.projectId,
            name: body.name,
            mapping: mapping as object
          }
        });

        return reply.status(201).send({
          success: true,
          data: stub
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.issues
          });
        }
        throw error;
      }
    }
  );

  // Clear requests from WireMock instance
  fastify.delete(
    '/:id/requests',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        await axios.delete(`${instance.url}/__admin/requests`, {
          timeout: 10000
        });

        return reply.send({
          success: true,
          message: 'Request log cleared successfully'
        });
      } catch (error) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to clear requests from WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Delete a single mapping from WireMock instance
  fastify.delete(
    '/:id/mappings/:mappingId',
    async (
      request: FastifyRequest<{ Params: { id: string; mappingId: string } }>,
      reply: FastifyReply
    ) => {
      const { id, mappingId } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        await axios.delete(`${instance.url}/__admin/mappings/${mappingId}`, {
          timeout: 10000
        });

        return reply.send({
          success: true,
          message: 'Mapping deleted successfully'
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return reply.status(404).send({
            success: false,
            error: 'Mapping not found on WireMock instance'
          });
        }
        return reply.status(502).send({
          success: false,
          error: 'Failed to delete mapping from WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Get recording status from WireMock instance
  fastify.get(
    '/:id/recording/status',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        const response = await axios.get(`${instance.url}/__admin/recordings/status`, {
          timeout: 10000
        });

        return reply.send({
          success: true,
          data: response.data
        });
      } catch (error) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to get recording status from WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Start recording on WireMock instance
  fastify.post(
    '/:id/recording/start',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      try {
        const body = startRecordingSchema.parse(request.body);

        const instance = await fastify.prisma.wiremockInstance.findUnique({
          where: { id }
        });

        if (!instance) {
          return reply.status(404).send({
            success: false,
            error: 'Instance not found'
          });
        }

        const response = await axios.post(
          `${instance.url}/__admin/recordings/start`,
          { targetBaseUrl: body.targetBaseUrl },
          { timeout: 10000 }
        );

        return reply.send({
          success: true,
          data: response.data
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Validation error',
            details: error.issues
          });
        }
        return reply.status(502).send({
          success: false,
          error: 'Failed to start recording on WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Stop recording on WireMock instance
  fastify.post(
    '/:id/recording/stop',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        const response = await axios.post(
          `${instance.url}/__admin/recordings/stop`,
          {},
          {
            timeout: 10000
          }
        );

        return reply.send({
          success: true,
          data: response.data
        });
      } catch (error) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to stop recording on WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Start recording on all instances in a project
  fastify.post('/recording/start-all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = startRecordingAllSchema.parse(request.body);

      const project = await checkProjectExists(body.projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      const instances = await fastify.prisma.wiremockInstance.findMany({
        where: { projectId: body.projectId, isActive: true }
      });

      const results = await Promise.allSettled(
        instances.map(async (instance) => {
          await axios.post(
            `${instance.url}/__admin/recordings/start`,
            { targetBaseUrl: body.targetBaseUrl },
            { timeout: 10000 }
          );
          return instance.name;
        })
      );

      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          success++;
        } else {
          failed++;
          const reason = result.reason;
          errors.push(axios.isAxiosError(reason) ? reason.message : 'Unknown error');
        }
      }

      return reply.send({
        success: true,
        data: { success, failed, errors }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }
      throw error;
    }
  });

  // Stop recording on all instances in a project
  fastify.post('/recording/stop-all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = stopRecordingAllSchema.parse(request.body);

      const project = await checkProjectExists(body.projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      const instances = await fastify.prisma.wiremockInstance.findMany({
        where: { projectId: body.projectId, isActive: true }
      });

      const results = await Promise.allSettled(
        instances.map(async (instance) => {
          await axios.post(
            `${instance.url}/__admin/recordings/stop`,
            {},
            {
              timeout: 10000
            }
          );
          return instance.name;
        })
      );

      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          success++;
        } else {
          failed++;
          const reason = result.reason;
          errors.push(axios.isAxiosError(reason) ? reason.message : 'Unknown error');
        }
      }

      return reply.send({
        success: true,
        data: { success, failed, errors }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }
      throw error;
    }
  });

  // Reset WireMock instance
  fastify.post(
    '/:id/reset',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        // Delete all mappings from WireMock
        await axios.delete(`${instance.url}/__admin/mappings`, {
          timeout: 10000
        });

        return reply.send({
          success: true,
          message: 'WireMock instance reset successfully'
        });
      } catch (error) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to reset WireMock instance',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Reset scenarios on WireMock instance
  fastify.post(
    '/:id/scenarios/reset',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'Instance not found'
        });
      }

      try {
        await axios.post(
          `${instance.url}/__admin/scenarios/reset`,
          {},
          {
            timeout: 10000
          }
        );

        return reply.send({
          success: true,
          message: 'Scenarios reset successfully'
        });
      } catch (error) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to reset scenarios on WireMock',
          details: axios.isAxiosError(error) ? error.message : 'Unknown error'
        });
      }
    }
  );
}

interface ImportOptions {
  name: string;
  urlMatchType: 'url' | 'urlPath' | 'urlPattern' | 'urlPathPattern';
  urlPattern: string;
  matchHeaders: string[];
  bodyMatchType?: 'equalTo' | 'equalToJson' | 'contains' | 'matches';
  bodyMatchOptions?: {
    ignoreArrayOrder?: boolean;
    ignoreExtraElements?: boolean;
  };
  responseHeaders: string[];
  enableTemplating: boolean;
}

interface WireMockLoggedRequest {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    headers?: Record<string, string>;
    body?: string;
    bodyAsBase64?: string;
  };
  responseDefinition?: {
    status: number;
    headers?: Record<string, string>;
    body?: string;
  };
}

function generateMapping(
  wiremockRequest: WireMockLoggedRequest,
  options: ImportOptions
): Record<string, unknown> {
  const mapping: Record<string, unknown> = {
    name: options.name,
    request: {
      method: wiremockRequest.request.method,
      [options.urlMatchType]: options.urlPattern
    },
    response: {
      status: wiremockRequest.response?.status || wiremockRequest.responseDefinition?.status || 200
    }
  };

  const requestMapping = mapping.request as Record<string, unknown>;
  const responseMapping = mapping.response as Record<string, unknown>;

  // Header matching
  if (options.matchHeaders.length > 0) {
    const headers: Record<string, { equalTo: string }> = {};
    for (const header of options.matchHeaders) {
      const headerValue = wiremockRequest.request.headers[header];
      if (headerValue) {
        headers[header] = { equalTo: headerValue };
      }
    }
    if (Object.keys(headers).length > 0) {
      requestMapping.headers = headers;
    }
  }

  // Body matching
  if (options.bodyMatchType && wiremockRequest.request.body) {
    const bodyPattern: Record<string, unknown> = {};

    if (options.bodyMatchType === 'equalToJson') {
      try {
        bodyPattern.equalToJson = JSON.parse(wiremockRequest.request.body);
        if (options.bodyMatchOptions?.ignoreArrayOrder) {
          bodyPattern.ignoreArrayOrder = true;
        }
        if (options.bodyMatchOptions?.ignoreExtraElements) {
          bodyPattern.ignoreExtraElements = true;
        }
      } catch {
        bodyPattern.equalTo = wiremockRequest.request.body;
      }
    } else {
      bodyPattern[options.bodyMatchType] = wiremockRequest.request.body;
    }

    requestMapping.bodyPatterns = [bodyPattern];
  }

  // Response headers
  const sourceHeaders =
    wiremockRequest.response?.headers || wiremockRequest.responseDefinition?.headers;
  if (options.responseHeaders.length > 0 && sourceHeaders) {
    const headers: Record<string, string> = {};
    for (const header of options.responseHeaders) {
      if (sourceHeaders[header]) {
        headers[header] = sourceHeaders[header];
      }
    }
    if (Object.keys(headers).length > 0) {
      responseMapping.headers = headers;
    }
  }

  // Response body (prefer bodyAsBase64 for proxied/recorded responses)
  let sourceBody: string | undefined;
  const base64Body = wiremockRequest.response?.bodyAsBase64;
  if (base64Body) {
    try {
      sourceBody = decodeBase64Body(base64Body);
    } catch {
      // Fall through
    }
  }
  if (!sourceBody) {
    sourceBody = wiremockRequest.response?.body || wiremockRequest.responseDefinition?.body;
  }
  if (sourceBody) {
    try {
      responseMapping.jsonBody = JSON.parse(sourceBody);
    } catch {
      responseMapping.body = sourceBody;
    }
  }

  // Templating
  if (options.enableTemplating) {
    responseMapping.transformers = ['response-template'];
  }

  return mapping;
}

/**
 * Decode a base64-encoded body, decompressing gzip if needed.
 * WireMock stores proxied/recorded response bodies as base64 in `bodyAsBase64`.
 * When the upstream returns gzip-compressed data, the base64 contains raw gzip bytes.
 */
function decodeBase64Body(base64: string): string {
  const buf = Buffer.from(base64, 'base64');
  // Gzip magic number: 0x1f 0x8b
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf-8');
  }
  return buf.toString('utf-8');
}

/**
 * Process a WireMock request log entry, decoding base64/gzip bodies into readable text.
 */
function decodeRequestLogBodies(entry: Record<string, unknown>): void {
  const response = entry.response as Record<string, unknown> | undefined;
  if (response?.bodyAsBase64) {
    try {
      response.body = decodeBase64Body(response.bodyAsBase64 as string);
    } catch {
      // Keep original body
    }
  }
  const req = entry.request as Record<string, unknown> | undefined;
  if (req?.bodyAsBase64) {
    try {
      req.body = decodeBase64Body(req.bodyAsBase64 as string);
    } catch {
      // Keep original body
    }
  }
}
