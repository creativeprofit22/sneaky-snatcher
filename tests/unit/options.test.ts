/**
 * CLI Options Unit Tests
 */

import { describe, test, expect } from 'bun:test';
import { validateOptions, normalizeUrl } from '../../src/cli/options.ts';
import type { SnatchOptions } from '../../src/types/index.ts';

describe('CLI Options', () => {
  describe('validateOptions()', () => {
    const validOptions: SnatchOptions = {
      url: 'https://example.com',
      selector: '.hero',
      framework: 'react',
      styling: 'tailwind',
      outputDir: './components',
    };

    test('accepts valid options with selector', () => {
      const result = validateOptions(validOptions);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('accepts valid options with find', () => {
      const result = validateOptions({
        ...validOptions,
        selector: undefined,
        find: 'the hero section',
      });
      expect(result.valid).toBe(true);
    });

    test('rejects missing URL', () => {
      const result = validateOptions({
        ...validOptions,
        url: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('URL'))).toBe(true);
    });

    test('rejects missing selector and find', () => {
      const result = validateOptions({
        ...validOptions,
        selector: undefined,
        find: undefined,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('--selector') || e.includes('--find'))).toBe(true);
    });

    test('rejects both selector and find', () => {
      const result = validateOptions({
        ...validOptions,
        selector: '.hero',
        find: 'hero section',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Cannot use both'))).toBe(true);
    });

    test('rejects invalid framework', () => {
      const result = validateOptions({
        ...validOptions,
        framework: 'angular' as any,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('framework'))).toBe(true);
    });

    test('rejects invalid styling', () => {
      const result = validateOptions({
        ...validOptions,
        styling: 'scss' as any,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('styling'))).toBe(true);
    });

    test('rejects non-PascalCase component name', () => {
      const result = validateOptions({
        ...validOptions,
        componentName: 'myComponent',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('PascalCase'))).toBe(true);
    });

    test('accepts PascalCase component name', () => {
      const result = validateOptions({
        ...validOptions,
        componentName: 'MyComponent',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('normalizeUrl()', () => {
    test('adds https to bare domain', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
    });

    test('preserves existing https', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    });

    test('preserves existing http', () => {
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    });

    test('handles domain with path', () => {
      expect(normalizeUrl('example.com/path')).toBe('https://example.com/path');
    });
  });
});
