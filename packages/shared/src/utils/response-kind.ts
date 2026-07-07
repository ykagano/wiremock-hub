import type { MappingResponse } from '../types/wiremock.js';

/**
 * A fault or proxy response has no fixed status code that can be asserted
 * against: WireMock ignores `status` when `fault` is set, and a proxied
 * response's status is determined by the upstream. Such stubs cannot be
 * meaningfully compared in the stub test flow.
 */
export function isFaultOrProxyResponse(response?: Pick<MappingResponse, 'fault' | 'proxyBaseUrl'>) {
  return Boolean(response?.fault || response?.proxyBaseUrl);
}
