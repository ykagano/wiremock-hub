import type { BodyPattern } from '../types/wiremock.js';

/** Result of generating a sample request body from stub body patterns */
export interface SampleBodyResult {
  /** Generated body text, undefined when nothing could be generated */
  body?: string;
  /** Matcher descriptions (e.g. "matches: ^order-\\d+$") for patterns a sample could not be generated from */
  hints: string[];
}

type PathSegment = string | number;

// Parse a simple JSONPath ($.a.b, $.items[0].id, $['a']["b"]) into segments.
// Filters, wildcards, recursive descent and functions are not supported.
function parseSimpleJsonPath(expression: string): PathSegment[] | null {
  const expr = expression.trim();
  if (!expr.startsWith('$') || /\.\.|\?|@|\*|\(/.test(expr)) {
    return null;
  }

  const segmentRe = /^(?:\.([A-Za-z_][\w-]*)|\[(\d+)\]|\['([^']+)'\]|\["([^"]+)"\])/;
  const segments: PathSegment[] = [];
  let rest = expr.slice(1);
  while (rest.length > 0) {
    const match = rest.match(segmentRe);
    if (!match) return null;
    if (match[1] !== undefined) segments.push(match[1]);
    else if (match[2] !== undefined) segments.push(Number(match[2]));
    else segments.push((match[3] ?? match[4]) as string);
    rest = rest.slice(match[0].length);
  }
  return segments.length > 0 ? segments : null;
}

type JsonContainer = Record<string, unknown> | unknown[];

// Set a leaf value at the given path, creating containers along the way.
// Returns false when the path conflicts with an already-built structure.
function setPath(root: JsonContainer, segments: PathSegment[], value: unknown): boolean {
  let node: JsonContainer = root;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const expectsArray = typeof segment === 'number';
    if (expectsArray !== Array.isArray(node)) return false;
    const container = node as Record<PathSegment, unknown>;

    if (i === segments.length - 1) {
      if (container[segment] === undefined) container[segment] = value;
      return true;
    }

    if (container[segment] === undefined) {
      container[segment] = typeof segments[i + 1] === 'number' ? [] : {};
    }
    const next = container[segment];
    if (typeof next !== 'object' || next === null) return false;
    node = next as JsonContainer;
  }
  return true;
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function describe(matcher: string, value: unknown): string {
  return `${matcher}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
}

/**
 * Generate a sample request body that satisfies the given WireMock body patterns.
 *
 * Exact-value matchers (equalToJson / equalTo / equalToXml) are used as-is.
 * Simple matchesJsonPath expressions are combined into a minimal JSON document
 * (patterns are AND-ed by WireMock). A body containing every `contains` value
 * satisfies those patterns. Anything else is reported back as a hint.
 */
export function generateSampleBody(patterns?: BodyPattern[]): SampleBodyResult {
  if (!patterns || patterns.length === 0) {
    return { hints: [] };
  }

  // An exact-value matcher fully determines the body
  for (const pattern of patterns) {
    if (pattern.equalToJson !== undefined) {
      const raw =
        typeof pattern.equalToJson === 'string'
          ? pattern.equalToJson
          : JSON.stringify(pattern.equalToJson);
      return { body: prettyJson(raw), hints: [] };
    }
    if (pattern.equalTo !== undefined) {
      return { body: pattern.equalTo, hints: [] };
    }
    if (pattern.equalToXml !== undefined) {
      return { body: pattern.equalToXml, hints: [] };
    }
  }

  const hints: string[] = [];
  const jsonPaths: PathSegment[][] = [];
  const containsValues: string[] = [];

  for (const pattern of patterns) {
    if (pattern.matchesJsonPath !== undefined) {
      const segments =
        typeof pattern.matchesJsonPath === 'string'
          ? parseSimpleJsonPath(pattern.matchesJsonPath)
          : null;
      if (segments) {
        jsonPaths.push(segments);
      } else {
        hints.push(describe('matchesJsonPath', pattern.matchesJsonPath));
      }
    } else if (pattern.contains !== undefined) {
      containsValues.push(pattern.contains);
    } else if (pattern.matches !== undefined) {
      hints.push(describe('matches', pattern.matches));
    } else if (pattern.doesNotMatch !== undefined) {
      hints.push(describe('doesNotMatch', pattern.doesNotMatch));
    } else if (pattern.matchesXPath !== undefined) {
      hints.push(describe('matchesXPath', pattern.matchesXPath));
    } else if (pattern.binaryEqualTo !== undefined) {
      hints.push(describe('binaryEqualTo', pattern.binaryEqualTo));
    }
  }

  if (jsonPaths.length > 0) {
    const root: JsonContainer = typeof jsonPaths[0][0] === 'number' ? [] : {};
    let built = false;
    for (const segments of jsonPaths) {
      if (setPath(root, segments, 'value')) {
        built = true;
      } else {
        hints.push(describe('matchesJsonPath', formatJsonPath(segments)));
      }
    }
    if (built) {
      // A JSON body cannot also embed arbitrary contains values; surface them as hints
      hints.push(...containsValues.map((v) => describe('contains', v)));
      return { body: JSON.stringify(root, null, 2), hints };
    }
  }

  if (containsValues.length > 0) {
    return { body: containsValues.join('\n'), hints };
  }

  return { hints };
}

function formatJsonPath(segments: PathSegment[]): string {
  return `$${segments.map((s) => (typeof s === 'number' ? `[${s}]` : `.${s}`)).join('')}`;
}
