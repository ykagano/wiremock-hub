import path from 'path';
import { fileURLToPath } from 'url';
import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';
import { projectRoutes } from './routes/projects.js';
import { stubRoutes } from './routes/stubs.js';
import { wiremockInstanceRoutes } from './routes/wiremock-instances.js';
import { healthRoutes } from './routes/health.js';
import { mcpRoutes } from './routes/mcp.js';
import { getDatabaseUrl, migrateDatabase } from './utils/database.js';
import { normalizeBasePath } from './utils/base-path.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BuildAppOptions {
  logger?: boolean;
  databaseUrl?: string;
  basePath?: string;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { logger = false, databaseUrl, basePath } = options;

  // Serve the app under a sub-path (e.g. BASE_PATH=/hub) by stripping the
  // prefix before routing. URLs without the prefix keep working, so the app
  // stays reachable both directly and behind a prefix-stripping reverse proxy.
  const base = normalizeBasePath(basePath ?? process.env.BASE_PATH);

  // Migrate database from old location if needed (for existing users upgrading)
  // From dist/app.js -> 3 levels up to project root
  migrateDatabase(__dirname, 3);

  // Initialize Prisma with better-sqlite3 driver adapter (Prisma v7)
  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl || getDatabaseUrl(__dirname, 3)
  });
  const prisma = new PrismaClient({ adapter });

  const serverOptions: FastifyServerOptions = { logger };
  if (base) {
    serverOptions.rewriteUrl = (req) => {
      const url = req.url ?? '/';
      if (url === base) {
        return '/';
      }
      if (url.startsWith(`${base}/`)) {
        return url.slice(base.length);
      }
      if (url.startsWith(`${base}?`)) {
        return `/${url.slice(base.length)}`;
      }
      return url;
    };
  }

  const fastify = Fastify(serverOptions);

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // Decorate fastify with prisma
  fastify.decorate('prisma', prisma);

  // Register routes
  await fastify.register(projectRoutes, { prefix: '/api/projects' });
  await fastify.register(stubRoutes, { prefix: '/api/stubs' });
  await fastify.register(wiremockInstanceRoutes, { prefix: '/api/wiremock-instances' });
  await fastify.register(healthRoutes, { prefix: '/api/health' });
  await fastify.register(mcpRoutes, { prefix: '/api/mcp' });

  // Add hook for graceful shutdown
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return fastify;
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
