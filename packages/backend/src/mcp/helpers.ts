import type { FastifyInstance, InjectOptions } from 'fastify';

export interface ApiResponse {
  statusCode: number;
  json: any;
}

/**
 * Call an existing REST route internally via Fastify's inject mechanism.
 * Reuses all route logic and validation without duplicating any code.
 */
export async function callApi(fastify: FastifyInstance, opts: InjectOptions): Promise<ApiResponse> {
  const res = await fastify.inject(opts);
  let json: any;
  try {
    json = res.json();
  } catch {
    json = undefined;
  }
  return { statusCode: res.statusCode, json };
}

/**
 * Shape a REST response into an MCP tool result.
 * On success: return only the `data` payload as pretty JSON text.
 * On failure: set isError and surface the error message (with details when present).
 */
export function toResult(res: ApiResponse) {
  const ok = res.statusCode < 400 && res.json?.success !== false;
  if (ok) {
    const data = res.json?.data ?? res.json ?? { ok: true };
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }
  const msg = res.json?.error || res.json?.message || `Request failed (HTTP ${res.statusCode})`;
  const details = res.json?.details ? `\n${JSON.stringify(res.json.details)}` : '';
  return {
    content: [{ type: 'text' as const, text: `Error: ${msg}${details}` }],
    isError: true
  };
}

/**
 * Fetch the active WireMock instances for a project (used by sync_all/append_all when
 * no specific instanceId is supplied so the operation fans out to every active instance).
 */
export async function listActiveInstances(
  fastify: FastifyInstance,
  projectId: string
): Promise<Array<{ id: string; name: string }>> {
  const res = await callApi(fastify, {
    method: 'GET',
    url: '/api/wiremock-instances',
    query: { projectId }
  });
  if (res.statusCode >= 400 || !Array.isArray(res.json?.data)) {
    return [];
  }
  return res.json.data
    .filter((i: any) => i.isActive !== false)
    .map((i: any) => ({ id: i.id, name: i.name }));
}
