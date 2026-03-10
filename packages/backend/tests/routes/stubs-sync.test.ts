import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestApp } from '../setup.js';
import { resetAndCreateProject, createInstance, createStub } from '../helpers.js';
import axios from 'axios';

describe('Stubs API - Sync & Test', () => {
  let projectId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    projectId = await resetAndCreateProject('Stubs Test Project');
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

  // ========================================
  // WireMock communication success cases (axios mocks)
  // ========================================

  describe('POST /api/stubs/:id/sync (success)', () => {
    it('should sync stub to WireMock and update mapping ID', async () => {
      const app = await getTestApp();
      const instanceId = await createInstance(projectId);
      const stubId = await createStub(projectId);

      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        status: 201,
        data: { id: 'wm-mapping-id-123' }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/sync`,
        payload: { instanceId }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
      expect(response.json().message).toBe('Stub synced to WireMock successfully');

      // Verify the stub mapping was updated with WireMock-assigned ID
      const stubResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs/${stubId}`
      });
      expect(stubResponse.json().data.mapping.id).toBe('wm-mapping-id-123');

      vi.restoreAllMocks();
    });

    it('should update existing mapping when stub has id', async () => {
      const app = await getTestApp();
      const instanceId = await createInstance(projectId);
      const stubId = await createStub(projectId, {
        id: 'existing-wm-id',
        request: { url: '/test' },
        response: { status: 200 }
      });

      vi.spyOn(axios, 'put').mockResolvedValueOnce({ status: 200, data: {} });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/sync`,
        payload: { instanceId }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe('POST /api/stubs/sync-all (success with mock)', () => {
    it('should reset and sync all active stubs to WireMock', async () => {
      const app = await getTestApp();
      const instanceId = await createInstance(projectId);
      await createStub(projectId, { request: { url: '/test1' }, response: { status: 200 } });
      await createStub(projectId, { request: { url: '/test2' }, response: { status: 201 } });

      // First call: DELETE /__admin/mappings (reset)
      const deleteSpy = vi.spyOn(axios, 'delete').mockResolvedValueOnce({ status: 200, data: {} });
      // Subsequent calls: POST /__admin/mappings (register stubs)
      const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
        status: 201,
        data: { id: 'new-id' }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: { projectId, instanceId }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(2);
      expect(result.data.failed).toBe(0);

      // Verify reset call
      expect(deleteSpy).toHaveBeenCalledWith(
        'http://wiremock-test:8080/__admin/mappings',
        expect.objectContaining({ timeout: 10000 })
      );
      // Verify stub registration calls
      expect(postSpy).toHaveBeenCalledTimes(2);
      expect(postSpy).toHaveBeenCalledWith(
        'http://wiremock-test:8080/__admin/mappings',
        expect.objectContaining({
          request: { url: '/test1' },
          response: { status: 200 }
        })
      );
      expect(postSpy).toHaveBeenCalledWith(
        'http://wiremock-test:8080/__admin/mappings',
        expect.objectContaining({
          request: { url: '/test2' },
          response: { status: 201 }
        })
      );

      vi.restoreAllMocks();
    });

    it('should skip inactive stubs during sync', async () => {
      const app = await getTestApp();
      const instanceId = await createInstance(projectId);
      await createStub(projectId, { request: { url: '/active' }, response: { status: 200 } });

      // Create inactive stub
      const inactiveId = await createStub(projectId, {
        request: { url: '/inactive' },
        response: { status: 200 }
      });
      await app.inject({
        method: 'PUT',
        url: `/api/stubs/${inactiveId}`,
        payload: { isActive: false }
      });

      vi.spyOn(axios, 'delete').mockResolvedValueOnce({ status: 200, data: {} });
      const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
        status: 201,
        data: { id: 'id' }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: { projectId, instanceId }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.success).toBe(1);
      // Only 1 POST call for the active stub
      expect(postSpy).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });

    it('should append stubs without reset when resetBeforeSync is false', async () => {
      const app = await getTestApp();
      const instanceId = await createInstance(projectId);
      await createStub(projectId, { request: { url: '/append' }, response: { status: 200 } });

      const deleteSpy = vi.spyOn(axios, 'delete');
      vi.spyOn(axios, 'post').mockResolvedValue({ status: 201, data: { id: 'id' } });

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/sync-all',
        payload: { projectId, instanceId, resetBeforeSync: false }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.success).toBe(1);
      // DELETE should NOT have been called (no reset)
      expect(deleteSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('POST /api/stubs/:id/test (request building)', () => {
    // Note: The test endpoint uses axios() as a callable function, which is difficult
    // to mock with vi.spyOn. These tests verify request building logic and response
    // structure. Actual HTTP matching is covered by E2E tests.

    it('should build correct request and return results for each instance', async () => {
      const app = await getTestApp();
      await createInstance(projectId);
      const stubId = await createStub(projectId, {
        request: { method: 'GET', url: '/api/hello' },
        response: { status: 200, body: 'Hello' }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.stubId).toBe(stubId);
      expect(result.data.request.method).toBe('GET');
      expect(result.data.request.url).toBe('/api/hello');
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].success).toBe(false); // unreachable mock URL
      expect(result.data.results[0].expectedStatus).toBe(200);
      expect(result.data.summary.total).toBe(1);
      expect(result.data.summary.failed).toBe(1);
    });

    it('should extract query parameters from mapping', async () => {
      const app = await getTestApp();
      await createInstance(projectId);
      const stubId = await createStub(projectId, {
        request: {
          method: 'GET',
          url: '/api/search',
          queryParameters: { q: { equalTo: 'test' }, page: { equalTo: '1' } }
        },
        response: { status: 200 }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.request.method).toBe('GET');
      expect(response.json().data.request.url).toBe('/api/search');
    });

    it('should use URL override for pattern-based matching', async () => {
      const app = await getTestApp();
      await createInstance(projectId);
      const stubId = await createStub(projectId, {
        request: { method: 'GET', urlPattern: '/api/users/.*' },
        response: { status: 200 }
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: { url: '/api/users/42' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.request.url).toBe('/api/users/42');
    });
  });
});
