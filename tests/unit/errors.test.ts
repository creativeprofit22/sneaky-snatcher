/**
 * Error Classes Unit Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  SnatchError,
  BrowserError,
  NavigationError,
  ElementNotFoundError,
  LLMError,
  LLMNotAvailableError,
  ConfigError,
  ValidationError,
  isSnatchError,
  formatError,
} from '../../src/errors/index.ts';

describe('Error Classes', () => {
  describe('SnatchError', () => {
    test('creates error with code', () => {
      const error = new SnatchError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('SnatchError');
    });

    test('includes cause when provided', () => {
      const cause = new Error('Original error');
      const error = new SnatchError('Wrapped error', 'WRAP_CODE', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('BrowserError', () => {
    test('has correct code', () => {
      const error = new BrowserError('Browser crashed');
      expect(error.code).toBe('BROWSER_ERROR');
      expect(error.name).toBe('BrowserError');
    });
  });

  describe('NavigationError', () => {
    test('includes URL', () => {
      const error = new NavigationError('https://example.com');
      expect(error.url).toBe('https://example.com');
      expect(error.code).toBe('NAVIGATION_ERROR');
      expect(error.message).toContain('https://example.com');
    });

    test('accepts custom message', () => {
      const error = new NavigationError('https://example.com', 'Custom navigation error');
      expect(error.message).toBe('Custom navigation error');
    });
  });

  describe('ElementNotFoundError', () => {
    test('includes selector', () => {
      const error = new ElementNotFoundError('.hero');
      expect(error.selector).toBe('.hero');
      expect(error.code).toBe('ELEMENT_NOT_FOUND');
      expect(error.message).toContain('.hero');
    });
  });

  describe('LLMError', () => {
    test('has correct code', () => {
      const error = new LLMError('LLM failed');
      expect(error.code).toBe('LLM_ERROR');
    });
  });

  describe('LLMNotAvailableError', () => {
    test('has default message', () => {
      const error = new LLMNotAvailableError();
      expect(error.message).toContain('Claude CLI');
      expect(error.code).toBe('LLM_NOT_AVAILABLE');
    });
  });

  describe('ConfigError', () => {
    test('has correct code', () => {
      const error = new ConfigError('Invalid config');
      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('ValidationError', () => {
    test('includes field name', () => {
      const error = new ValidationError('url', 'URL is required');
      expect(error.field).toBe('url');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('isSnatchError()', () => {
    test('returns true for SnatchError', () => {
      expect(isSnatchError(new SnatchError('test', 'TEST'))).toBe(true);
    });

    test('returns true for subclasses', () => {
      expect(isSnatchError(new BrowserError('test'))).toBe(true);
      expect(isSnatchError(new LLMError('test'))).toBe(true);
    });

    test('returns false for regular Error', () => {
      expect(isSnatchError(new Error('test'))).toBe(false);
    });

    test('returns false for non-errors', () => {
      expect(isSnatchError('string')).toBe(false);
      expect(isSnatchError(null)).toBe(false);
      expect(isSnatchError(undefined)).toBe(false);
    });
  });

  describe('formatError()', () => {
    test('formats SnatchError with code', () => {
      const error = new SnatchError('Something went wrong', 'SOME_ERROR');
      expect(formatError(error)).toBe('[SOME_ERROR] Something went wrong');
    });

    test('formats regular Error', () => {
      const error = new Error('Regular error');
      expect(formatError(error)).toBe('Regular error');
    });

    test('converts non-errors to string', () => {
      expect(formatError('string error')).toBe('string error');
      expect(formatError(42)).toBe('42');
    });
  });
});
