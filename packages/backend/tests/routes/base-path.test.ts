import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildApp } from '../../src/app.js';
import { resetAndCreateProject } from '../helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same test database as tests/setup.ts (already migrated by the global setup)
const TEST_DB_URL = `file:${path.join(__dirname, '../../data-test/test.db')}`;

describe('base path support (BASE_PATH)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      databaseUrl: TEST_DB_URL,
      basePath: '/hub'
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves API routes under the base path', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/hub/api/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('still serves API routes without the base path prefix', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('rewrites the bare base path to the root', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/hub'
    });

    // No static files are registered in tests, so the root route is a 404,
    // but the URL must have been rewritten to '/' (not treated as unknown '/hub')
    expect(response.statusCode).toBe(404);
    const message = response.json().message as string;
    expect(message).toContain('GET:/');
    expect(message).not.toContain('/hub');
  });

  it('preserves query strings when stripping the base path', async () => {
    const projectId = await resetAndCreateProject('Base Path Test Project');

    const response = await app.inject({
      method: 'GET',
      url: `/hub/api/stubs?projectId=${projectId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true, data: [] });
  });

  it('does not strip paths that only share the base path as a prefix substring', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/hubx/api/health'
    });

    expect(response.statusCode).toBe(404);
  });

  it('normalizes the configured base path before matching', async () => {
    const normalizedApp = await buildApp({
      logger: false,
      databaseUrl: TEST_DB_URL,
      basePath: 'hub/'
    });
    await normalizedApp.ready();

    try {
      const response = await normalizedApp.inject({
        method: 'GET',
        url: '/hub/api/health'
      });

      expect(response.statusCode).toBe(200);
    } finally {
      await normalizedApp.close();
    }
  });
});
