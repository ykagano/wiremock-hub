import type { Mapping } from '../types/wiremock.js';

/**
 * Normalize user/spec-provided tags: keep strings only, trim, drop empties and
 * duplicates (first occurrence wins). Non-array input yields no tags, so a
 * malformed `metadata.tags` written via the JSON editor reads as "untagged".
 */
export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
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
