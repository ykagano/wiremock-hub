/**
 * Extract concrete values from WireMock matcher maps (request headers / query
 * parameters), keeping only matchers with a string `equalTo` value.
 */
export function extractEqualToValues(matchers?: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  if (!matchers) return values;
  for (const [key, matcher] of Object.entries(matchers)) {
    if (
      typeof matcher === 'object' &&
      matcher !== null &&
      'equalTo' in matcher &&
      typeof (matcher as Record<string, unknown>).equalTo === 'string'
    ) {
      values[key] = (matcher as { equalTo: string }).equalTo;
    }
  }
  return values;
}
