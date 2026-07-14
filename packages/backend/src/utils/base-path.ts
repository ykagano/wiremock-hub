/**
 * Normalize a base path for URL prefix matching.
 *
 * Returns '' when no base path is configured (empty, '/', or whitespace),
 * otherwise a path with a leading slash and no trailing slash
 * (e.g. 'hub/', '/hub', '/hub/' all normalize to '/hub').
 */
export function normalizeBasePath(input?: string | null): string {
  const trimmed = (input ?? '').trim();
  if (trimmed === '') {
    return '';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailingSlashes = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlashes === '' ? '' : withoutTrailingSlashes;
}
