import type { Mapping } from '../types/wiremock.js';

/**
 * Normalize user/spec-provided tags: trim, drop empties and duplicates (first
 * occurrence wins). A lone string counts as one tag and numbers (e.g. unquoted
 * YAML tags) are stringified, so hand-written `metadata.tags` isn't silently lost;
 * other values are dropped.
 */
export function normalizeTags(value: unknown): string[] {
  const list = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(list)) return [];
  const tags = list
    .filter((tag) => typeof tag === 'string' || typeof tag === 'number')
    .map((tag) => String(tag).trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

/** Tags stored in `metadata.tags` of a mapping */
export function getTags(mapping: Pick<Mapping, 'metadata'>): string[] {
  return normalizeTags(mapping.metadata?.tags);
}

/**
 * Set `metadata.tags` in place. No tags removes the key, and an emptied
 * `metadata` is removed too so untagged stubs don't export `metadata: {}`.
 */
export function setTags(mapping: Pick<Mapping, 'metadata'>, tags: unknown): void {
  const normalized = normalizeTags(tags);
  const metadata = { ...mapping.metadata };
  delete metadata.tags;
  if (normalized.length > 0) metadata.tags = normalized;

  if (Object.keys(metadata).length > 0) {
    mapping.metadata = metadata;
  } else {
    delete mapping.metadata;
  }
}
