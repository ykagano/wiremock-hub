import axios, { AxiosInstance } from 'axios'
import type { Mapping, MappingsResponse, RequestsResponse } from '@/types/wiremock'

export class WireMockAPI {
  private client: AxiosInstance

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })
  }

  // ===== Health Check =====
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/__admin/mappings')
      return true
    } catch {
      return false
    }
  }

  // ===== Mappings =====
  async getMappings(): Promise<MappingsResponse> {
    const response = await this.client.get('/__admin/mappings')
    return response.data
  }

  async getMapping(id: string): Promise<Mapping> {
    const response = await this.client.get(`/__admin/mappings/${id}`)
    return response.data
  }

  async createMapping(mapping: Mapping): Promise<Mapping> {
    const response = await this.client.post('/__admin/mappings', mapping)
    return response.data
  }

  async updateMapping(id: string, mapping: Mapping): Promise<Mapping> {
    const response = await this.client.put(`/__admin/mappings/${id}`, mapping)
    return response.data
  }

  async deleteMapping(id: string): Promise<void> {
    await this.client.delete(`/__admin/mappings/${id}`)
  }

  async resetMappings(): Promise<void> {
    await this.client.post('/__admin/mappings/reset')
  }

  async saveMappings(): Promise<void> {
    await this.client.post('/__admin/mappings/save')
  }

  // ===== Requests =====
  async getRequests(): Promise<RequestsResponse> {
    const response = await this.client.get('/__admin/requests')
    return response.data
  }

  async findRequestsByMetadata(metadata: any): Promise<RequestsResponse> {
    const response = await this.client.post('/__admin/requests/find', metadata)
    return response.data
  }

  async resetRequests(): Promise<void> {
    await this.client.delete('/__admin/requests')
  }

  async getRequestCount(): Promise<{ count: number }> {
    const response = await this.client.get('/__admin/requests/count')
    return response.data
  }

  // ===== Scenarios =====
  async resetScenarios(): Promise<void> {
    await this.client.post('/__admin/scenarios/reset')
  }

  async getAllScenarios(): Promise<any> {
    const response = await this.client.get('/__admin/scenarios')
    return response.data
  }

  // ===== Settings =====
  async getSettings(): Promise<any> {
    const response = await this.client.get('/__admin/settings')
    return response.data
  }

  async updateSettings(settings: any): Promise<void> {
    await this.client.put('/__admin/settings', settings)
  }

  // ===== Shutdown =====
  async shutdown(): Promise<void> {
    await this.client.post('/__admin/shutdown')
  }
}

// Singleton instance management
let apiInstance: WireMockAPI | null = null

export function initWireMockAPI(baseUrl: string): WireMockAPI {
  apiInstance = new WireMockAPI(baseUrl)
  return apiInstance
}

export function getWireMockAPI(): WireMockAPI {
  if (!apiInstance) {
    throw new Error('WireMock API not initialized. Call initWireMockAPI first.')
  }
  return apiInstance
}

export function hasWireMockAPI(): boolean {
  return apiInstance !== null
}
