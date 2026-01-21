import { describe, it, expect, beforeEach } from 'vitest'
import { getTestApp } from '../setup.js'

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
    await app.inject({
      method: 'POST',
      url: '/api/wiremock-instances',
      payload: {
        projectId,
        name: 'old-instance-1',
        url: 'http://old-1:8080'
      }
    })

    await app.inject({
      method: 'POST',
      url: '/api/wiremock-instances',
      payload: {
        projectId,
        name: 'old-instance-2',
        url: 'http://old-2:8080'
      }
    })

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
  })
})
