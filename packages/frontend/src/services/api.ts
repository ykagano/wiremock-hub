import axios, { AxiosInstance, AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
  baseUrl: string
  createdAt: string
  updatedAt: string
  wiremockInstances?: WiremockInstance[]
  stubCount?: number
}

export interface CreateProjectInput {
  name: string
  description?: string
  baseUrl: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  baseUrl?: string
}

// Project API
export const projectApi = {
  async list(): Promise<Project[]> {
    const response = await apiClient.get<ApiResponse<Project[]>>('/api/projects')
    return response.data.data || []
  },

  async get(id: string): Promise<Project> {
    const response = await apiClient.get<ApiResponse<Project>>(`/api/projects/${id}`)
    return response.data.data!
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const response = await apiClient.post<ApiResponse<Project>>('/api/projects', input)
    return response.data.data!
  },

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const response = await apiClient.put<ApiResponse<Project>>(`/api/projects/${id}`, input)
    return response.data.data!
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/projects/${id}`)
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
    const response = await apiClient.get<ApiResponse<WiremockInstance[]>>('/api/wiremock-instances', {
      params: { projectId }
    })
    return response.data.data || []
  },

  async get(id: string): Promise<WiremockInstance> {
    const response = await apiClient.get<ApiResponse<WiremockInstance>>(`/api/wiremock-instances/${id}`)
    return response.data.data!
  },

  async create(input: CreateWiremockInstanceInput): Promise<WiremockInstance> {
    const response = await apiClient.post<ApiResponse<WiremockInstance>>('/api/wiremock-instances', input)
    return response.data.data!
  },

  async update(id: string, input: UpdateWiremockInstanceInput): Promise<WiremockInstance> {
    const response = await apiClient.put<ApiResponse<WiremockInstance>>(`/api/wiremock-instances/${id}`, input)
    return response.data.data!
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/wiremock-instances/${id}`)
  },

  async getMappings(id: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/api/wiremock-instances/${id}/mappings`)
    return response.data.data
  },

  async getRequests(id: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/api/wiremock-instances/${id}/requests`)
    return response.data.data
  },

  async reset(id: string): Promise<void> {
    await apiClient.post(`/api/wiremock-instances/${id}/reset`)
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
    const response = await apiClient.get<ApiResponse<Stub[]>>('/api/stubs', {
      params: { projectId }
    })
    return response.data.data || []
  },

  async get(id: string): Promise<Stub> {
    const response = await apiClient.get<ApiResponse<Stub>>(`/api/stubs/${id}`)
    return response.data.data!
  },

  async create(input: CreateStubInput): Promise<Stub> {
    const response = await apiClient.post<ApiResponse<Stub>>('/api/stubs', input)
    return response.data.data!
  },

  async update(id: string, input: UpdateStubInput): Promise<Stub> {
    const response = await apiClient.put<ApiResponse<Stub>>(`/api/stubs/${id}`, input)
    return response.data.data!
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/stubs/${id}`)
  },

  async sync(id: string, instanceId: string): Promise<void> {
    await apiClient.post(`/api/stubs/${id}/sync`, { instanceId })
  },

  async syncAll(projectId: string, instanceId: string, resetBeforeSync: boolean = true): Promise<{ success: number; failed: number; errors: string[] }> {
    const response = await apiClient.post<ApiResponse<{ success: number; failed: number; errors: string[] }>>('/api/stubs/sync-all', {
      projectId,
      instanceId,
      resetBeforeSync
    })
    return response.data.data!
  }
}

export default apiClient
