import type { MultiValueMap } from '../types/wiremock.js';

/**
 * Extract concrete values from WireMock matcher maps (request headers / query
 * parameters). Supports string `equalTo` matchers and multi-value
 * `hasExactly: [{ equalTo }, ...]` matchers (arrays of the inner values).
 */
export function extractEqualToValues(matchers?: Record<string, unknown>): MultiValueMap {
  const values: MultiValueMap = {};
  if (!matchers) return values;
  for (const [key, matcher] of Object.entries(matchers)) {
    if (typeof matcher !== 'object' || matcher === null) continue;
    const { equalTo, hasExactly } = matcher as { equalTo?: unknown; hasExactly?: unknown };
    if (typeof equalTo === 'string') {
      values[key] = equalTo;
    } else if (Array.isArray(hasExactly)) {
      const inner = hasExactly
        .map((entry) => (entry as { equalTo?: unknown } | null)?.equalTo)
        .filter((value): value is string => typeof value === 'string');
      if (inner.length > 0) {
        values[key] = inner;
      }
    }
  }
  return values;
}

export type ValueMatcher = { equalTo: string } | { hasExactly: { equalTo: string }[] };

/**
 * Build a WireMock matcher for a request header / query parameter value:
 * a single string becomes `{ equalTo }`, multiple values become
 * `{ hasExactly: [{ equalTo }, ...] }`. Inverse of `extractEqualToValues`.
 */
export function buildValueMatcher(value: string | string[]): ValueMatcher {
  return typeof value === 'string'
    ? { equalTo: value }
    : { hasExactly: value.map((v) => ({ equalTo: v })) };
}
