import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestApp } from '../setup.js';
import { resetAndCreateProject, createProject } from '../helpers.js';

describe('Stubs API - CRUD', () => {
  let projectId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    projectId = await resetAndCreateProject('Stubs Test Project');
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

  describe('POST /api/stubs/bulk-delete', () => {
    async function createStub(app: Awaited<ReturnType<typeof getTestApp>>, name: string) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name,
          mapping: { request: { url: `/${name}` }, response: { status: 200 } }
        }
      });
      return res.json().data.id as string;
    }

    it('should delete only the specified stubs', async () => {
      const app = await getTestApp();

      const id1 = await createStub(app, 'bulk1');
      const id2 = await createStub(app, 'bulk2');
      await createStub(app, 'bulk3');

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/bulk-delete',
        payload: { projectId, ids: [id1, id2] }
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data.deletedCount).toBe(2);

      // Only the non-selected stub remains
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      });
      const remaining = listResponse.json().data;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('bulk3');
    });

    it('should ignore ids that do not exist', async () => {
      const app = await getTestApp();

      const id1 = await createStub(app, 'bulk1');

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/bulk-delete',
        payload: { projectId, ids: [id1, '00000000-0000-0000-0000-000000000000'] }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.deletedCount).toBe(1);
    });

    it('should not delete stubs from another project', async () => {
      const app = await getTestApp();

      const id1 = await createStub(app, 'bulk1');
      const otherProjectId = await createProject('Other Project');
      const otherRes = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId: otherProjectId,
          name: 'other',
          mapping: { request: { url: '/other' }, response: { status: 200 } }
        }
      });
      const otherId = otherRes.json().data.id as string;

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/bulk-delete',
        payload: { projectId, ids: [id1, otherId] }
      });

      expect(response.statusCode).toBe(200);
      // Only the stub belonging to projectId is deleted
      expect(response.json().data.deletedCount).toBe(1);

      const otherList = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${otherProjectId}`
      });
      expect(otherList.json().data).toHaveLength(1);
    });

    it('should return 400 when ids is empty', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/bulk-delete',
        payload: { projectId, ids: [] }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().success).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/bulk-delete',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          ids: ['11111111-1111-4111-8111-111111111111']
        }
      });

      expect(response.statusCode).toBe(404);
      const result = response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });
});
