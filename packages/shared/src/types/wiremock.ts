/**
 * Raw header/parameter value map where multi-value entries (e.g. repeated
 * Set-Cookie headers) are represented as string arrays.
 */
export type MultiValueMap = Record<string, string | string[]>;

export interface Mapping {
  id?: string;
  uuid?: string;
  name?: string;
  request: MappingRequest;
  response: MappingResponse;
  priority?: number;
  scenarioName?: string;
  requiredScenarioState?: string;
  newScenarioState?: string;
  persistent?: boolean;
  metadata?: {
    'wiremock-gui'?: {
      folder?: string;
    };
    hub_project_id?: string;
    hub_project_name?: string;
    hub_description?: string;
    [key: string]: unknown;
  };
}

export interface MappingRequest {
  method?: string;
  url?: string;
  urlPattern?: string;
  urlPath?: string;
  urlPathPattern?: string;
  headers?: Record<string, unknown>;
  queryParameters?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  bodyPatterns?: BodyPattern[];
}

/** WireMock fault types — when set, all other response attributes are ignored by WireMock */
export type WireMockFault =
  | 'CONNECTION_RESET_BY_PEER'
  | 'EMPTY_RESPONSE'
  | 'MALFORMED_RESPONSE_CHUNK'
  | 'RANDOM_DATA_THEN_CLOSE';

export interface MappingResponse {
  // Optional because fault/proxy responses have no fixed status
  status?: number;
  statusMessage?: string;
  body?: string;
  jsonBody?: unknown;
  bodyFileName?: string;
  // Multi-value response headers (e.g. Set-Cookie) are represented as string arrays
  headers?: MultiValueMap;
  fault?: WireMockFault;
  proxyBaseUrl?: string;
  additionalProxyRequestHeaders?: Record<string, string>;
  fixedDelayMilliseconds?: number;
  delayDistribution?: unknown;
  transformers?: string[];
  fromConfiguredStub?: boolean;
}

export interface BodyPattern {
  equalTo?: string;
  contains?: string;
  matches?: string;
  doesNotMatch?: string;
  equalToJson?: string;
  matchesJsonPath?: string;
  equalToXml?: string;
  matchesXPath?: string;
  binaryEqualTo?: string;
}

/** Multi-value parameter as serialized in the WireMock request journal */
export interface MultiValue {
  key: string;
  values: string[];
}

export interface LoggedRequest {
  id: string;
  request: {
    url: string;
    absoluteUrl: string;
    method: string;
    clientIp?: string;
    // Multi-value headers are serialized as string arrays in the journal
    headers: MultiValueMap;
    cookies?: Record<string, unknown>;
    body?: string;
    bodyAsBase64?: string;
    loggedDate: number;
    loggedDateString: string;
    queryParams?: Record<string, MultiValue>;
    formParams?: Record<string, MultiValue>;
  };
  responseDefinition?: {
    status: number;
    body?: string;
    headers?: MultiValueMap;
  };
  response?: {
    status: number;
    headers?: MultiValueMap;
    body?: string;
    bodyAsBase64?: string;
  };
  wasMatched: boolean;
  timing?: {
    addedDelay: number;
    processTime: number;
    responseSendTime: number;
    serveTime: number;
    totalTime: number;
  };
  stubMapping?: Mapping;
}

export interface MappingsResponse {
  mappings: Mapping[];
  meta?: {
    total: number;
  };
}

export interface RequestsResponse {
  requests: LoggedRequest[];
  meta?: {
    total: number;
  };
}

/** Test request overrides (fields the user can edit before sending) */
export interface StubTestRequest {
  url?: string;
  // Multi-value headers/params (from hasExactly matchers) are sent as string arrays
  headers?: MultiValueMap;
  body?: string;
  queryParameters?: MultiValueMap;
}

/** Test result per instance */
export interface StubTestInstanceResult {
  instanceId: string;
  instanceName: string;
  instanceUrl: string;
  success: boolean;
  matched: boolean;
  expectedStatus: number;
  actualStatus: number;
  expectedBody?: string;
  actualBody?: string;
  expectedHeaders?: MultiValueMap;
  actualHeaders?: MultiValueMap;
  error?: string;
  responseTimeMs?: number;
}

/** Overall test result response */
export interface StubTestResponse {
  stubId: string;
  stubName: string;
  request: {
    method: string;
    url: string;
    headers?: MultiValueMap;
    queryParameters?: MultiValueMap;
    body?: string;
  };
  results: StubTestInstanceResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}
