import { describe, it, expect } from 'vitest';
import { getTags, normalizeTags, setTags, type Mapping } from '@wiremock-hub/shared';

describe('normalizeTags', () => {
  it('should trim, drop empties and dedupe while keeping order', () => {
    expect(normalizeTags([' Orders ', '', 'smoke', 'Orders', '  '])).toEqual(['Orders', 'smoke']);
  });

  it('should treat a lone string as one tag and stringify numbers', () => {
    expect(normalizeTags(' Orders ')).toEqual(['Orders']);
    expect(normalizeTags(['Orders', 2024])).toEqual(['Orders', '2024']);
  });

  it('should ignore other input and elements', () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags({ a: 1 })).toEqual([]);
    expect(normalizeTags(['Orders', null, true, { a: 1 }])).toEqual(['Orders']);
  });
});

describe('getTags', () => {
  it('should read metadata.tags', () => {
    expect(getTags({ metadata: { tags: ['Orders'] } })).toEqual(['Orders']);
    expect(getTags({})).toEqual([]);
  });
});

describe('setTags', () => {
  const base = (): Mapping => ({ request: { url: '/a' }, response: { status: 200 } });

  it('should set normalized tags', () => {
    const mapping = base();
    setTags(mapping, [' Orders', 'Orders', 'smoke']);
    expect(mapping.metadata).toEqual({ tags: ['Orders', 'smoke'] });
  });

  it('should remove metadata entirely when clearing the only key', () => {
    const mapping: Mapping = { ...base(), metadata: { tags: ['Orders'] } };
    setTags(mapping, []);
    expect(mapping).not.toHaveProperty('metadata');
  });

  it('should keep other metadata keys when clearing tags', () => {
    const mapping: Mapping = { ...base(), metadata: { tags: ['Orders'], custom: 'x' } };
    setTags(mapping, []);
    expect(mapping.metadata).toEqual({ custom: 'x' });
  });
});
