import axios, { AxiosInstance, AxiosError } from 'axios'

// Use relative path for API calls to work with nginx proxy in all-in-one mode
// In development: proxied by Vite to localhost:3000
// In production (all-in-one): served from same origin via nginx
// Use import.meta.env.BASE_URL to get the base path from Vite config
const API_BASE_URL = import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`

// Axios instance for backend API
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
})

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    const message = error.response?.data?.error || error.response?.data?.message || error.message
    return Promise.reject(new Error(message))
  }
)

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Project types
export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  wiremockInstances?: WiremockInstance[]
  stubCount?: number
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
}

// Project API
export const projectApi = {
  async list(): Promise<Project[]> {
    const response = await apiClient.get<ApiResponse<Project[]>>('/projects')
    return response.data.data || []
  },

  async get(id: string): Promise<Project> {
    const response = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`)
    return response.data.data!
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const response = await apiClient.post<ApiResponse<Project>>('/projects', input)
    return response.data.data!
  },

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const response = await apiClient.put<ApiResponse<Project>>(`/projects/${id}`, input)
    return response.data.data!
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/projects/${id}`)
  }
}

// WireMock Instance types
export interface WiremockInstance {
  id: string
  name: string
  url: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  projectId: string
  isHealthy?: boolean
}

export interface CreateWiremockInstanceInput {
  projectId: string
  name: string
  url: string
}

export interface UpdateWiremockInstanceInput {
  name?: string
  url?: string
  isActive?: boolean
}

// WireMock Instance API
export const wiremockInstanceApi = {
  async list(projectId: string): Promise<WiremockInstance[]> {
    const response = await apiClient.get<ApiResponse<WiremockInstance[]>>('/wiremock-instances', {
      params: { projectId }
    })
    return response.data.data || []
  },

  async get(id: string): Promise<WiremockInstance> {
    const response = await apiClient.get<ApiResponse<WiremockInstance>>(`/wiremock-instances/${id}`)
    return response.data.data!
  },

  async create(input: CreateWiremockInstanceInput): Promise<WiremockInstance> {
    const response = await apiClient.post<ApiResponse<WiremockInstance>>('/wiremock-instances', input)
    return response.data.data!
  },

  async update(id: string, input: UpdateWiremockInstanceInput): Promise<WiremockInstance> {
    const response = await apiClient.put<ApiResponse<WiremockInstance>>(`/wiremock-instances/${id}`, input)
    return response.data.data!
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/wiremock-instances/${id}`)
  },

  async getMappings(id: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/wiremock-instances/${id}/mappings`)
    return response.data.data
  },

  async getRequests(id: string, limit?: number): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/wiremock-instances/${id}/requests`, {
      params: limit ? { limit } : undefined
    })
    return response.data.data
  },

  async clearRequests(id: string): Promise<void> {
    await apiClient.delete(`/wiremock-instances/${id}/requests`)
  },

  async reset(id: string): Promise<void> {
    await apiClient.post(`/wiremock-instances/${id}/reset`)
  }
}

// Stub types
export interface Stub {
  id: string
  name?: string
  description?: string
  mapping: Record<string, unknown>
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
  projectId: string
}

export interface CreateStubInput {
  projectId: string
  name?: string
  description?: string
  mapping: Record<string, unknown>
}

export interface UpdateStubInput {
  name?: string
  description?: string
  mapping?: Record<string, unknown>
  isActive?: boolean
}

// Stub API
export const stubApi = {
  async list(projectId: string): Promise<Stub[]> {
    const response = await apiClient.get<ApiResponse<Stub[]>>('/stubs', {
      params: { projectId }
    })
    return response.data.data || []
  },

  async get(id: string): Promise<Stub> {
    const response = await apiClient.get<ApiResponse<Stub>>(`/stubs/${id}`)
    return response.data.data!
  },

  async create(input: CreateStubInput): Promise<Stub> {
    const response = await apiClient.post<ApiResponse<Stub>>('/stubs', input)
    return response.data.data!
  },

  async update(id: string, input: UpdateStubInput): Promise<Stub> {
    const response = await apiClient.put<ApiResponse<Stub>>(`/stubs/${id}`, input)
    return response.data.data!
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/stubs/${id}`)
  },

  async deleteAll(projectId: string): Promise<{ deletedCount: number }> {
    const response = await apiClient.delete<ApiResponse<{ deletedCount: number }>>('/stubs', {
      params: { projectId }
    })
    if (!response.data.data) {
      throw new Error('Failed to delete stubs: unexpected response')
    }
    return response.data.data
  },

  async sync(id: string, instanceId: string): Promise<void> {
    await apiClient.post(`/stubs/${id}/sync`, { instanceId })
  },

  async syncAll(projectId: string, instanceId: string, resetBeforeSync: boolean = true): Promise<{ success: number; failed: number; errors: string[] }> {
    const response = await apiClient.post<ApiResponse<{ success: number; failed: number; errors: string[] }>>('/stubs/sync-all', {
      projectId,
      instanceId,
      resetBeforeSync
    })
    return response.data.data!
  }
}

export default apiClient
