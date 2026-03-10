import { getTestApp } from './test-app.js';

/** Create a test project and return its ID */
export async function createProject(name = 'Test Project'): Promise<string> {
  const app = await getTestApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/projects',
    payload: { name }
  });
  return res.json().data.id;
}

/** Create a WireMock instance and return its ID */
export async function createInstance(
  projectId: string,
  url = 'http://wiremock-test:8080',
  name = 'Mock WM'
): Promise<string> {
  const app = await getTestApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/wiremock-instances',
    payload: { projectId, name, url }
  });
  return res.json().data.id;
}

/** Create a stub and return its ID */
export async function createStub(
  projectId: string,
  mapping: object = { request: { url: '/test' }, response: { status: 200 } },
  name = 'Test Stub'
): Promise<string> {
  const app = await getTestApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/stubs',
    payload: { projectId, name, mapping }
  });
  return res.json().data.id;
}

/** Clean all data */
export async function resetAll(): Promise<void> {
  const app = await getTestApp();
  await app.prisma.stub.deleteMany();
  await app.prisma.wiremockInstance.deleteMany();
  await app.prisma.project.deleteMany();
}

/** Clean all data and create a fresh project, returning its ID */
export async function resetAndCreateProject(name = 'Test Project'): Promise<string> {
  await resetAll();
  return createProject(name);
}
