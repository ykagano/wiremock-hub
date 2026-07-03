import { describe, it, expect } from 'vitest';
import { generateSampleBody, type BodyPattern } from '@wiremock-hub/shared';

describe('generateSampleBody', () => {
  it('should return no body and no hints for empty patterns', () => {
    expect(generateSampleBody(undefined)).toEqual({ hints: [] });
    expect(generateSampleBody([])).toEqual({ hints: [] });
  });

  it('should return pretty-printed JSON for equalToJson string', () => {
    const result = generateSampleBody([{ equalToJson: '{"key":"value"}' }]);
    expect(result.body).toBe('{\n  "key": "value"\n}');
    expect(result.hints).toEqual([]);
  });

  it('should handle equalToJson given as an object at runtime', () => {
    const patterns = [{ equalToJson: { key: 'value' } }] as unknown as BodyPattern[];
    const result = generateSampleBody(patterns);
    expect(JSON.parse(result.body!)).toEqual({ key: 'value' });
  });

  it('should keep invalid JSON in equalToJson as-is', () => {
    const result = generateSampleBody([{ equalToJson: 'not json' }]);
    expect(result.body).toBe('not json');
  });

  it('should return equalTo value as-is', () => {
    const result = generateSampleBody([{ equalTo: 'plain text body' }]);
    expect(result.body).toBe('plain text body');
    expect(result.hints).toEqual([]);
  });

  it('should return equalToXml value as-is', () => {
    const result = generateSampleBody([{ equalToXml: '<order><id>1</id></order>' }]);
    expect(result.body).toBe('<order><id>1</id></order>');
  });

  it('should build minimal JSON from a simple matchesJsonPath', () => {
    const result = generateSampleBody([{ matchesJsonPath: '$.name' }]);
    expect(JSON.parse(result.body!)).toEqual({ name: 'value' });
    expect(result.hints).toEqual([]);
  });

  it('should build nested objects from dotted paths', () => {
    const result = generateSampleBody([{ matchesJsonPath: '$.user.address.city' }]);
    expect(JSON.parse(result.body!)).toEqual({ user: { address: { city: 'value' } } });
  });

  it('should build arrays from indexed paths', () => {
    const result = generateSampleBody([{ matchesJsonPath: '$.items[0].id' }]);
    expect(JSON.parse(result.body!)).toEqual({ items: [{ id: 'value' }] });
  });

  it('should support bracket notation', () => {
    const result = generateSampleBody([{ matchesJsonPath: "$['user']['name']" }]);
    expect(JSON.parse(result.body!)).toEqual({ user: { name: 'value' } });
  });

  it('should merge multiple matchesJsonPath patterns into one document', () => {
    const result = generateSampleBody([
      { matchesJsonPath: '$.name' },
      { matchesJsonPath: '$.user.age' },
      { matchesJsonPath: '$.items[0].id' }
    ]);
    expect(JSON.parse(result.body!)).toEqual({
      name: 'value',
      user: { age: 'value' },
      items: [{ id: 'value' }]
    });
    expect(result.hints).toEqual([]);
  });

  it('should report filter expressions as hints', () => {
    const result = generateSampleBody([{ matchesJsonPath: '$.items[?(@.price > 10)]' }]);
    expect(result.body).toBeUndefined();
    expect(result.hints).toEqual(['matchesJsonPath: $.items[?(@.price > 10)]']);
  });

  it('should use the contains value as the body', () => {
    const result = generateSampleBody([{ contains: 'order-123' }]);
    expect(result.body).toBe('order-123');
    expect(result.hints).toEqual([]);
  });

  it('should join multiple contains values', () => {
    const result = generateSampleBody([{ contains: 'foo' }, { contains: 'bar' }]);
    expect(result.body).toBe('foo\nbar');
  });

  it('should report regex matchers as hints', () => {
    const result = generateSampleBody([{ matches: '^order-\\d+$' }]);
    expect(result.body).toBeUndefined();
    expect(result.hints).toEqual(['matches: ^order-\\d+$']);
  });

  it('should report doesNotMatch and matchesXPath as hints', () => {
    const result = generateSampleBody([
      { doesNotMatch: '.*error.*' },
      { matchesXPath: '/order/id' }
    ]);
    expect(result.body).toBeUndefined();
    expect(result.hints).toEqual(['doesNotMatch: .*error.*', 'matchesXPath: /order/id']);
  });

  it('should prefer exact matchers and hint unsatisfied remaining patterns', () => {
    const result = generateSampleBody([
      { matchesJsonPath: '$.other' },
      { equalToJson: '{"key":"value"}' }
    ]);
    expect(JSON.parse(result.body!)).toEqual({ key: 'value' });
    // $.other is not present in the exact body, so the constraint is surfaced
    expect(result.hints).toEqual(['matchesJsonPath: $.other']);
  });

  it('should not hint remaining patterns the exact body satisfies', () => {
    const result = generateSampleBody([
      { equalToJson: '{"key":"value"}' },
      { matchesJsonPath: '$.key' },
      { contains: 'value' }
    ]);
    expect(JSON.parse(result.body!)).toEqual({ key: 'value' });
    expect(result.hints).toEqual([]);
  });

  it('should verify regex matchers against the exact body', () => {
    const satisfied = generateSampleBody([{ equalTo: 'order-123' }, { matches: 'order-\\d+' }]);
    expect(satisfied.body).toBe('order-123');
    expect(satisfied.hints).toEqual([]);

    const unsatisfied = generateSampleBody([{ equalTo: 'hello' }, { matches: 'order-\\d+' }]);
    expect(unsatisfied.body).toBe('hello');
    expect(unsatisfied.hints).toEqual(['matches: order-\\d+']);
  });

  it('should hint a conflicting second exact matcher', () => {
    const result = generateSampleBody([{ equalToJson: '{"a":1}' }, { equalToJson: '{"b":2}' }]);
    expect(JSON.parse(result.body!)).toEqual({ a: 1 });
    expect(result.hints).toEqual(['equalToJson: {"b":2}']);
  });

  it('should generate JSON from paths and surface unsatisfied contains as a hint', () => {
    const result = generateSampleBody([{ matchesJsonPath: '$.name' }, { contains: 'foo' }]);
    expect(JSON.parse(result.body!)).toEqual({ name: 'value' });
    expect(result.hints).toEqual(['contains: foo']);
  });

  it('should not hint contains values the generated JSON already includes', () => {
    const result = generateSampleBody([{ matchesJsonPath: '$.name' }, { contains: 'name' }]);
    expect(JSON.parse(result.body!)).toEqual({ name: 'value' });
    expect(result.hints).toEqual([]);
  });

  it('should report conflicting paths as hints', () => {
    const result = generateSampleBody([{ matchesJsonPath: '$.a' }, { matchesJsonPath: '$.a.b' }]);
    expect(JSON.parse(result.body!)).toEqual({ a: 'value' });
    expect(result.hints).toEqual(['matchesJsonPath: $.a.b']);
  });
});
