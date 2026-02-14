import { describe, it, expect, beforeEach } from 'vitest'
import { getTestApp } from '../setup.js'

describe('Stubs API', () => {
  let projectId: string

  beforeEach(async () => {
    const app = await getTestApp()

    // Clean up all data before each test
    await app.prisma.stub.deleteMany()
    await app.prisma.wiremockInstance.deleteMany()
    await app.prisma.project.deleteMany()

    // Create a test project
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Stubs Test Project' }
    })
    projectId = createResponse.json().data.id
  })

  describe('GET /api/stubs', () => {
    it('should return stubs for a project', async () => {
      const app = await getTestApp()

      // Create a stub
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
        url: `/api/stubs?projectId=${projectId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Test Stub')
    })

    it('should return empty array when no stubs exist', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(0)
    })

    it('should return 400 when projectId is missing', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs'
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('projectId is required')
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs?projectId=00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })
  })

  describe('GET /api/stubs/:id', () => {
    it('should return a single stub', async () => {
      const app = await getTestApp()

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
      })
      const stubId = createResponse.json().data.id

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs/${stubId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Test Stub')
      expect(result.data.description).toBe('Test description')
      expect(result.data.project).toBeDefined()
    })

    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Stub not found')
    })
  })

  describe('POST /api/stubs', () => {
    it('should create a stub with all fields', async () => {
      const app = await getTestApp()

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
      })

      expect(response.statusCode).toBe(201)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('New Stub')
      expect(result.data.description).toBe('My stub description')
      expect(result.data.mapping).toEqual({
        request: { method: 'GET', url: '/api/test' },
        response: { status: 200, body: 'OK' }
      })
    })

    it('should create a stub without optional fields', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })

      expect(response.statusCode).toBe(201)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.id).toBeDefined()
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })

    it('should return 400 for missing projectId', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
    })

    it('should return 400 for invalid projectId format', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId: 'invalid-uuid',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
    })
  })

  describe('PUT /api/stubs/:id', () => {
    it('should update stub name', async () => {
      const app = await getTestApp()

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Original Name',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })
      const stubId = createResponse.json().data.id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: { name: 'Updated Name' }
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('Updated Name')
    })

    it('should update stub description', async () => {
      const app = await getTestApp()

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })
      const stubId = createResponse.json().data.id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: { description: 'New description' }
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.description).toBe('New description')
    })

    it('should update stub mapping and increment version', async () => {
      const app = await getTestApp()

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })
      const stubId = createResponse.json().data.id
      const originalVersion = createResponse.json().data.version

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: {
          mapping: { request: { url: '/updated' }, response: { status: 201 } }
        }
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.mapping.request.url).toBe('/updated')
      expect(result.data.version).toBe(originalVersion + 1)
    })

    it('should update isActive flag', async () => {
      const app = await getTestApp()

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })
      const stubId = createResponse.json().data.id

      const response = await app.inject({
        method: 'PUT',
        url: `/api/stubs/${stubId}`,
        payload: { isActive: false }
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.isActive).toBe(false)
    })

    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'PUT',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000',
        payload: { name: 'Updated Name' }
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Stub not found')
    })
  })

  describe('DELETE /api/stubs/:id', () => {
    it('should delete a stub', async () => {
      const app = await getTestApp()

      // Create a stub
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'To Delete',
          mapping: { request: { url: '/test' }, response: { status: 200 } }
        }
      })
      const stubId = createResponse.json().data.id

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/stubs/${stubId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)

      // Verify it's deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs/${stubId}`
      })
      expect(getResponse.statusCode).toBe(404)
    })

    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Stub not found')
    })
  })

  describe('DELETE /api/stubs?projectId=', () => {
    it('should delete all stubs in a project', async () => {
      const app = await getTestApp()

      // Create multiple stubs
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Stub 1',
          mapping: { request: { url: '/test1' }, response: { status: 200 } }
        }
      })
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Stub 2',
          mapping: { request: { url: '/test2' }, response: { status: 200 } }
        }
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/stubs?projectId=${projectId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.deletedCount).toBe(2)

      // Verify all stubs are deleted
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      })
      expect(listResponse.json().data).toHaveLength(0)
    })

    it('should return 400 when projectId is missing', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stubs'
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('projectId is required')
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/stubs?projectId=00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })
  })

  describe('POST /api/stubs/:id/test', () => {
    it('should return 404 for non-existent stub', async () => {
      const app = await getTestApp()
      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/00000000-0000-0000-0000-000000000000/test',
        payload: {}
      })
      expect(response.statusCode).toBe(404)
      expect(response.json().error).toBe('Stub not found')
    })

    it('should return 400 when no active instances exist', async () => {
      const app = await getTestApp()
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Test Stub',
          mapping: { request: { method: 'GET', url: '/api/test' }, response: { status: 200 } }
        }
      })
      const stubId = createResponse.json().data.id

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toBe('No active WireMock instances found in this project')
    })

    it('should return 400 for urlPattern without URL override', async () => {
      const app = await getTestApp()
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
      })
      const stubId = createResponse.json().data.id

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('URL override is required')
    })

    it('should return 400 for urlPathPattern without URL override', async () => {
      const app = await getTestApp()
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
      })
      const stubId = createResponse.json().data.id

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('URL override is required')
    })

    it('should accept urlPattern with URL override and attempt test (connection error expected)', async () => {
      const app = await getTestApp()
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
      })
      const stubId = createResponse.json().data.id

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: { url: '/api/users/123' }
      })
      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.stubId).toBe(stubId)
      expect(result.data.request.method).toBe('GET')
      expect(result.data.request.url).toBe('/api/users/123')
      expect(result.data.results).toHaveLength(1)
      expect(result.data.results[0].success).toBe(false)
      expect(result.data.results[0].error).toBeDefined()
      expect(result.data.summary.total).toBe(1)
      expect(result.data.summary.failed).toBe(1)
    })

    it('should extract headers and body from mapping for test request', async () => {
      const app = await getTestApp()
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
                'Authorization': { equalTo: 'Bearer token123' }
              },
              queryParameters: {
                'page': { equalTo: '1' },
                'limit': { equalTo: '10' }
              },
              bodyPatterns: [{ equalToJson: '{"key":"value"}' }]
            },
            response: { status: 201, body: '{"id":1}' }
          }
        }
      })
      const stubId = createResponse.json().data.id

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.data.request.method).toBe('POST')
      expect(result.data.request.url).toBe('/api/data')
      expect(result.data.request.headers['Content-Type']).toBe('application/json')
      expect(result.data.request.headers['Authorization']).toBe('Bearer token123')
      expect(result.data.request.body).toBe('{"key":"value"}')
    })

    it('should use GET as default method when not specified', async () => {
      const app = await getTestApp()
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
      })
      const stubId = createResponse.json().data.id

      await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'Test WM', url: 'http://localhost:9999' }
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/stubs/${stubId}/test`,
        payload: {}
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.request.method).toBe('GET')
    })
  })

  describe('GET /api/stubs/export', () => {
    it('should export stubs for a project', async () => {
      const app = await getTestApp()

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
      })
      await app.inject({
        method: 'POST',
        url: '/api/stubs',
        payload: {
          projectId,
          name: 'Export Stub 2',
          mapping: { request: { url: '/test2' }, response: { status: 201 } }
        }
      })

      const response = await app.inject({
        method: 'GET',
        url: `/api/stubs/export?projectId=${projectId}`
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.version).toBe('1.0')
      expect(result.projectName).toBe('Stubs Test Project')
      expect(result.exportedAt).toBeDefined()
      expect(result.stubs).toHaveLength(2)
      expect(result.stubs[0]).toHaveProperty('name')
      expect(result.stubs[0]).toHaveProperty('mapping')
    })

    it('should return 400 when projectId is missing', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs/export'
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('projectId is required')
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'GET',
        url: '/api/stubs/export?projectId=00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })
  })

  describe('POST /api/stubs/import', () => {
    it('should import stubs into a project', async () => {
      const app = await getTestApp()

      const importData = {
        projectId,
        data: {
          version: '1.0',
          projectName: 'Original Project',
          stubs: [
            {
              name: 'Imported Stub 1',
              description: 'First imported stub',
              isActive: true,
              mapping: {
                request: { url: '/imported1' },
                response: { status: 200 }
              }
            },
            {
              name: 'Imported Stub 2',
              isActive: false,
              mapping: {
                request: { url: '/imported2' },
                response: { status: 201 }
              }
            }
          ]
        }
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: importData
      })

      expect(response.statusCode).toBe(200)
      const result = response.json()
      expect(result.success).toBe(true)
      expect(result.data.imported).toBe(2)
      expect(result.data.skipped).toBe(0)

      // Verify stubs are imported
      const listResponse = await app.inject({
        method: 'GET',
        url: `/api/stubs?projectId=${projectId}`
      })
      expect(listResponse.json().data).toHaveLength(2)
    })

    it('should return 404 for non-existent project', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: {
          projectId: '00000000-0000-0000-0000-000000000000',
          data: {
            stubs: [
              {
                name: 'Test',
                mapping: { request: { url: '/test' }, response: { status: 200 } }
              }
            ]
          }
        }
      })

      expect(response.statusCode).toBe(404)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Project not found')
    })

    it('should return 400 for invalid import data', async () => {
      const app = await getTestApp()

      const response = await app.inject({
        method: 'POST',
        url: '/api/stubs/import',
        payload: {
          projectId,
          data: {
            stubs: [
              { name: 'Invalid' } // Missing mapping
            ]
          }
        }
      })

      expect(response.statusCode).toBe(400)
      const result = response.json()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
    })
  })
})
