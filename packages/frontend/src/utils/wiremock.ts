import type { Mapping, MappingRequest, MappingResponse } from '@wiremock-hub/shared';
import type { Stub } from '@/services/api';
import { t } from '@/i18n';

/** Extract typed Mapping from Stub's mapping field */
export function toMapping(stub: Stub): Mapping {
  return stub.mapping as unknown as Mapping;
}

export function getMethodTagType(method?: string): string {
  const types: Record<string, string> = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'danger',
    PATCH: 'info',
    HEAD: 'info',
    OPTIONS: 'info'
  };
  return types[method || ''] || 'info';
}

export function getUrl(request?: MappingRequest): string {
  if (!request) return '/';
  return request.url || request.urlPattern || request.urlPath || request.urlPathPattern || '/';
}

export function getStatusTagType(status?: number): string {
  if (status === undefined) return 'info';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'danger';
  return 'info';
}

export interface StatusTag {
  type: string;
  label: string;
  tooltip?: string;
}

/**
 * Describe a mapping response for the status column: fault/proxy stubs render a
 * distinct tag with a tooltip, everything else shows the status code. Shared by
 * the mappings, scenarios, and registered-stubs views.
 */
export function statusTag(response?: MappingResponse): StatusTag {
  if (response?.fault) {
    return {
      type: 'danger',
      label: 'FAULT',
      tooltip: t('mappings.faultTooltip', { fault: response.fault })
    };
  }
  if (response?.proxyBaseUrl) {
    return {
      type: 'info',
      label: 'PROXY',
      tooltip: t('mappings.proxyTooltip', { url: response.proxyBaseUrl })
    };
  }
  return {
    type: getStatusTagType(response?.status),
    label: response?.status !== undefined ? String(response.status) : '-'
  };
}
