import { describe, it, expect } from 'vitest'
import { injectHubMetadata } from '../../src/routes/stubs.js'
import type { Mapping } from '@wiremock-hub/shared'

describe('injectHubMetadata', () => {
  const project = { id: 'proj-uuid-123', name: 'Test Project' }

  it('should inject hub_project_id and hub_project_name', () => {
    const mapping: Mapping = {
      request: { method: 'GET', url: '/api/test' },
      response: { status: 200 }
    }

    const result = injectHubMetadata(mapping, project)

    expect(result.metadata).toBeDefined()
    expect(result.metadata!.hub_project_id).toBe('proj-uuid-123')
    expect(result.metadata!.hub_project_name).toBe('Test Project')
  })

  it('should preserve existing metadata fields', () => {
    const mapping: Mapping = {
      request: { method: 'GET', url: '/api/test' },
      response: { status: 200 },
      metadata: {
        'wiremock-gui': { folder: 'my-folder' },
        custom_field: 'custom_value'
      }
    }

    const result = injectHubMetadata(mapping, project)

    expect(result.metadata!['wiremock-gui']).toEqual({ folder: 'my-folder' })
    expect(result.metadata!.custom_field).toBe('custom_value')
    expect(result.metadata!.hub_project_id).toBe('proj-uuid-123')
    expect(result.metadata!.hub_project_name).toBe('Test Project')
  })

  it('should work when metadata is undefined', () => {
    const mapping: Mapping = {
      request: { method: 'POST', url: '/api/data' },
      response: { status: 201 }
    }
    // Ensure metadata is truly undefined
    delete mapping.metadata

    const result = injectHubMetadata(mapping, project)

    expect(result.metadata).toBeDefined()
    expect(result.metadata!.hub_project_id).toBe('proj-uuid-123')
    expect(result.metadata!.hub_project_name).toBe('Test Project')
  })

  it('should not mutate the original mapping', () => {
    const mapping: Mapping = {
      request: { method: 'GET', url: '/api/test' },
      response: { status: 200 },
      metadata: { existing: 'value' }
    }

    const result = injectHubMetadata(mapping, project)

    expect(result).not.toBe(mapping)
    expect(mapping.metadata!.hub_project_id).toBeUndefined()
    expect(mapping.metadata!.hub_project_name).toBeUndefined()
  })

  it('should preserve request and response fields', () => {
    const mapping: Mapping = {
      request: { method: 'PUT', url: '/api/update', headers: { 'Content-Type': { equalTo: 'application/json' } } },
      response: { status: 200, body: '{"ok":true}' },
      priority: 5,
      scenarioName: 'test-scenario'
    }

    const result = injectHubMetadata(mapping, project)

    expect(result.request).toEqual(mapping.request)
    expect(result.response).toEqual(mapping.response)
    expect(result.priority).toBe(5)
    expect(result.scenarioName).toBe('test-scenario')
  })
})
