import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  resolveRef,
  resolveSchema,
  generateSample,
  hasPathParams,
  pathToPattern,
  findSuccessStatus,
  buildMappingFromOperation
} from '../../src/utils/openapi-parser.js';

describe('openapi-parser', () => {
  describe('detectFormat', () => {
    it('should detect JSON when content starts with {', () => {
      expect(detectFormat('{"openapi": "3.0.0"}')).toBe('json');
    });

    it('should detect JSON when content starts with [', () => {
      expect(detectFormat('[{"id": 1}]')).toBe('json');
    });

    it('should detect JSON with leading whitespace', () => {
      expect(detectFormat('  \n  {"openapi": "3.0.0"}')).toBe('json');
    });

    it('should detect YAML for non-JSON content', () => {
      expect(detectFormat('openapi: "3.0.0"')).toBe('yaml');
    });
  });

  describe('resolveRef', () => {
    const spec = {
      components: {
        schemas: {
          User: { type: 'object', properties: { name: { type: 'string' } } }
        }
      }
    };

    it('should resolve a valid $ref path', () => {
      const result = resolveRef(spec, '#/components/schemas/User');
      expect(result).toEqual({ type: 'object', properties: { name: { type: 'string' } } });
    });

    it('should return undefined for non-existent ref', () => {
      expect(resolveRef(spec, '#/components/schemas/Missing')).toBeUndefined();
    });

    it('should return undefined for non-#/ refs', () => {
      expect(resolveRef(spec, 'http://external.com/schema')).toBeUndefined();
    });
  });

  describe('resolveSchema', () => {
    const spec = {
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'integer' } } }
        }
      }
    };

    it('should resolve $ref objects', () => {
      const result = resolveSchema(spec, { $ref: '#/components/schemas/User' });
      expect(result).toEqual({ type: 'object', properties: { id: { type: 'integer' } } });
    });

    it('should return the object as-is if no $ref', () => {
      const obj = { type: 'string' };
      expect(resolveSchema(spec, obj)).toBe(obj);
    });

    it('should return falsy values as-is', () => {
      expect(resolveSchema(spec, null)).toBeNull();
      expect(resolveSchema(spec, undefined)).toBeUndefined();
    });
  });

  describe('generateSample', () => {
    const emptySpec = {};

    it('should return example if present', () => {
      expect(generateSample(emptySpec, { type: 'string', example: 'hello' })).toBe('hello');
    });

    it('should return first enum value', () => {
      expect(generateSample(emptySpec, { type: 'string', enum: ['a', 'b', 'c'] })).toBe('a');
    });

    it('should generate string samples with format', () => {
      expect(generateSample(emptySpec, { type: 'string' })).toBe('string');
      expect(generateSample(emptySpec, { type: 'string', format: 'date' })).toBe('2024-01-01');
      expect(generateSample(emptySpec, { type: 'string', format: 'date-time' })).toBe(
        '2024-01-01T00:00:00Z'
      );
      expect(generateSample(emptySpec, { type: 'string', format: 'email' })).toBe(
        'user@example.com'
      );
      expect(generateSample(emptySpec, { type: 'string', format: 'uri' })).toBe(
        'https://example.com'
      );
    });

    it('should generate numeric samples', () => {
      expect(generateSample(emptySpec, { type: 'integer' })).toBe(0);
      expect(generateSample(emptySpec, { type: 'number' })).toBe(0);
    });

    it('should generate boolean sample', () => {
      expect(generateSample(emptySpec, { type: 'boolean' })).toBe(false);
    });

    it('should generate array sample', () => {
      const schema = { type: 'array', items: { type: 'string' } };
      expect(generateSample(emptySpec, schema)).toEqual(['string']);
    });

    it('should generate empty array when no items', () => {
      expect(generateSample(emptySpec, { type: 'array' })).toEqual([]);
    });

    it('should generate object sample from properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        }
      };
      expect(generateSample(emptySpec, schema)).toEqual({ name: 'string', age: 0 });
    });

    it('should handle allOf by merging', () => {
      const schema = {
        allOf: [
          { type: 'object', properties: { id: { type: 'integer' } } },
          { type: 'object', properties: { name: { type: 'string' } } }
        ]
      };
      expect(generateSample(emptySpec, schema)).toEqual({ id: 0, name: 'string' });
    });

    it('should handle oneOf by using first option', () => {
      const schema = {
        oneOf: [
          { type: 'object', properties: { code: { type: 'integer' } } },
          { type: 'object', properties: { message: { type: 'string' } } }
        ]
      };
      expect(generateSample(emptySpec, schema)).toEqual({ code: 0 });
    });

    it('should handle anyOf by using first option', () => {
      const schema = {
        anyOf: [
          { type: 'object', properties: { status: { type: 'string' } } },
          { type: 'object', properties: { error: { type: 'string' } } }
        ]
      };
      expect(generateSample(emptySpec, schema)).toEqual({ status: 'string' });
    });

    it('should resolve $ref in schemas', () => {
      const spec = {
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } }
            }
          }
        }
      };
      const schema = { $ref: '#/components/schemas/User' };
      expect(generateSample(spec, schema)).toEqual({ id: 0, name: 'string' });
    });

    it('should handle nested $ref in properties', () => {
      const spec = {
        components: {
          schemas: {
            Address: {
              type: 'object',
              properties: { city: { type: 'string' } }
            }
          }
        }
      };
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' }
        }
      };
      expect(generateSample(spec, schema)).toEqual({
        name: 'string',
        address: { city: 'string' }
      });
    });

    it('should treat objects without type but with properties as object', () => {
      const schema = {
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      };
      expect(generateSample(emptySpec, schema)).toEqual({ foo: 'string', bar: 0 });
    });

    it('should stop at max depth to prevent infinite recursion', () => {
      expect(generateSample(emptySpec, { type: 'string' }, 6)).toBeUndefined();
    });

    it('should return undefined for null/undefined schema', () => {
      expect(generateSample(emptySpec, null)).toBeUndefined();
      expect(generateSample(emptySpec, undefined)).toBeUndefined();
    });
  });

  describe('hasPathParams', () => {
    it('should return true for paths with parameters', () => {
      expect(hasPathParams('/api/users/{id}')).toBe(true);
      expect(hasPathParams('/api/{org}/repos/{repoId}')).toBe(true);
    });

    it('should return false for paths without parameters', () => {
      expect(hasPathParams('/api/users')).toBe(false);
      expect(hasPathParams('/api/users/list')).toBe(false);
    });
  });

  describe('pathToPattern', () => {
    it('should convert single path parameter', () => {
      expect(pathToPattern('/api/users/{id}')).toBe('/api/users/[^/]+');
    });

    it('should convert multiple path parameters', () => {
      expect(pathToPattern('/api/{org}/repos/{repoId}')).toBe('/api/[^/]+/repos/[^/]+');
    });

    it('should return path as-is when no parameters', () => {
      expect(pathToPattern('/api/users')).toBe('/api/users');
    });
  });

  describe('findSuccessStatus', () => {
    it('should return the first 2xx status code', () => {
      expect(findSuccessStatus({ '200': {}, '404': {} })).toBe(200);
    });

    it('should return lowest 2xx when multiple exist', () => {
      expect(findSuccessStatus({ '201': {}, '200': {}, '204': {} })).toBe(200);
    });

    it('should return 200 when only default exists', () => {
      expect(findSuccessStatus({ default: {} })).toBe(200);
    });

    it('should return 200 when no success codes exist', () => {
      expect(findSuccessStatus({ '404': {}, '500': {} })).toBe(200);
    });
  });

  describe('buildMappingFromOperation', () => {
    it('should build mapping for simple GET endpoint (OpenAPI 3.x)', () => {
      const spec = { openapi: '3.0.0' };
      const operation = {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'integer' }, name: { type: 'string' } }
                }
              }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/users', 'GET', operation);

      expect(mapping.request.method).toBe('GET');
      expect(mapping.request.urlPath).toBe('/api/users');
      expect(mapping.request.urlPathPattern).toBeUndefined();
      expect(mapping.response.status).toBe(200);
      expect(mapping.response.jsonBody).toEqual({ id: 0, name: 'string' });
      expect(mapping.response.headers?.['Content-Type']).toBe('application/json');
    });

    it('should use urlPathPattern for paths with parameters', () => {
      const spec = { openapi: '3.0.0' };
      const operation = { responses: { '200': {} } };
      const mapping = buildMappingFromOperation(spec, '/api/users/{id}', 'GET', operation);

      expect(mapping.request.urlPath).toBeUndefined();
      expect(mapping.request.urlPathPattern).toBe('/api/users/[^/]+');
    });

    it('should use example from media type if available', () => {
      const spec = { openapi: '3.0.0' };
      const operation = {
        responses: {
          '200': {
            content: {
              'application/json': {
                example: { id: 42, name: 'Alice' },
                schema: { type: 'object' }
              }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/users', 'GET', operation);
      expect(mapping.response.jsonBody).toEqual({ id: 42, name: 'Alice' });
    });

    it('should use examples (plural) if example is not present', () => {
      const spec = { openapi: '3.0.0' };
      const operation = {
        responses: {
          '200': {
            content: {
              'application/json': {
                examples: {
                  example1: { value: { id: 1, name: 'Bob' } }
                },
                schema: { type: 'object' }
              }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/users', 'GET', operation);
      expect(mapping.response.jsonBody).toEqual({ id: 1, name: 'Bob' });
    });

    it('should handle Swagger 2.x format with schema', () => {
      const spec = {
        swagger: '2.0',
        produces: ['application/json']
      };
      const operation = {
        responses: {
          '200': {
            schema: {
              type: 'object',
              properties: { message: { type: 'string' } }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/health', 'GET', operation);
      expect(mapping.response.jsonBody).toEqual({ message: 'string' });
      expect(mapping.response.headers?.['Content-Type']).toBe('application/json');
    });

    it('should handle Swagger 2.x examples', () => {
      const spec = { swagger: '2.0' };
      const operation = {
        responses: {
          '200': {
            examples: {
              'application/json': { status: 'ok' }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/health', 'GET', operation);
      expect(mapping.response.jsonBody).toEqual({ status: 'ok' });
    });

    it('should pick 201 for POST endpoint when available', () => {
      const spec = { openapi: '3.0.0' };
      const operation = {
        responses: {
          '201': {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { id: { type: 'integer' } } }
              }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/users', 'POST', operation);
      expect(mapping.response.status).toBe(201);
    });

    it('should handle non-JSON content type', () => {
      const spec = { openapi: '3.0.0' };
      const operation = {
        responses: {
          '200': {
            content: {
              'text/plain': {
                example: 'Hello World'
              }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/hello', 'GET', operation);
      expect(mapping.response.body).toBe('Hello World');
      expect(mapping.response.jsonBody).toBeUndefined();
      expect(mapping.response.headers?.['Content-Type']).toBe('text/plain');
    });

    it('should handle responses with $ref', () => {
      const spec = {
        openapi: '3.0.0',
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { id: { type: 'integer' }, email: { type: 'string', format: 'email' } }
            }
          }
        }
      };
      const operation = {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          }
        }
      };
      const mapping = buildMappingFromOperation(spec, '/api/users/me', 'GET', operation);
      expect(mapping.response.jsonBody).toEqual({ id: 0, email: 'user@example.com' });
    });

    it('should handle empty responses gracefully', () => {
      const spec = { openapi: '3.0.0' };
      const operation = { responses: {} };
      const mapping = buildMappingFromOperation(spec, '/api/ping', 'GET', operation);

      expect(mapping.request.method).toBe('GET');
      expect(mapping.response.status).toBe(200);
      expect(mapping.response.jsonBody).toBeUndefined();
      expect(mapping.response.body).toBeUndefined();
    });

    it('should generate request body from OpenAPI 3.x requestBody', () => {
      const spec = {
        openapi: '3.0.0',
        components: {
          schemas: {
            CreateUser: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' }
              }
            }
          }
        }
      };
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUser' }
            }
          }
        },
        responses: { '201': {} }
      };
      const mapping = buildMappingFromOperation(spec, '/api/users', 'POST', operation);

      expect(mapping.request.bodyPatterns).toBeDefined();
      expect(mapping.request.bodyPatterns).toHaveLength(1);
      const body = JSON.parse(mapping.request.bodyPatterns![0].equalToJson!);
      expect(body).toEqual({ name: 'string', email: 'user@example.com' });
    });

    it('should generate request body from Swagger 2.x body parameter', () => {
      const spec = { swagger: '2.0' };
      const operation = {
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          {
            in: 'body',
            name: 'body',
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                done: { type: 'boolean' }
              }
            }
          }
        ],
        responses: { '201': {} }
      };
      const mapping = buildMappingFromOperation(spec, '/api/todos', 'POST', operation);

      expect(mapping.request.bodyPatterns).toBeDefined();
      expect(mapping.request.bodyPatterns).toHaveLength(1);
      const body = JSON.parse(mapping.request.bodyPatterns![0].equalToJson!);
      expect(body).toEqual({ title: 'string', done: false });
    });

    it('should not generate request body for GET methods', () => {
      const spec = { openapi: '3.0.0' };
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { q: { type: 'string' } } }
            }
          }
        },
        responses: { '200': {} }
      };
      const mapping = buildMappingFromOperation(spec, '/api/search', 'GET', operation);

      expect(mapping.request.bodyPatterns).toBeUndefined();
    });

    it('should generate request body for PUT and PATCH methods', () => {
      const spec = { openapi: '3.0.0' };
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } } }
            }
          }
        },
        responses: { '200': {} }
      };

      const putMapping = buildMappingFromOperation(spec, '/api/users/{id}', 'PUT', operation);
      expect(putMapping.request.bodyPatterns).toBeDefined();

      const patchMapping = buildMappingFromOperation(spec, '/api/users/{id}', 'PATCH', operation);
      expect(patchMapping.request.bodyPatterns).toBeDefined();
    });
  });
});
