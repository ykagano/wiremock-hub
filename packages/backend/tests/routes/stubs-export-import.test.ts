import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestApp } from '../setup.js';
import { resetAndCreateProject } from '../helpers.js';

describe('Stubs API - Import & Export', () => {
  let projectId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    projectId = await resetAndCreateProject('Stubs Test Project');
  });

  describe('GET /api/stubs/export', () => {
    it('should export stubs in unified WireMock-compatible format', async () => {
      const app = await getTestApp();

      // Create stubs
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Export Stub 1',
          description: 'First stub',
          mapping: { request: { url: '/test1' }, response: { status: 200 } }
        }
      });
      // Create inactive stub
      const inactiveRes = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Export Stub 2',
          mapping: { request: { url: '/test2' }, response: { status: 201 } }
        }
      });
      await app.inject({
        method: 'PUT',
        url: `/api/stubs/${inactiveRes.json().data.id}`,
        payload: { isActive: false }
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs/export?projectId=${projectId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.mappings).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      // name at mapping level
      expect(result.mappings[0].name).toBe('Export Stub 1');
      // hub_description and hub_isActive in metadata
      expect(result.mappings[0].metadata.hub_description).toBe('First stub');
      expect(result.mappings[0].metadata.hub_isActive).toBe(true);
      expect(result.mappings[1].name).toBe('Export Stub 2');
      expect(result.mappings[1].metadata).not.toHaveProperty('hub_description');
      expect(result.mappings[1].metadata.hub_isActive).toBe(false);
      // Should NOT have old Hub-specific top-level keys
      expect(result).not.toHaveProperty('version');
      expect(result).not.toHaveProperty('stubs');
    });

    it('should strip id/uuid from exported mappings', async () => {
      const app = await getTestApp();

      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'WM Export 1',
          mapping: {
            id: 'should-be-stripped',
            uuid: 'should-also-be-stripped',
            request: { method: 'GET', urlPath: '/api/users' },
            response: { status: 200, jsonBody: { users: [] } }
          }
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs/export?projectId=${projectId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.mappings[0]).not.toHaveProperty('id');
      expect(result.mappings[0]).not.toHaveProperty('uuid');
      expect(result.mappings[0].name).toBe('WM Export 1');
      expect(result.mappings[0].request.method).toBe('GET');
    });

    it('should return 400 when projectId is missing', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs/export'
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('projectId is required');
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs/export?projectId=00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('POST /api/stubs/import', () => {
    it('should import stubs from unified mappings[] format', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: {
          projectId,
          data: {
            mappings: [
              {
                id: 'old-id-1',
                uuid: 'old-uuid-1',
                name: 'Get Users',
                request: { method: 'GET', urlPath: '/api/users' },
                response: { status: 200, jsonBody: { users: [] } },
                metadata: { hub_description: 'List all users', hub_isActive: true }
              },
              {
                name: 'Create User',
                request: { method: 'POST', urlPath: '/api/users' },
                response: { status: 201 },
                metadata: { hub_isActive: false }
              }
            ]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.imported).toBe(2);
      expect(result.data.skipped).toBe(0);

      // Verify stubs were created correctly
      const stubsResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const stubs = stubsResponse.json().data;
      expect(stubs).toHaveLength(2);

      const stub1 = stubs.find((s: any) => s.name === 'Get Users');
      expect(stub1).toBeDefined();
      expect(stub1.description).toBe('List all users');
      expect(stub1.isActive).toBe(true);
      // id/uuid should be stripped from mapping
      expect(stub1.mapping.id).toBeUndefined();
      expect(stub1.mapping.uuid).toBeUndefined();
      expect(stub1.mapping.name).toBeUndefined();
      // hub metadata should be cleaned
      expect(stub1.mapping.metadata?.hub_description).toBeUndefined();
      expect(stub1.mapping.metadata?.hub_isActive).toBeUndefined();

      const stub2 = stubs.find((s: any) => s.name === 'Create User');
      expect(stub2).toBeDefined();
      expect(stub2.isActive).toBe(false);
    });

    it('should default isActive to true when hub_isActive is not present', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: {
          projectId,
          data: {
            mappings: [
              {
                name: 'No Active Flag',
                request: { method: 'GET', urlPath: '/test' },
                response: { status: 200 }
              }
            ]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.imported).toBe(1);

      const stubsResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      expect(stubsResponse.json().data[0].isActive).toBe(true);
    });

    it('should support backward-compatible legacy stubs[] format', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: {
          projectId,
          data: {
            version: '1.1',
            projectName: 'Original Project',
            stubs: [
              {
                isActive: true,
                mapping: {
                  name: 'Legacy Stub 1',
                  metadata: { hub_description: 'First legacy stub' },
                  request: { url: '/imported1' },
                  response: { status: 200 }
                }
              },
              {
                isActive: false,
                mapping: {
                  name: 'Legacy Stub 2',
                  request: { url: '/imported2' },
                  response: { status: 201 }
                }
              }
            ]
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.imported).toBe(2);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const stubs = listResponse.json().data;
      expect(stubs).toHaveLength(2);
      const stub1 = stubs.find((s: any) => s.name === 'Legacy Stub 1');
      expect(stub1).toBeDefined();
      expect(stub1.description).toBe('First legacy stub');
      expect(stub1.isActive).toBe(true);
      const stub2 = stubs.find((s: any) => s.name === 'Legacy Stub 2');
      expect(stub2).toBeDefined();
      expect(stub2.isActive).toBe(false);
    });

    it('should return 400 when neither mappings nor stubs provided', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: {
          projectId,
          data: { somethingElse: [] }
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          data: {
            mappings: [
              {
                name: 'Test',
                request: { url: '/test' },
                response: { status: 200 }
              }
            ]
          }
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('POST /api/stubs/import-openapi', () => {
    it('should import stubs from OpenAPI 3.x JSON spec', async () => {
      const app = await getTestApp();

      const openApiSpec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/api/users': {
            get: {
              summary: 'List users',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            post: {
              summary: 'Create user',
              responses: {
                '201': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: {
          projectId,
          content: openApiSpec,
          format: 'json'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.imported).toBe(2);
      expect(result.data.skipped).toBe(0);

      // Verify stubs were created
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const stubs = listResponse.json().data;
      expect(stubs).toHaveLength(2);

      const getStub = stubs.find((s: any) => s.name === 'GET /api/users');
      expect(getStub).toBeDefined();
      expect(getStub.description).toBe('List users');
      expect(getStub.mapping.request.method).toBe('GET');
      expect(getStub.mapping.request.urlPath).toBe('/api/users');
      expect(getStub.mapping.response.status).toBe(200);

      const postStub = stubs.find((s: any) => s.name === 'POST /api/users');
      expect(postStub).toBeDefined();
      expect(postStub.description).toBe('Create user');
      expect(postStub.mapping.response.status).toBe(201);
    });

    it('should import stubs from Swagger 2.x JSON spec', async () => {
      const app = await getTestApp();

      const swaggerSpec = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Legacy API', version: '1.0' },
        produces: ['application/json'],
        paths: {
          '/api/health': {
            get: {
              summary: 'Health check',
              responses: {
                '200': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: {
          projectId,
          content: swaggerSpec,
          format: 'json'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.data.imported).toBe(1);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const stubs = listResponse.json().data;
      expect(stubs[0].mapping.response.jsonBody).toEqual({ status: 'string' });
    });

    it('should handle path parameters by converting to urlPathPattern', async () => {
      const app = await getTestApp();

      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/users/{userId}': {
            get: {
              summary: 'Get user by ID',
              responses: { '200': {} }
            }
          }
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: { projectId, content: spec, format: 'json' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.imported).toBe(1);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const stub = listResponse.json().data[0];
      expect(stub.mapping.request.urlPathPattern).toBe('/api/users/[^/]+');
      expect(stub.mapping.request.urlPath).toBeUndefined();
    });

    it('should auto-detect YAML format', async () => {
      const app = await getTestApp();

      const yamlContent = `openapi: "3.0.0"
info:
  title: YAML API
  version: "1.0"
paths:
  /api/ping:
    get:
      summary: Ping
      responses:
        "200":
          content:
            application/json:
              schema:
                type: object
                properties:
                  pong:
                    type: boolean`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: { projectId, content: yamlContent }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.imported).toBe(1);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const stub = listResponse.json().data[0];
      expect(stub.name).toBe('GET /api/ping');
      expect(stub.mapping.response.jsonBody).toEqual({ pong: false });
    });

    it('should resolve $ref in spec', async () => {
      const app = await getTestApp();

      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Ref Test', version: '1.0' },
        paths: {
          '/api/items': {
            get: {
              summary: 'List items',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/ItemList' }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            ItemList: {
              type: 'array',
              items: { $ref: '#/components/schemas/Item' }
            },
            Item: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                title: { type: 'string' }
              }
            }
          }
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: { projectId, content: spec, format: 'json' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.imported).toBe(1);

      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const stub = listResponse.json().data[0];
      expect(stub.mapping.response.jsonBody).toEqual([{ id: 0, title: 'string' }]);
    });

    it('should return 400 for invalid JSON content', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: { projectId, content: '{ broken json', format: 'json' }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('Failed to parse');
    });

    it('should return 400 for non-OpenAPI content', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: {
          projectId,
          content: JSON.stringify({ name: 'not an openapi spec' }),
          format: 'json'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('Not a valid OpenAPI/Swagger spec');
    });

    it('should return 400 for spec without paths', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: {
          projectId,
          content: JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'No Paths', version: '1' }
          }),
          format: 'json'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('No paths found');
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          content: JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'T', version: '1' },
            paths: { '/x': { get: { responses: { '200': {} } } } }
          }),
          format: 'json'
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('Project not found');
    });

    it('should return 400 for missing required fields', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import-openapi',
        payload: { projectId }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Validation error');
    });
  });
});
