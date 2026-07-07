/**
 * Render a header/parameter value for display: multi-value entries (string
 * arrays) are joined, single values are stringified. Centralizes the
 * `Array.isArray(v) ? v.join(...) : String(v)` pattern used across views.
 */
export function joinMultiValue(value: string | string[], separator = ', '): string {
  return Array.isArray(value) ? value.join(separator) : String(value);
}
