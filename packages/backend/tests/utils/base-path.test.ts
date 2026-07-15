import { describe, it, expect } from 'vitest';
import { normalizeBasePath } from '../../src/utils/base-path.js';

describe('normalizeBasePath', () => {
  it('returns empty string when no base path is configured', () => {
    expect(normalizeBasePath(undefined)).toBe('');
    expect(normalizeBasePath(null)).toBe('');
    expect(normalizeBasePath('')).toBe('');
    expect(normalizeBasePath('   ')).toBe('');
    expect(normalizeBasePath('/')).toBe('');
    expect(normalizeBasePath('///')).toBe('');
  });

  it('adds a leading slash when missing', () => {
    expect(normalizeBasePath('hub')).toBe('/hub');
    expect(normalizeBasePath('hub/nested')).toBe('/hub/nested');
  });

  it('removes trailing slashes', () => {
    expect(normalizeBasePath('/hub/')).toBe('/hub');
    expect(normalizeBasePath('/hub///')).toBe('/hub');
    expect(normalizeBasePath('hub/')).toBe('/hub');
  });

  it('keeps already normalized paths as-is', () => {
    expect(normalizeBasePath('/hub')).toBe('/hub');
    expect(normalizeBasePath('/hub/nested')).toBe('/hub/nested');
  });
});
