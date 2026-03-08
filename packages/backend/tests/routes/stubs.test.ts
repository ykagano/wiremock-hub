import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../setup.js';

describe('Stubs API', () => {
  let projectId: string;

  beforeEach(async () => {
    const app = await getTestApp();

    // Clean up all data before each test
    await app.prisma.stub.deleteMany();
    await app.prisma.wiremockInstance.deleteMany();
    await app.prisma.project.deleteMany();

    // Create a test project
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Stubs Test Project' }
    });
    projectId = createResponse.json().data.id;
  });

  describe('GET /api/stubs', () => {
    it('should return stubs for a project', async () => {
      const app = await getTestApp();

      // Create a stub
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test Stub');
    });

    it('should return empty array when no stubs exist', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return 400 when projectId is missing', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs'
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
        url: '/api/stubs?projectId=00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('GET /api/stubs/:id', () => {
    it('should return a single stub', async () => {
      const app = await getTestApp();

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          description: 'Test description',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });
      const stubId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs/${stubId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Stub');
      expect(result.data.description).toBe('Test description');
      expect(result.data.project).toBeDefined();
    });

    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Stub not found');
    });
  });

  describe('POST /api/stubs', () => {
    it('should create a stub with all fields', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'New Stub',
          description: 'My stub description',
          mapping: {
            request: { method: 'GET', url: '/api/test' },
            response: { status: 200, body: 'OK' }
          }
        }
      });

      expect(response.statusCode).toBe(201);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New Stub');
      expect(result.data.description).toBe('My stub description');
      expect(result.data.mapping).toEqual({
        request: { method: 'GET', url: '/api/test' },
        response: { status: 200, body: 'OK' }
      });
    });

    it('should create a stub without optional fields', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });

      expect(response.statusCode).toBe(201);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should return 400 for missing projectId', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 400 for invalid projectId format', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId: 'invalid-uuid',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });
  });

  describe('PUT /api/stubs/:id', () => {
    it('should update stub name', async () => {
      const app = await getTestApp();

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Original Name',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });
      const stubId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: { name: 'Updated Name' }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
    });

    it('should update stub description', async () => {
      const app = await getTestApp();

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });
      const stubId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: { description: 'New description' }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.description).toBe('New description');
    });

    it('should update stub mapping and increment version', async () => {
      const app = await getTestApp();

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });
      const stubId = createResponse.json().data.id;
      const originalVersion = createResponse.json().data.version;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: {
          mapping: { request: { url: '/updated' }, response: { status: 201 } }
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.mapping.request.url).toBe('/updated');
      expect(result.data.version).toBe(originalVersion + 1);
    });

    it('should update isActive flag', async () => {
      const app = await getTestApp();

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });
      const stubId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: { isActive: false }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'PUT',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000',
        payload: { name: 'Updated Name' }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Stub not found');
    });
  });

  describe('DELETE /api/stubs/:id', () => {
    it('should delete a stub', async () => {
      const app = await getTestApp();

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'To Delete',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      });
      const stubId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/stubs/${stubId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs/${stubId}`
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Stub not found');
    });
  });

  describe('DELETE /api/stubs?projectId=', () => {
    it('should delete all stubs in a project', async () => {
      const app = await getTestApp();

      // Create multiple stubs
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Stub 1',
          mapping: { request: { url: '/test1' }, response: { status: 200 } }
        }
      });
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Stub 2',
          mapping: { request: { url: '/test2' }, response: { status: 200 } }
        }
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/stubs?projectId=${projectId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.deletedCount).toBe(2);

      // Verify all stubs are deleted
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      expect(listResponse.json().data).toHaveLength(0);
    });

    it('should return 400 when projectId is missing', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stubs'
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('projectId is required');
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stubs?projectId=00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('POST /api/stubs/sync-all', () => {
    it('should return 400 for missing projectId', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: {
          instanceId: '00000000-0000-0000-0000-000000000000'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          instanceId: '00000000-0000-0000-0000-000000000000'
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: {
          projectId,
          instanceId: '00000000-0000-0000-0000-000000000000'
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('WireMock instance not found');
    });

    it('should default resetBeforeSync to true', async () => {
      const app = await getTestApp();

      // Create an instance with an unreachable URL (will fail at reset step)
      const instanceResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Unreachable WM',
          url: 'http://localhost:19999'
        }
      });
      const instanceId = instanceResponse.json().data.id;

      // Without resetBeforeSync, defaults to true, so it will try to reset and fail
      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: {
          projectId,
          instanceId
        }
      });

      // Should get 502 because reset fails (WireMock not reachable)
      expect(response.statusCode).toBe(502);
      expect(response.json().error).toBe('Failed to reset WireMock mappings');
    });

    it('should skip reset when resetBeforeSync is false and attempt to register stubs', async () => {
      const app = await getTestApp();

      // Create an instance with an unreachable URL
      const instanceResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Append WM',
          url: 'http://localhost:19999'
        }
      });
      const instanceId = instanceResponse.json().data.id;

      // Create a stub
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Append Stub',
          mapping: { request: { url: '/append-test' }, response: { status: 200 } }
        }
      });

      // With resetBeforeSync=false, it should skip reset and try to register stubs
      // Since WireMock is unreachable, stub registration will fail but reset step is skipped
      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: {
          projectId,
          instanceId,
          resetBeforeSync: false
        }
      });

      // Should return 200 with failed count (not 502 from reset)
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.failed).toBe(1);
      expect(result.data.success).toBe(0);
    });

    it('should only sync active stubs when resetBeforeSync is false', async () => {
      const app = await getTestApp();

      // Create an instance
      const instanceResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Active Test WM',
          url: 'http://localhost:19999'
        }
      });
      const instanceId = instanceResponse.json().data.id;

      // Create an active stub
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Active Stub',
          mapping: { request: { url: '/active' }, response: { status: 200 } }
        }
      });

      // Create an inactive stub
      const inactiveResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Inactive Stub',
          mapping: { request: { url: '/inactive' }, response: { status: 200 } }
        }
      });
      const inactiveStubId = inactiveResponse.json().data.id;
      await app.inject({
        method: 'PUT',
        url: `/api/stubs/${inactiveStubId}`,
        payload: { isActive: false }
      });

      // Append (resetBeforeSync=false) - should only attempt to sync the active stub
      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: {
          projectId,
          instanceId,
          resetBeforeSync: false
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      // Only 1 stub should be attempted (the active one), not 2
      expect(result.data.failed).toBe(1); // fails because WireMock unreachable
      expect(result.data.success).toBe(0);
    });
  });

  describe('POST /api/stubs/:id/test', () => {
    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000/test',
        payload: {}
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('Stub not found');
    });

    it('should return 400 when no active instances exist', async () => {
      const app = await getTestApp();
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { method: 'GET', url: '/api/test' }, response: { status: 200 } }
        }
      });
      const stubId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('No active WireMock instances found in this project');
    });

    it('should return 400 for urlPattern without URL override', async () => {
      const app = await getTestApp();
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Pattern Stub',
          mapping: {
            request: { method: 'GET', urlPattern: '/api/users/.*' },
            response: { status: 200 }
          }
        }
      });
      const stubId = createResponse.json().data.id;

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('URL override is required');
    });

    it('should return 400 for urlPathPattern without URL override', async () => {
      const app = await getTestApp();
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Path Pattern Stub',
          mapping: {
            request: { method: 'POST', urlPathPattern: '/api/items/[0-9]+' },
            response: { status: 201 }
          }
        }
      });
      const stubId = createResponse.json().data.id;

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('URL override is required');
    });

    it('should accept urlPattern with URL override and attempt test (connection error expected)', async () => {
      const app = await getTestApp();
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Pattern Stub with Override',
          mapping: {
            request: { method: 'GET', urlPattern: '/api/users/.*' },
            response: { status: 200, body: 'OK' }
          }
        }
      });
      const stubId = createResponse.json().data.id;

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: { url: '/api/users/123' }
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.stubId).toBe(stubId);
      expect(result.data.request.method).toBe('GET');
      expect(result.data.request.url).toBe('/api/users/123');
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].success).toBe(false);
      expect(result.data.results[0].error).toBeDefined();
      expect(result.data.summary.total).toBe(1);
      expect(result.data.summary.failed).toBe(1);
    });

    it('should extract headers and body from mapping for test request', async () => {
      const app = await getTestApp();
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Full Stub',
          mapping: {
            request: {
              method: 'POST',
              url: '/api/data',
              headers: {
                'Content-Type': { equalTo: 'application/json' },
                Authorization: { equalTo: 'Bearer token123' }
              },
              queryParameters: {
                page: { equalTo: '1' },
                limit: { equalTo: '10' }
              },
              bodyPatterns: [{ equalToJson: '{"key":"value"}' }]
            },
            response: { status: 201, body: '{"id":1}' }
          }
        }
      });
      const stubId = createResponse.json().data.id;

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.data.request.method).toBe('POST');
      expect(result.data.request.url).toBe('/api/data');
      expect(result.data.request.headers['Content-Type']).toBe('application/json');
      expect(result.data.request.headers['Authorization']).toBe('Bearer token123');
      expect(result.data.request.body).toBe('{"key":"value"}');
    });

    it('should use GET as default method when not specified', async () => {
      const app = await getTestApp();
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'No Method Stub',
          mapping: {
            request: { url: '/api/default' },
            response: { status: 200 }
          }
        }
      });
      const stubId = createResponse.json().data.id;

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.request.method).toBe('GET');
    });
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
          content: JSON.stringify({ openapi: '3.0.0', info: { title: 'No Paths', version: '1' } }),
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
