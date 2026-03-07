import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../setup.js';

describe('WireMock Instances API', () => {
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
      payload: { name: 'Instances Test Project' }
    });
    projectId = createResponse.json().data.id;
  });

  describe('GET /api/wiremock-instances', () => {
    it('should return instances for a project', async () => {
      const app = await getTestApp();

      // Create an instance
      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances?projectId=${projectId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test Instance');
    });

    it('should return empty array when no instances exist', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances?projectId=${projectId}`
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
        url: '/api/wiremock-instances'
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
        url: '/api/wiremock-instances?projectId=00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('GET /api/wiremock-instances/:id', () => {
    it('should return instance with health status (unhealthy when server not available)', async () => {
      const app = await getTestApp();

      // Create an instance pointing to non-existent server
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:9999' // Non-existent server
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances/${instanceId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Instance');
      expect(result.data.url).toBe('http://localhost:9999');
      expect(result.data.isHealthy).toBe(false);
      expect(result.data.project).toBeDefined();
    });

    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  describe('POST /api/wiremock-instances', () => {
    it('should create an instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'New Instance',
          url: 'http://wiremock.local:8080'
        }
      });

      expect(response.statusCode).toBe(201);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New Instance');
      expect(result.data.url).toBe('http://wiremock.local:8080');
      expect(result.data.id).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should return 400 for missing name', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          url: 'http://localhost:8080'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 400 for empty name', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: '',
          url: 'http://localhost:8080'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 400 for missing url', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 400 for invalid url', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'not-a-valid-url'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });
  });

  describe('PUT /api/wiremock-instances/:id', () => {
    it('should update instance name', async () => {
      const app = await getTestApp();

      // Create an instance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Original Name',
          url: 'http://localhost:8080'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/wiremock-instances/${instanceId}`,
        payload: { name: 'Updated Name' }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
    });

    it('should update instance url', async () => {
      const app = await getTestApp();

      // Create an instance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/wiremock-instances/${instanceId}`,
        payload: { url: 'http://localhost:9090' }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.url).toBe('http://localhost:9090');
    });

    it('should update isActive flag', async () => {
      const app = await getTestApp();

      // Create an instance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/wiremock-instances/${instanceId}`,
        payload: { isActive: false }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'PUT',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000',
        payload: { name: 'Updated Name' }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });

    it('should return 400 for empty name', async () => {
      const app = await getTestApp();

      // Create an instance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/wiremock-instances/${instanceId}`,
        payload: { name: '' }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 400 for invalid url', async () => {
      const app = await getTestApp();

      // Create an instance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/wiremock-instances/${instanceId}`,
        payload: { url: 'invalid-url' }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });
  });

  describe('DELETE /api/wiremock-instances/:id', () => {
    it('should delete an instance', async () => {
      const app = await getTestApp();

      // Create an instance
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'To Delete',
          url: 'http://localhost:8080'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/wiremock-instances/${instanceId}`
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances/${instanceId}`
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  // Note: The following endpoints require an actual WireMock server:
  // - GET /api/wiremock-instances/:id/mappings
  // - GET /api/wiremock-instances/:id/requests
  // - GET /api/wiremock-instances/:id/requests/:requestId
  // - POST /api/wiremock-instances/:id/requests/:requestId/import
  // - DELETE /api/wiremock-instances/:id/requests
  // - POST /api/wiremock-instances/:id/reset
  //
  // These are tested via E2E tests which run against actual Docker containers.
  // Here we only test the 404 cases for instance not found.

  describe('GET /api/wiremock-instances/:id/mappings (instance not found)', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/mappings'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  describe('GET /api/wiremock-instances/:id/requests (instance not found)', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/requests'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  describe('GET /api/wiremock-instances/:id/requests/:requestId (instance not found)', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/requests/some-request-id'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  describe('POST /api/wiremock-instances/:id/requests/:requestId/import (instance not found)', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/requests/some-request-id/import',
        payload: {
          projectId,
          name: 'Test Import',
          urlMatchType: 'url',
          urlPattern: '/test'
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  describe('DELETE /api/wiremock-instances/:id/requests (instance not found)', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/requests'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  describe('DELETE /api/wiremock-instances/:id/mappings/:mappingId (instance not found)', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/mappings/some-mapping-id'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  describe('POST /api/wiremock-instances/:id/reset (instance not found)', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/reset'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });
  });

  // Recording endpoints
  describe('GET /api/wiremock-instances/:id/recording/status', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/recording/status'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });

    it('should return 502 when WireMock is unreachable', async () => {
      const app = await getTestApp();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Unreachable Instance',
          url: 'http://localhost:9999'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances/${instanceId}/recording/status`
      });

      expect(response.statusCode).toBe(502);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get recording status from WireMock');
    });
  });

  describe('POST /api/wiremock-instances/:id/recording/start', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/recording/start',
        payload: { targetBaseUrl: 'http://example.com' }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });

    it('should return 400 for missing targetBaseUrl', async () => {
      const app = await getTestApp();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:9999'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/wiremock-instances/${instanceId}/recording/start`,
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 400 for invalid targetBaseUrl', async () => {
      const app = await getTestApp();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:9999'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/wiremock-instances/${instanceId}/recording/start`,
        payload: { targetBaseUrl: 'not-a-url' }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return 502 when WireMock is unreachable', async () => {
      const app = await getTestApp();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Unreachable Instance',
          url: 'http://localhost:9999'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/wiremock-instances/${instanceId}/recording/start`,
        payload: { targetBaseUrl: 'http://example.com' }
      });

      expect(response.statusCode).toBe(502);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to start recording on WireMock');
    });
  });

  describe('POST /api/wiremock-instances/:id/recording/stop', () => {
    it('should return 404 for non-existent instance', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/00000000-0000-0000-0000-000000000000/recording/stop'
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Instance not found');
    });

    it('should return 502 when WireMock is unreachable', async () => {
      const app = await getTestApp();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Unreachable Instance',
          url: 'http://localhost:9999'
        }
      });
      const instanceId = createResponse.json().data.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/wiremock-instances/${instanceId}/recording/stop`
      });

      expect(response.statusCode).toBe(502);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to stop recording on WireMock');
    });
  });

  describe('POST /api/wiremock-instances/recording/start-all', () => {
    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/recording/start-all',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          targetBaseUrl: 'http://example.com'
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should return 400 for missing targetBaseUrl', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/recording/start-all',
        payload: { projectId }
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return success with 0 when no active instances', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/recording/start-all',
        payload: {
          projectId,
          targetBaseUrl: 'http://example.com'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(0);
      expect(result.data.failed).toBe(0);
    });

    it('should report failures for unreachable instances', async () => {
      const app = await getTestApp();

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Unreachable 1',
          url: 'http://localhost:9999'
        }
      });
      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Unreachable 2',
          url: 'http://localhost:9998'
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/recording/start-all',
        payload: {
          projectId,
          targetBaseUrl: 'http://example.com'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(0);
      expect(result.data.failed).toBe(2);
      expect(result.data.errors).toHaveLength(2);
    });
  });

  describe('POST /api/wiremock-instances/recording/stop-all', () => {
    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/recording/stop-all',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000'
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
        url: '/api/wiremock-instances/recording/stop-all',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
    });

    it('should return success with 0 when no active instances', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/recording/stop-all',
        payload: { projectId }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(0);
      expect(result.data.failed).toBe(0);
    });

    it('should report failures for unreachable instances', async () => {
      const app = await getTestApp();

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Unreachable 1',
          url: 'http://localhost:9999'
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances/recording/stop-all',
        payload: { projectId }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(0);
      expect(result.data.failed).toBe(1);
      expect(result.data.errors).toHaveLength(1);
    });
  });
});
