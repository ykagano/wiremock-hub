import { describe, it, expect, beforeEach } from 'vitest'
import { getTestApp } from '../setup.js'

describe('Projects API', () => {
  beforeEach(async () => {
    const app = await getTestApp()
    // Clean up all data before each test
    await app.prisma.stub.deleteMany()
    await app.prisma.wiremockInstance.deleteMany()
    await app.prisma.project.deleteMany()
  })

  describe('GET /api/projects', () => {
    it('should return empty array when no projects exist', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects'
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data).toHaveLength(0)
    })

    it('should return list of projects with stub count', async () => {
      const app = await getTestApp()

      // Create a project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'List Test Project' }
      })
      const projectId = createResponse.json().data.id

      // Add a stub to the project
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects'
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      const project = result.data.find((p: { id: string }) => p.id === projectId)
      expect(project).toBeDefined()
      expect(project.stubCount).toBe(1)
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should return project with stubs and instances', async () => {
      const app = await getTestApp()

      // Create a project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Detail Test Project', description: 'Test description' }
      })
      const projectId = createResponse.json().data.id

      // Add a stub
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })

      // Add an instance
      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      })

      const response = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Detail Test Project')
      expect(result.data.description).toBe('Test description')
      expect(result.data.stubs).toHaveLength(1)
      expect(result.data.wiremockInstances).toHaveLength(1)
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })
  })

  describe('POST /api/projects', () => {
    it('should create a project with name only', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'New Project' }
      })

      expect(response.statusCode).toBe(201)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('New Project')
      expect(result.data.id).toBeDefined()
    })

    it('should create a project with name and description', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'New Project', description: 'My description' }
      })

      expect(response.statusCode).toBe(201)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('New Project')
      expect(result.data.description).toBe('My description')
    })

    it('should return 400 for missing name', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
      expect(result.details).toBeDefined()
    })

    it('should return 400 for empty name', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: '' }
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
      expect(result.details).toBeDefined()
    })
  })

  describe('PUT /api/projects/:id', () => {
    it('should update project name', async () => {
      const app = await getTestApp()

      // Create a project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Original Name' }
      })
      const projectId = createResponse.json().data.id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}`,
        payload: { name: 'Updated Name' }
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Updated Name')
    })

    it('should update project description', async () => {
      const app = await getTestApp()

      // Create a project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Test Project', description: 'Original' }
      })
      const projectId = createResponse.json().data.id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}`,
        payload: { description: 'Updated description' }
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.description).toBe('Updated description')
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'PUT',
        url: '/api/projects/00000000-0000-0000-0000-000000000000',
        payload: { name: 'Updated Name' }
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })

    it('should return 400 for empty name', async () => {
      const app = await getTestApp()

      // Create a project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Test Project' }
      })
      const projectId = createResponse.json().data.id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}`,
        payload: { name: '' }
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
      expect(result.details).toBeDefined()
    })
  })

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const app = await getTestApp()

      // Create a project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'To Delete' }
      })
      const projectId = createResponse.json().data.id

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}`
      })
      expect(getResponse.statusCode).toBe(404)
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/projects/00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })
  })

  describe('POST /api/projects/:id/duplicate', () => {
    it('should duplicate a project with stubs and instances', async () => {
      const app = await getTestApp()

      // Create a project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Original Project', description: 'Original description' }
      })
      const projectId = createResponse.json().data.id

      // Add stubs
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Stub 1',
          description: 'Stub description',
          mapping: { request: { url: '/test1' }, response: { status: 200 } }
        }
      })

      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Stub 2',
          mapping: { request: { url: '/test2' }, response: { status: 201, body: 'hello' } }
        }
      })

      // Add an instance
      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'Test Instance',
          url: 'http://localhost:8080'
        }
      })

      // Duplicate the project
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/duplicate`
      })

      expect(response.statusCode).toBe(201)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Original Project (コピー)')
      expect(result.data.id).not.toBe(projectId)
      expect(result.data.stubCount).toBe(2)
      expect(result.data.wiremockInstances).toHaveLength(1)
      expect(result.data.wiremockInstances[0].name).toBe('Test Instance')
      expect(result.data.wiremockInstances[0].url).toBe('http://localhost:8080')

      // Verify the duplicated project details
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/projects/${result.data.id}`
      })
      const detail = detailResponse.json()
      expect(detail.data.description).toBe('Original description')
      expect(detail.data.stubs).toHaveLength(2)
      const stubNames = detail.data.stubs.map((s: { name: string }) => s.name).sort()
      expect(stubNames).toEqual(['Stub 1', 'Stub 2'])

      // Verify the original project is unchanged
      const originalResponse = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}`
      })
      const original = originalResponse.json()
      expect(original.data.name).toBe('Original Project')
      expect(original.data.stubs).toHaveLength(2)
      expect(original.data.wiremockInstances).toHaveLength(1)
    })

    it('should duplicate a project with no stubs or instances', async () => {
      const app = await getTestApp()

      // Create a project with no related data
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Empty Project' }
      })
      const projectId = createResponse.json().data.id

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/duplicate`
      })

      expect(response.statusCode).toBe(201)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Empty Project (コピー)')
      expect(result.data.stubCount).toBe(0)
      expect(result.data.wiremockInstances).toHaveLength(0)
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/00000000-0000-0000-0000-000000000000/duplicate'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })
  })

  describe('POST /api/projects/:id/instances/bulk-update', () => {
    let projectId: string

    beforeEach(async () => {
      const app = await getTestApp()

      // Create a test project
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
          name: 'Test Project',
          description: 'Test project for bulk update'
        }
      })

      expect(createResponse.statusCode).toBe(201)
      const createResult = createResponse.json()
      expect(createResult.success).toBe(true)
      projectId = createResult.data.id
    })

    it('should replace all instances with new ones', async () => {
      const app = await getTestApp()

      // First, add some initial instances
      const old1Response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'old-instance-1',
          url: 'http://old-1:8080'
        }
      })
      const old1Id = old1Response.json().data.id

      const old2Response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'old-instance-2',
          url: 'http://old-2:8080'
        }
      })
      const old2Id = old2Response.json().data.id

      // Bulk update with new instances
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/instances/bulk-update`,
        payload: {
          instances: [
            { name: '10.0.1.100:8080', url: 'http://10.0.1.100:8080' },
            { name: '10.0.1.101:8080', url: 'http://10.0.1.101:8080' },
            { name: '10.0.1.102:8080', url: 'http://10.0.1.102:8080' }
          ]
        }
      })

      expect(response.statusCode).toBe(200)

      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.deleted).toBe(2)
      expect(result.data.created).toBe(3)
      expect(result.data.instances).toHaveLength(3)
      expect(result.data.instances[0].name).toBe('10.0.1.100:8080')
      expect(result.data.instances[0].url).toBe('http://10.0.1.100:8080')

      // Verify old instances are actually deleted from DB
      const oldInstance1Response = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances/${old1Id}`
      })
      expect(oldInstance1Response.statusCode).toBe(404)

      const oldInstance2Response = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances/${old2Id}`
      })
      expect(oldInstance2Response.statusCode).toBe(404)

      // Verify new instances have correct projectId
      const newInstance = result.data.instances[0]
      const newInstanceResponse = await app.inject({
        method: 'GET',
        url: `/api/wiremock-instances/${newInstance.id}`
      })
      expect(newInstanceResponse.statusCode).toBe(200)
      expect(newInstanceResponse.json().data.projectId).toBe(projectId)
    })

    it('should delete all instances when empty array is provided', async () => {
      const app = await getTestApp()

      // Add an instance first
      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: {
          projectId,
          name: 'instance-to-delete',
          url: 'http://delete-me:8080'
        }
      })

      // Bulk update with empty array
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/instances/bulk-update`,
        payload: {
          instances: []
        }
      })

      expect(response.statusCode).toBe(200)

      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.deleted).toBe(1)
      expect(result.data.created).toBe(0)
      expect(result.data.instances).toHaveLength(0)
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/00000000-0000-0000-0000-000000000000/instances/bulk-update',
        payload: {
          instances: [
            { name: '10.0.1.100:8080', url: 'http://10.0.1.100:8080' }
          ]
        }
      })

      expect(response.statusCode).toBe(404)

      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })

    it('should return 400 for invalid URL', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/instances/bulk-update`,
        payload: {
          instances: [
            { name: 'invalid', url: 'not-a-valid-url' }
          ]
        }
      })

      expect(response.statusCode).toBe(400)

      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
      expect(result.details).toBeDefined()
    })

    it('should return 400 for empty instance name', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/instances/bulk-update`,
        payload: {
          instances: [
            { name: '', url: 'http://10.0.1.100:8080' }
          ]
        }
      })

      expect(response.statusCode).toBe(400)

      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
      expect(result.details).toBeDefined()
    })
  })
})
