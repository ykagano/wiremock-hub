import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { getTestApp } from '../setup.js';
import { resetAll } from '../helpers.js';
import { autoSyncInstance } from '../../src/utils/auto-sync.js';

// Fast retry options so tests don't wait on real intervals
const FAST = { intervalMs: 10, maxAttempts: 3 };

async function createProject(autoSync: boolean): Promise<string> {
  const app = await getTestApp();
  const project = await app.prisma.project.create({
    data: { name: 'AutoSync Test', autoSync }
  });
  return project.id;
}

// Create instances via Prisma directly: the POST route itself fires
// autoSyncInstance (with production intervals), which would race with the
// directly-awaited call under test via the inFlight guard.
async function createInstance(projectId: string, url: string): Promise<string> {
  const app = await getTestApp();
  const instance = await app.prisma.wiremockInstance.create({
    data: { projectId, name: 'WM', url }
  });
  return instance.id;
}

/** Minimal fake WireMock Admin API that records requests */
function startFakeWiremock(): Promise<{
  url: string;
  requests: { method: string; url: string }[];
  close: () => Promise<void>;
}> {
  const requests: { method: string; url: string }[] = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method || '', url: req.url || '' });
    res.statusCode = req.method === 'POST' ? 201 : 200;
    res.setHeader('content-type', 'application/json');
    res.end('{}');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

describe('autoSyncInstance', () => {
  beforeEach(async () => {
    await resetAll();
  });

  it('should do nothing when autoSync is off', async () => {
    const app = await getTestApp();
    const projectId = await createProject(false);
    // Unreachable URL: if the loop tried a health check it would be slow/fail
    const instanceId = await createInstance(projectId, 'http://127.0.0.1:1');

    await autoSyncInstance(app, instanceId, FAST);
    // No error and immediate return is the expected behavior
  });

  it('should do nothing when instance does not exist', async () => {
    const app = await getTestApp();
    await autoSyncInstance(app, 'non-existent-id', FAST);
  });

  it('should do nothing when instance is inactive', async () => {
    const app = await getTestApp();
    const projectId = await createProject(true);
    const instanceId = await createInstance(projectId, 'http://127.0.0.1:1');
    await app.prisma.wiremockInstance.update({
      where: { id: instanceId },
      data: { isActive: false }
    });

    await autoSyncInstance(app, instanceId, FAST);
  });

  it('should give up after max attempts when instance is unhealthy', async () => {
    const app = await getTestApp();
    const projectId = await createProject(true);
    // Closed port: connection refused immediately on each attempt
    const instanceId = await createInstance(projectId, 'http://127.0.0.1:1');

    const start = Date.now();
    await autoSyncInstance(app, instanceId, FAST);
    // 3 attempts x 10ms interval: finishes quickly instead of hanging
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('should sync active stubs once the instance becomes healthy', async () => {
    const app = await getTestApp();
    const wiremock = await startFakeWiremock();

    try {
      const projectId = await createProject(true);
      const instanceId = await createInstance(projectId, wiremock.url);

      await app.prisma.stub.create({
        data: {
          projectId,
          name: 'Active Stub 1',
          mapping: { request: { url: '/a' }, response: { status: 200 } }
        }
      });
      await app.prisma.stub.create({
        data: {
          projectId,
          name: 'Active Stub 2',
          mapping: { request: { url: '/b' }, response: { status: 200 } }
        }
      });
      await app.prisma.stub.create({
        data: {
          projectId,
          name: 'Inactive Stub',
          isActive: false,
          mapping: { request: { url: '/c' }, response: { status: 200 } }
        }
      });

      await autoSyncInstance(app, instanceId, FAST);

      // Health check(s) via GET, then reset via DELETE, then register stubs
      const deletes = wiremock.requests.filter((r) => r.method === 'DELETE');
      const posts = wiremock.requests.filter((r) => r.method === 'POST');
      expect(deletes).toHaveLength(1);
      expect(deletes[0].url).toBe('/__admin/mappings');
      expect(posts).toHaveLength(2);
      expect(posts.every((r) => r.url === '/__admin/mappings')).toBe(true);
    } finally {
      await wiremock.close();
    }
  });
});

describe('POST /api/wiremock-instances auto-sync trigger', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterEach(async () => {
    await resetAll();
  });

  it('should auto-sync stubs after registering an instance via API', async () => {
    const app = await getTestApp();
    const wiremock = await startFakeWiremock();

    try {
      const projectId = await createProject(true);
      await app.prisma.stub.create({
        data: {
          projectId,
          name: 'Stub',
          mapping: { request: { url: '/a' }, response: { status: 200 } }
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/wiremock-instances',
        payload: { projectId, name: 'WM', url: wiremock.url }
      });
      expect(response.statusCode).toBe(201);

      // The trigger is fire-and-forget; poll until the sync arrives
      const deadline = Date.now() + 10000;
      const posts = () => wiremock.requests.filter((r) => r.method === 'POST');
      while (posts().length === 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(posts()).toHaveLength(1);
    } finally {
      await wiremock.close();
    }
  });
});
