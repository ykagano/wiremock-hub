import axios from 'axios';
import type { Mapping } from '@wiremock-hub/shared';

/** Inject Hub metadata into a WireMock mapping (for sync only, not stored in DB) */
export function injectHubMetadata(
  mapping: Mapping,
  project: { id: string; name: string },
  stub?: { name?: string | null; description?: string | null }
) {
  return {
    ...mapping,
    ...(stub?.name ? { name: stub.name } : {}),
    metadata: {
      ...mapping.metadata,
      hub_project_id: project.id,
      hub_project_name: project.name,
      ...(stub?.description ? { hub_description: stub.description } : {})
    }
  };
}

export interface SyncResult {
  success: number;
  failed: number;
  errors: string[];
}

interface SyncStub {
  id: string;
  name?: string | null;
  description?: string | null;
  mapping: unknown;
}

/**
 * Sync stubs to a single WireMock instance.
 * Optionally resets mappings first, then registers all stubs in chunks.
 *
 * @param resetBeforeSync - If true, resets all mappings before syncing (default: true)
 * @returns Object indicating whether reset failed (if applicable)
 */
export async function syncStubsToInstance(
  instanceUrl: string,
  stubs: SyncStub[],
  project: { id: string; name: string },
  result: SyncResult,
  options?: { resetBeforeSync?: boolean }
): Promise<{ resetFailed: boolean; resetError?: string }> {
  const resetBeforeSync = options?.resetBeforeSync ?? true;

  // Reset WireMock mappings if requested
  if (resetBeforeSync) {
    try {
      await axios.delete(`${instanceUrl}/__admin/mappings`, { timeout: 10000 });
    } catch (error) {
      const errorMessage = axios.isAxiosError(error) ? error.message : 'Unknown error';
      result.failed += stubs.length;
      result.errors.push(`Failed to reset ${instanceUrl}: ${errorMessage}`);
      return { resetFailed: true, resetError: errorMessage };
    }
  }

  // Sync stubs in chunks for better performance
  const chunkSize = 10;
  for (let i = 0; i < stubs.length; i += chunkSize) {
    const chunk = stubs.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (stub) => {
        const mapping = stub.mapping as unknown as Mapping;
        const mappingWithMetadata = injectHubMetadata(mapping, project, stub);
        await axios.post(`${instanceUrl}/__admin/mappings`, mappingWithMetadata);
        return stub.id;
      })
    );

    for (const r of chunkResults) {
      if (r.status === 'fulfilled') {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(r.reason?.message || 'Unknown error');
      }
    }
  }

  return { resetFailed: false };
}
