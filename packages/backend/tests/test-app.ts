import { FastifyInstance } from 'fastify';

let app: FastifyInstance;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    throw new Error('Test app not initialized. Make sure setup is complete.');
  }
  return app;
}

export function setTestApp(instance: FastifyInstance): void {
  app = instance;
}
