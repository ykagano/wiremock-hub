export interface Project {
  id: string
  name: string
  baseUrl: string
  createdAt: string
}

export interface Mapping {
  id?: string
  uuid?: string
  name?: string
  request: MappingRequest
  response: MappingResponse
  priority?: number
  scenarioName?: string
  requiredScenarioState?: string
  newScenarioState?: string
  persistent?: boolean
  metadata?: {
    'wiremock-gui'?: {
      folder?: string
    }
  }
}

export interface MappingRequest {
  method?: string
  url?: string
  urlPattern?: string
  urlPath?: string
  urlPathPattern?: string
  headers?: Record<string, any>
  queryParameters?: Record<string, any>
  cookies?: Record<string, any>
  bodyPatterns?: BodyPattern[]
}

export interface MappingResponse {
  status: number
  statusMessage?: string
  body?: string
  jsonBody?: any
  bodyFileName?: string
  headers?: Record<string, string>
  additionalProxyRequestHeaders?: Record<string, string>
  fixedDelayMilliseconds?: number
  delayDistribution?: any
  transformers?: string[]
  fromConfiguredStub?: boolean
}

export interface BodyPattern {
  equalTo?: string
  contains?: string
  matches?: string
  doesNotMatch?: string
  equalToJson?: string
  matchesJsonPath?: string
  equalToXml?: string
  matchesXPath?: string
  binaryEqualTo?: string
}

export interface LoggedRequest {
  id: string
  request: {
    url: string
    absoluteUrl: string
    method: string
    clientIp?: string
    headers: Record<string, any>
    cookies?: Record<string, any>
    body?: string
    bodyAsBase64?: string
    loggedDate: number
    loggedDateString: string
    queryParams?: Record<string, string>
    formParams?: Record<string, string>
  }
  responseDefinition?: {
    status: number
    body?: string
    headers?: Record<string, string>
  }
  response?: {
    status: number
    headers?: Record<string, string>
    body?: string
    bodyAsBase64?: string
  }
  wasMatched: boolean
  timing?: {
    addedDelay: number
    processTime: number
    responseSendTime: number
    serveTime: number
    totalTime: number
  }
  stubMapping?: Mapping
}

export interface MappingsResponse {
  mappings: Mapping[]
  meta?: {
    total: number
  }
}

export interface RequestsResponse {
  requests: LoggedRequest[]
  meta?: {
    total: number
  }
}

// Stub test types are defined in @wiremock-hub/shared (single source of truth)
export type { StubTestRequest, StubTestInstanceResult, StubTestResponse } from '@wiremock-hub/shared'
