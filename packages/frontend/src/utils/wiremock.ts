import type { MappingRequest } from '@/types/wiremock'

export function getMethodTagType(method?: string): string {
  const types: Record<string, string> = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'danger',
    PATCH: 'info',
    HEAD: 'info',
    OPTIONS: 'info'
  }
  return types[method || ''] || 'info'
}

export function getUrl(request?: MappingRequest): string {
  if (!request) return '/'
  return request.url || request.urlPattern || request.urlPath || request.urlPathPattern || '/'
}

export function getStatusTagType(status: number): string {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'info'
  if (status >= 400 && status < 500) return 'warning'
  if (status >= 500) return 'danger'
  return 'info'
}
