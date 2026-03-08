import type { Mapping } from '@wiremock-hub/shared';

/** Minimal representation of an OpenAPI / Swagger spec (only the fields we use) */
export interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  paths?: Record<string, Record<string, OpenApiOperation>>;
  produces?: string[];
  components?: {
    schemas?: Record<string, JsonSchema>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Subset of JSON Schema used in OpenAPI specs */
export interface JsonSchema {
  $ref?: string;
  type?: string;
  format?: string;
  example?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  [key: string]: unknown;
}

/** OpenAPI request body object (3.x) */
export interface OpenApiRequestBody {
  $ref?: string;
  content?: Record<string, OpenApiMediaType>;
  [key: string]: unknown;
}

/** OpenAPI parameter object (Swagger 2.x body parameter) */
export interface OpenApiParameter {
  in?: string;
  name?: string;
  schema?: JsonSchema;
  [key: string]: unknown;
}

/** OpenAPI operation object */
export interface OpenApiOperation {
  responses?: Record<string, OpenApiResponse>;
  requestBody?: OpenApiRequestBody;
  parameters?: OpenApiParameter[];
  produces?: string[];
  summary?: string;
  description?: string;
  [key: string]: unknown;
}

/** OpenAPI response object */
export interface OpenApiResponse {
  $ref?: string;
  content?: Record<string, OpenApiMediaType>;
  schema?: JsonSchema;
  examples?: Record<string, unknown>;
  [key: string]: unknown;
}

/** OpenAPI media type object */
export interface OpenApiMediaType {
  schema?: JsonSchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
  [key: string]: unknown;
}

/** Detect if content is JSON or YAML */
export function detectFormat(content: string): 'json' | 'yaml' {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  return 'yaml';
}

/** Resolve a $ref reference within the spec */
export function resolveRef(spec: OpenApiSpec, ref: string): JsonSchema | undefined {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.substring(2).split('/');
  let current: unknown = spec;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as JsonSchema | undefined;
}

/** Resolve an object, following $ref if present */
export function resolveSchema(
  spec: OpenApiSpec,
  obj: JsonSchema | OpenApiResponse | null | undefined
): JsonSchema | OpenApiResponse | null | undefined {
  if (!obj) return obj;
  if (obj.$ref) {
    return resolveRef(spec, obj.$ref);
  }
  return obj;
}

const FORMAT_SAMPLES: Record<string, string> = {
  date: '2024-01-01',
  'date-time': '2024-01-01T00:00:00Z',
  email: 'user@example.com',
  uri: 'https://example.com'
};

/** Generate a sample value from a JSON Schema */
export function generateSample(
  spec: OpenApiSpec,
  schema: JsonSchema | null | undefined,
  depth = 0
): unknown {
  if (!schema || depth > 5) return undefined;
  schema = resolveSchema(spec, schema) as JsonSchema | null | undefined;
  if (!schema) return undefined;

  if (schema.example !== undefined) return schema.example;

  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'string':
      return (schema.format && FORMAT_SAMPLES[schema.format]) || 'string';
    case 'integer':
      return 0;
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      if (schema.items) {
        const item = generateSample(spec, schema.items, depth + 1);
        return item !== undefined ? [item] : [];
      }
      return [];
    case 'object': {
      const obj: Record<string, unknown> = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          const val = generateSample(spec, prop, depth + 1);
          if (val !== undefined) obj[key] = val;
        }
      }
      return obj;
    }
    default:
      // Handle allOf/oneOf/anyOf
      if (schema.allOf && Array.isArray(schema.allOf)) {
        const merged: Record<string, unknown> = {};
        for (const sub of schema.allOf) {
          const resolved = generateSample(spec, sub, depth + 1);
          if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) {
            Object.assign(merged, resolved as Record<string, unknown>);
          }
        }
        return Object.keys(merged).length > 0 ? merged : undefined;
      }
      if (schema.oneOf?.[0] || schema.anyOf?.[0]) {
        return generateSample(spec, schema.oneOf?.[0] || schema.anyOf?.[0], depth + 1);
      }
      // If it has properties but no type, treat as object
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          const val = generateSample(spec, prop, depth + 1);
          if (val !== undefined) obj[key] = val;
        }
        return Object.keys(obj).length > 0 ? obj : undefined;
      }
      return undefined;
  }
}

/** Check if a path contains parameter templates like {id} */
export function hasPathParams(path: string): boolean {
  return /\{[^}]+\}/.test(path);
}

