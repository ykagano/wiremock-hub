export interface Project {
  id: string;
  name: string;
  description?: string;
  baseUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  baseUrl: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  baseUrl?: string;
}

export interface WiremockInstance {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
}

export interface CreateWiremockInstanceInput {
  name: string;
  url: string;
  projectId: string;
}

export interface UpdateWiremockInstanceInput {
  name?: string;
  url?: string;
  isActive?: boolean;
}

export interface Stub {
  id: string;
  name?: string;
  description?: string;
  mapping: Record<string, unknown>;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
}

export interface CreateStubInput {
  name?: string;
  description?: string;
  mapping: Record<string, unknown>;
  projectId: string;
}

export interface UpdateStubInput {
  name?: string;
  description?: string;
  mapping?: Record<string, unknown>;
  isActive?: boolean;
}
