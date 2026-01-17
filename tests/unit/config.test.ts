/**
 * Config Module Unit Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { DEFAULTS, SUPPORTED_FRAMEWORKS, SUPPORTED_STYLING } from '../../src/config/constants.ts';

describe('Config Constants', () => {
  describe('DEFAULTS', () => {
    test('has valid default framework', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain(DEFAULTS.framework);
    });

    test('has valid default styling', () => {
      expect(SUPPORTED_STYLING).toContain(DEFAULTS.styling);
    });

    test('has reasonable timeout values', () => {
      expect(DEFAULTS.timeout).toBeGreaterThan(1000);
      expect(DEFAULTS.llmTimeout).toBeGreaterThan(DEFAULTS.timeout);
    });

    test('has valid viewport dimensions', () => {
      expect(DEFAULTS.viewport.width).toBeGreaterThan(0);
      expect(DEFAULTS.viewport.height).toBeGreaterThan(0);
    });
  });

  describe('SUPPORTED_FRAMEWORKS', () => {
    test('includes react', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('react');
    });

    test('includes vue', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('vue');
    });

    test('includes svelte', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('svelte');
    });

    test('includes html', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('html');
    });
  });

  describe('SUPPORTED_STYLING', () => {
    test('includes tailwind', () => {
      expect(SUPPORTED_STYLING).toContain('tailwind');
    });

    test('includes css-modules', () => {
      expect(SUPPORTED_STYLING).toContain('css-modules');
    });

    test('includes vanilla', () => {
      expect(SUPPORTED_STYLING).toContain('vanilla');
    });

    test('includes inline', () => {
      expect(SUPPORTED_STYLING).toContain('inline');
    });
  });
});