/** Convert OpenAPI path params to WireMock regex pattern */
export function pathToPattern(path: string): string {
  return path.replace(/\{[^}]+\}/g, '[^/]+');
}

/** Find the first success status code from responses */
export function findSuccessStatus(responses: Record<string, unknown>): number {
  const codes = Object.keys(responses)
    .filter((c) => /^2\d{2}$/.test(c))
    .sort();
  if (codes.length > 0) return parseInt(codes[0], 10);
  if (responses['default']) return 200;
  return 200;
}

/** Build a WireMock Mapping from an OpenAPI operation */
export function buildMappingFromOperation(
  spec: OpenApiSpec,
  path: string,
  method: string,
  operation: OpenApiOperation
): Mapping {
  const responses = operation.responses || {};
  const status = findSuccessStatus(responses);
  const responseObj = resolveSchema(spec, responses[String(status)] || responses['default']) as
    | OpenApiResponse
    | null
    | undefined;

  const request: Mapping['request'] = { method };

  if (hasPathParams(path)) {
    request.urlPathPattern = pathToPattern(path);
  } else {
    request.urlPath = path;
  }

  const response: Mapping['response'] = { status };

  // Determine content type and response body
  let contentType = 'application/json';
  let responseBody: unknown;

  if (responseObj) {
    // OpenAPI 3.x
    if (responseObj.content) {
      const mediaTypes = Object.keys(responseObj.content);
      const jsonType = mediaTypes.find((t) => t.includes('json'));
      const selectedType = jsonType || mediaTypes[0];
      if (selectedType) contentType = selectedType;

      const mediaObj = responseObj.content[selectedType];
      if (mediaObj) {
        if (mediaObj.example !== undefined) {
          responseBody = mediaObj.example;
        } else if (mediaObj.examples) {
          const firstExample = Object.values(mediaObj.examples)[0];
          if (firstExample?.value !== undefined) {
            responseBody = firstExample.value;
          }
        }
        if (responseBody === undefined && mediaObj.schema) {
          responseBody = generateSample(spec, mediaObj.schema);
        }
      }
    }

    // Swagger 2.x
    if (responseBody === undefined && responseObj.examples) {
      const jsonExample = responseObj.examples['application/json'];
      if (jsonExample !== undefined) {
        responseBody = jsonExample;
      } else {
        const firstKey = Object.keys(responseObj.examples)[0];
        if (firstKey) {
          contentType = firstKey;
          responseBody = responseObj.examples[firstKey];
        }
      }
    }
    if (responseBody === undefined && responseObj.schema) {
      responseBody = generateSample(spec, responseObj.schema);
      // Swagger 2.x: check produces for content type
      const produces = operation.produces || spec.produces;
      if (produces && Array.isArray(produces) && produces.length > 0) {
        contentType = produces[0];
      }
    }
  }

  if (responseBody !== undefined) {
    if (contentType.includes('json') && typeof responseBody === 'object') {
      response.jsonBody = responseBody as Record<string, unknown>;
    } else {
      response.body =
        typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
    }
  }

  response.headers = { 'Content-Type': contentType };

  // Generate request body for methods that typically have a body
  const bodyMethods = ['POST', 'PUT', 'PATCH'];
  if (bodyMethods.includes(method.toUpperCase())) {
    let requestBodySample: unknown;

    // OpenAPI 3.x: requestBody
    if (operation.requestBody) {
      const reqBody = resolveSchema(spec, operation.requestBody as JsonSchema) as
        | OpenApiRequestBody
        | null
        | undefined;
      if (reqBody?.content) {
        const mediaTypes = Object.keys(reqBody.content);
        const jsonType = mediaTypes.find((t) => t.includes('json'));
        const selectedType = jsonType || mediaTypes[0];
        const mediaObj = selectedType ? reqBody.content[selectedType] : undefined;
        if (mediaObj?.schema) {
          requestBodySample = generateSample(spec, mediaObj.schema);
        }
      }
    }

    // Swagger 2.x: parameters with in: body
    if (requestBodySample === undefined && operation.parameters) {
      const bodyParam = operation.parameters.find((p) => p.in === 'body');
      if (bodyParam?.schema) {
        requestBodySample = generateSample(spec, bodyParam.schema);
      }
    }

    if (requestBodySample !== undefined) {
      const bodyJson =
        typeof requestBodySample === 'string'
          ? requestBodySample
          : JSON.stringify(requestBodySample, null, 2);
      request.bodyPatterns = [{ equalToJson: bodyJson }];
    }
  }

  return { request, response };
}
