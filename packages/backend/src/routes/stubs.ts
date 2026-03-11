import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { parse as parseYaml } from 'yaml';
import type { Mapping } from '@wiremock-hub/shared';
import { detectFormat, buildMappingFromOperation } from '../utils/openapi-parser.js';
import { injectHubMetadata, syncStubsToInstance } from '../utils/wiremock-sync.js';

// Re-export for backward compatibility (used by tests)
export { injectHubMetadata };

const createStubSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().optional(),
  mapping: z.any()
});

const updateStubSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  mapping: z.any().optional(),
  isActive: z.boolean().optional()
});

const syncStubSchema = z.object({
  instanceId: z.string().uuid()
});

const stubTestSchema = z.object({
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  queryParameters: z.record(z.string(), z.string()).optional()
});

const importOpenApiSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().max(5 * 1024 * 1024),
  format: z.enum(['json', 'yaml']).optional()
});

export async function stubRoutes(fastify: FastifyInstance) {
  // Helper to check project exists
  async function checkProjectExists(projectId: string) {
    const project = await fastify.prisma.project.findUnique({
      where: { id: projectId }
    });
    return project;
  }

  // List stubs for a project
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

      const stubs = await fastify.prisma.stub.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' }
      });

      return reply.send({
        success: true,
        data: stubs
      });
    }
  );

  // Get single stub
  fastify.get(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const stub = await fastify.prisma.stub.findUnique({
        where: { id },
        include: { project: true }
      });

      if (!stub) {
        return reply.status(404).send({
          success: false,
          error: 'Stub not found'
        });
      }

      return reply.send({
        success: true,
        data: stub
      });
    }
  );

  // Create stub
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createStubSchema.parse(request.body);

      const project = await checkProjectExists(body.projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      const stub = await fastify.prisma.stub.create({
        data: {
          name: body.name,
          description: body.description,
          mapping: body.mapping,
          projectId: body.projectId
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
  });

  // Update stub
  fastify.put(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = updateStubSchema.parse(request.body);

        const existing = await fastify.prisma.stub.findUnique({
          where: { id }
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: 'Stub not found'
          });
        }

        const updateData: any = { ...body };
        if (body.mapping) {
          updateData.version = existing.version + 1;
        }

        const stub = await fastify.prisma.stub.update({
          where: { id },
          data: updateData
        });

        return reply.send({
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

  // Delete all stubs for a project
  fastify.delete(
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

      const result = await fastify.prisma.stub.deleteMany({
        where: { projectId }
      });

      return reply.send({
        success: true,
        data: {
          deletedCount: result.count
        }
      });
    }
  );

  // Delete stub
  fastify.delete(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const existing = await fastify.prisma.stub.findUnique({
        where: { id }
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Stub not found'
        });
      }

      await fastify.prisma.stub.delete({
        where: { id }
      });

      return reply.send({
        success: true,
        message: 'Stub deleted successfully'
      });
    }
  );

  // Build an HTTP request from a stub mapping definition
  function buildTestRequest(
    mapping: Mapping,
    overrides?: {
      url?: string;
      headers?: Record<string, string>;
      body?: string;
      queryParameters?: Record<string, string>;
    }
  ) {
    const method = mapping.request.method || 'GET';

    let url: string | undefined;
    let requiresUrlOverride = false;

    if (mapping.request.url) {
      url = mapping.request.url;
    } else if (mapping.request.urlPath) {
      url = mapping.request.urlPath;
    } else if (mapping.request.urlPattern || mapping.request.urlPathPattern) {
      requiresUrlOverride = true;
      url = overrides?.url;
    }

    if (overrides?.url) {
      url = overrides.url;
    }

    if (!url) {
      if (requiresUrlOverride) {
        return {
          error:
            'URL override is required for pattern-based URL matching (urlPattern/urlPathPattern)'
        };
      }
      return { error: 'No URL could be determined from the stub mapping' };
    }

    const headers: Record<string, string> = {};
    if (mapping.request.headers) {
      for (const [key, value] of Object.entries(mapping.request.headers)) {
        if (typeof value === 'object' && value !== null && 'equalTo' in value) {
          headers[key] = (value as { equalTo: string }).equalTo;
        }
      }
    }
    if (overrides?.headers) {
      Object.assign(headers, overrides.headers);
    }

    const queryParameters: Record<string, string> = {};
    if (mapping.request.queryParameters) {
      for (const [key, value] of Object.entries(mapping.request.queryParameters)) {
        if (typeof value === 'object' && value !== null && 'equalTo' in value) {
          queryParameters[key] = (value as { equalTo: string }).equalTo;
        }
      }
    }
    if (overrides?.queryParameters) {
      Object.assign(queryParameters, overrides.queryParameters);
    }

    let body: string | undefined;
    if (mapping.request.bodyPatterns && mapping.request.bodyPatterns.length > 0) {
      const firstPattern = mapping.request.bodyPatterns[0];
      if (firstPattern.equalToJson) {
        body =
          typeof firstPattern.equalToJson === 'string'
            ? firstPattern.equalToJson
            : JSON.stringify(firstPattern.equalToJson);
      } else if (firstPattern.equalTo) {
        body = firstPattern.equalTo;
      }
    }
    if (overrides?.body !== undefined) {
      body = overrides.body;
    }

    return { method, url, headers, queryParameters, body };
  }

  // Test stub against all WireMock instances
  fastify.post(
    '/:id/test',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const overrides = stubTestSchema.parse(request.body);

        const stub = await fastify.prisma.stub.findUnique({
          where: { id },
          include: { project: true }
        });

        if (!stub) {
          return reply.status(404).send({
            success: false,
            error: 'Stub not found'
          });
        }

        const mapping = stub.mapping as unknown as Mapping;

        const testRequest = buildTestRequest(mapping, overrides);
        if ('error' in testRequest) {
          return reply.status(400).send({
            success: false,
            error: testRequest.error
          });
        }

        const instances = await fastify.prisma.wiremockInstance.findMany({
          where: {
            projectId: stub.projectId,
            isActive: true
          }
        });

        if (instances.length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'No active WireMock instances found in this project'
          });
        }

        const expectedStatus = mapping.response.status;
        let expectedBody: string | undefined;
        if (mapping.response.body) {
          expectedBody = mapping.response.body;
        } else if (mapping.response.jsonBody !== undefined) {
          expectedBody = JSON.stringify(mapping.response.jsonBody);
        }
        const expectedHeaders = mapping.response.headers;

        const results = await Promise.allSettled(
          instances.map(async (instance) => {
            const startTime = Date.now();
            try {
              let requestUrl = `${instance.url}${testRequest.url}`;
              if (Object.keys(testRequest.queryParameters).length > 0) {
                const params = new URLSearchParams(testRequest.queryParameters);
                requestUrl += `?${params.toString()}`;
              }

              const response = await axios({
                method: testRequest.method.toLowerCase(),
                url: requestUrl,
                headers:
                  Object.keys(testRequest.headers).length > 0 ? testRequest.headers : undefined,
                data: testRequest.body || undefined,
                timeout: 10000,
                validateStatus: () => true
              });

              const responseTimeMs = Date.now() - startTime;

              return {
                instanceId: instance.id,
                instanceName: instance.name,
                instanceUrl: instance.url,
                success: true,
                matched: response.status === expectedStatus,
                expectedStatus,
                actualStatus: response.status,
                expectedBody,
                actualBody:
                  typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                expectedHeaders,
                actualHeaders: response.headers as Record<string, string>,
                responseTimeMs
              };
            } catch (err: any) {
              return {
                instanceId: instance.id,
                instanceName: instance.name,
                instanceUrl: instance.url,
                success: false,
                matched: false,
                expectedStatus,
                actualStatus: 0,
                error: err.message || 'Connection error',
                responseTimeMs: Date.now() - startTime
              };
            }
          })
        );

        const instanceResults = results.map((r) =>
          r.status === 'fulfilled'
            ? r.value
            : {
                instanceId: '',
                instanceName: '',
                instanceUrl: '',
                success: false,
                matched: false,
                expectedStatus,
                actualStatus: 0,
                error: r.reason?.message || 'Unknown error'
              }
        );

        const passed = instanceResults.filter((r) => r.matched).length;

        return reply.send({
          success: true,
          data: {
            stubId: id,
            stubName: stub.name || '',
            request: {
              method: testRequest.method,
              url: testRequest.url,
              headers: testRequest.headers,
              body: testRequest.body
            },
            results: instanceResults,
            summary: {
              total: instanceResults.length,
              passed,
              failed: instanceResults.length - passed
            }
          }
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

  // Sync stub to WireMock instance
  fastify.post(
    '/:id/sync',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = syncStubSchema.parse(request.body);

        const stub = await fastify.prisma.stub.findUnique({
          where: { id },
          include: { project: true }
        });

        if (!stub) {
          return reply.status(404).send({
            success: false,
            error: 'Stub not found'
          });
        }

        const instance = await fastify.prisma.wiremockInstance.findFirst({
          where: {
            id: body.instanceId,
            projectId: stub.projectId
          }
        });

        if (!instance) {
          return reply.status(404).send({
            success: false,
            error: 'WireMock instance not found'
          });
        }

        // Send mapping to WireMock
        const mapping = stub.mapping as unknown as Mapping;
        const mappingWithMetadata = injectHubMetadata(mapping, stub.project, stub);
        const wiremockUrl = `${instance.url}/__admin/mappings`;

        try {
          if (mapping.id || mapping.uuid) {
            // Update existing mapping
            const mappingId = mapping.id || mapping.uuid;
            await axios.put(`${wiremockUrl}/${mappingId}`, mappingWithMetadata);
          } else {
            // Create new mapping
            const response = await axios.post(wiremockUrl, mappingWithMetadata);

            // Update stub with WireMock-assigned ID
            if (response.data?.id) {
              await fastify.prisma.stub.update({
                where: { id },
                data: {
                  mapping: { ...mapping, id: response.data.id } as any
                }
              });
            }
          }

          return reply.send({
            success: true,
            message: 'Stub synced to WireMock successfully'
          });
        } catch (wiremockError: any) {
          return reply.status(502).send({
            success: false,
            error: 'Failed to sync with WireMock',
            details: wiremockError.message
          });
        }
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

  // Export stubs for a project (unified WireMock-compatible format)
  fastify.get(
    '/export',
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

      // Use createdAt asc to preserve the original creation order for import
      const stubs = await fastify.prisma.stub.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' }
      });

      const mappings = stubs.map((stub: (typeof stubs)[number]) => {
        const mapping = stub.mapping as Record<string, any>;
        const rest = Object.fromEntries(
          Object.entries(mapping).filter(([k]) => k !== 'id' && k !== 'uuid')
        );
        return {
          ...rest,
          ...(stub.name ? { name: stub.name } : {}),
          metadata: {
            ...mapping?.metadata,
            ...(stub.description ? { hub_description: stub.description } : {}),
            hub_isActive: stub.isActive
          }
        };
      });

      return reply.send({
        mappings,
        meta: { total: mappings.length }
      });
    }
  );

  // Import stubs for a project (unified WireMock-compatible format)
  // Accepts { mappings: [...] } format.
  // Backward compatible: also accepts legacy { stubs: [...] } format.
  fastify.post('/import', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Accept both mappings[] and legacy stubs[] format
      const importSchema = z.object({
        projectId: z.string().uuid(),
        data: z
          .object({
            mappings: z.array(z.object({}).passthrough()).optional(),
            // Legacy Hub format fields
            version: z.string().optional(),
            projectName: z.string().optional(),
            exportedAt: z.string().optional(),
            stubs: z
              .array(
                z.object({
                  name: z.string().nullable().optional(),
                  description: z.string().nullable().optional(),
                  isActive: z.boolean().optional().default(true),
                  mapping: z.object({}).passthrough()
                })
              )
              .optional()
          })
          .passthrough()
      });

      const body = importSchema.parse(request.body);

      const project = await checkProjectExists(body.projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as string[]
      };

      if (body.data.mappings && Array.isArray(body.data.mappings)) {
        // Unified mappings[] format (WireMock-compatible)
        for (const rawMapping of body.data.mappings) {
          try {
            const mapping = rawMapping as Record<string, unknown>;
            const name = (mapping.name as string) || null;
            const metadata = mapping.metadata as Record<string, unknown> | undefined;
            const description = (metadata?.hub_description as string) || null;
            const isActive = metadata?.hub_isActive !== undefined ? !!metadata.hub_isActive : true;

            // Strip id/uuid/name — they belong to the source, not this project
            const cleanMapping = Object.fromEntries(
              Object.entries(mapping).filter(([k]) => k !== 'id' && k !== 'uuid' && k !== 'name')
            );
            // Clean hub-specific metadata
            if (cleanMapping.metadata) {
              cleanMapping.metadata = { ...(cleanMapping.metadata as Record<string, unknown>) };
              delete (cleanMapping.metadata as Record<string, unknown>).hub_description;
              delete (cleanMapping.metadata as Record<string, unknown>).hub_isActive;
            }

            await fastify.prisma.stub.create({
              data: {
                projectId: body.projectId,
                name,
                description,
                isActive,
                mapping: cleanMapping as any
              }
            });
            results.imported++;
          } catch (e: any) {
            results.skipped++;
            results.errors.push(e.message || 'Unknown error');
            fastify.log.warn(`Skipped mapping during import: ${e.message || 'Unknown error'}`);
          }
        }
      } else if (body.data.stubs && Array.isArray(body.data.stubs)) {
        // Legacy Hub stubs[] format (backward compatibility)
        for (const stubData of body.data.stubs) {
          try {
            const mapping = stubData.mapping as any;
            const name = stubData.name ?? mapping?.name ?? null;
            const description = stubData.description ?? mapping?.metadata?.hub_description ?? null;

            const cleanMapping = { ...mapping };
            delete cleanMapping.name;
            if (cleanMapping.metadata) {
              cleanMapping.metadata = { ...cleanMapping.metadata };
              delete cleanMapping.metadata.hub_description;
            }

            await fastify.prisma.stub.create({
              data: {
                projectId: body.projectId,
                name,
                description,
                isActive: stubData.isActive,
                mapping: cleanMapping as any
              }
            });
            results.imported++;
          } catch (e: any) {
            results.skipped++;
            results.errors.push(e.message || 'Unknown error');
            fastify.log.warn(`Skipped stub during import: ${e.message || 'Unknown error'}`);
          }
        }
      } else {
        return reply.status(400).send({
          success: false,
          error: 'Invalid import data: expected "mappings" or "stubs" array'
        });
      }

      return reply.send({
        success: true,
        data: results
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

  // Import stubs from OpenAPI spec
  fastify.post('/import-openapi', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = importOpenApiSchema.parse(request.body);

      const project = await checkProjectExists(body.projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      // Parse content
      let spec: any;
      const format = body.format || detectFormat(body.content);
      try {
        if (format === 'json') {
          spec = JSON.parse(body.content);
        } else {
          spec = parseYaml(body.content);
        }
      } catch {
        return reply.status(400).send({
          success: false,
          error: 'Failed to parse OpenAPI spec as ' + format
        });
      }

      // Validate it looks like an OpenAPI/Swagger spec
      if (!spec.openapi && !spec.swagger) {
        return reply.status(400).send({
          success: false,
          error: 'Not a valid OpenAPI/Swagger spec (missing openapi or swagger field)'
        });
      }

      if (!spec.paths || typeof spec.paths !== 'object') {
        return reply.status(400).send({
          success: false,
          error: 'No paths found in spec'
        });
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as string[]
      };

      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

      for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!pathItem || typeof pathItem !== 'object') continue;

        for (const method of httpMethods) {
          const operation = (pathItem as any)[method];
          if (!operation) continue;

          try {
            const mapping = buildMappingFromOperation(spec, path, method.toUpperCase(), operation);
            const name = `${method.toUpperCase()} ${path}`;

            await fastify.prisma.stub.create({
              data: {
                projectId: body.projectId,
                name,
                description: operation.summary || operation.description || null,
                mapping: mapping as any
              }
            });
            results.imported++;
          } catch (e: any) {
            results.skipped++;
            results.errors.push(`${method.toUpperCase()} ${path}: ${e.message || 'Unknown error'}`);
            fastify.log.warn(
              `Skipped OpenAPI operation during import: ${method.toUpperCase()} ${path} - ${e.message || 'Unknown error'}`
            );
          }
        }
      }

      return reply.send({
        success: true,
        data: results
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

  // Sync all stubs to a WireMock instance
  fastify.post('/sync-all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z
        .object({
          projectId: z.string().uuid(),
          instanceId: z.string().uuid(),
          resetBeforeSync: z.boolean().optional().default(true)
        })
        .parse(request.body);

      const project = await checkProjectExists(body.projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found'
        });
      }

      const instance = await fastify.prisma.wiremockInstance.findFirst({
        where: {
          id: body.instanceId,
          projectId: body.projectId
        }
      });

      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'WireMock instance not found'
        });
      }

      const stubs = await fastify.prisma.stub.findMany({
        where: {
          projectId: body.projectId,
          isActive: true
        }
      });

      const results = { success: 0, failed: 0, errors: [] as string[] };
      const { resetFailed, resetError } = await syncStubsToInstance(
        instance.url,
        stubs,
        project,
        results,
        { resetBeforeSync: body.resetBeforeSync }
      );

      // Return 502 if reset was requested but failed
      if (body.resetBeforeSync && resetFailed) {
        return reply.status(502).send({
          success: false,
          error: 'Failed to reset WireMock mappings',
          details: resetError || 'Unknown error'
        });
      }

      return reply.send({
        success: true,
        data: results
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
}
