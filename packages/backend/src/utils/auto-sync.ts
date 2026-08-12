import { FastifyInstance } from 'fastify';
import { isWiremockHealthy, syncStubsToInstance } from './wiremock-sync.js';

export interface AutoSyncOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_MAX_ATTEMPTS = 60;

// In-memory only: Hub restart re-runs the startup trigger, so nothing to persist
const inFlight = new Set<string>();

// Per-app stop flag, decorated in buildApp() and flipped in its onClose hook.
// A property (not a WeakSet of instances) because route handlers receive
// encapsulated child instances that read the flag through the prototype chain.
export interface AutoSyncState {
  stopped: boolean;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Don't let the retry timer block process exit
    timer.unref?.();
  });
}

/**
 * Wait until the instance's WireMock is healthy, then sync all active stubs
 * to it (reset + register, same as "Sync All"). Re-reads the instance and
 * project from DB on every attempt, so callers can trigger unconditionally:
 * the loop exits immediately when autoSync is off, the instance was deleted,
 * or it is inactive.
 */
export async function autoSyncInstance(
  fastify: FastifyInstance,
  instanceId: string,
  options?: AutoSyncOptions
): Promise<void> {
  if (inFlight.has(instanceId)) return;
  inFlight.add(instanceId);

  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  try {
    for (let attempt = 1; attempt <= maxAttempts && !fastify.autoSyncState.stopped; attempt++) {
      const instance = await fastify.prisma.wiremockInstance.findUnique({
        where: { id: instanceId },
        include: { project: true }
      });

      if (!instance || !instance.isActive || !instance.project.autoSync) {
        return;
      }

      if (await isWiremockHealthy(instance.url)) {
        const stubs = await fastify.prisma.stub.findMany({
          where: { projectId: instance.projectId, isActive: true }
        });

        const result = { success: 0, failed: 0, errors: [] as string[] };
        await syncStubsToInstance(instance.url, stubs, instance.project, result);
        fastify.log.info(
          { instanceId, url: instance.url, success: result.success, failed: result.failed },
          'Auto-sync completed'
        );
        return;
      }

      await sleep(intervalMs);
    }

    if (!fastify.autoSyncState.stopped) {
      fastify.log.warn(
        { instanceId, maxAttempts },
        'Auto-sync gave up: instance never became healthy'
      );
    }
  } catch (error) {
    fastify.log.error({ instanceId, error }, 'Auto-sync failed');
  } finally {
    inFlight.delete(instanceId);
  }
}

/** Startup trigger: fire auto-sync for all active instances of autoSync projects */
export async function autoSyncAllRegistered(
  fastify: FastifyInstance,
  options?: AutoSyncOptions
): Promise<void> {
  const instances = await fastify.prisma.wiremockInstance.findMany({
    where: { isActive: true, project: { autoSync: true } },
    select: { id: true }
  });

  for (const instance of instances) {
    void autoSyncInstance(fastify, instance.id, options);
  }
}
