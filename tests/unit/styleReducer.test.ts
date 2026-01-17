/**
 * StyleReducer Unit Tests
 */

import { describe, test, expect } from 'bun:test';
import { StyleReducer } from '../../src/extractor/styleReducer.ts';

describe('StyleReducer', () => {
  const reducer = new StyleReducer();

  describe('reduce()', () => {
    test('removes browser default values', () => {
      const styles = {
        '.test': {
          display: 'block',
          position: 'static',
          visibility: 'visible',
          color: '#ff0000',
        },
      };

      const result = reducer.reduce(styles);

      expect(result).not.toContain('position: static');
      expect(result).not.toContain('visibility: visible');
      expect(result).toContain('color: #ff0000');
    });

    test('removes vendor prefixes', () => {
      const styles = {
        '.test': {
          display: 'flex',
          '-webkit-display': 'flex',
          '-moz-display': 'flex',
        },
      };

      const result = reducer.reduce(styles);

      expect(result).toContain('display: flex');
      expect(result).not.toContain('-webkit-');
      expect(result).not.toContain('-moz-');
    });

    test('keeps essential layout properties', () => {
      const styles = {
        '.test': {
          display: 'flex',
          'flex-direction': 'column',
          'justify-content': 'center',
          'align-items': 'center',
          gap: '1rem',
        },
      };

      const result = reducer.reduce(styles);

      expect(result).toContain('display: flex');
      expect(result).toContain('flex-direction: column');
      expect(result).toContain('justify-content: center');
    });

    test('converts longhand to shorthand', () => {
      const reducer = new StyleReducer({ useShorthand: true });
      const styles = {
        '.test': {
          'margin-top': '10px',
          'margin-right': '20px',
          'margin-bottom': '10px',
          'margin-left': '20px',
        },
      };

      const result = reducer.reduce(styles);

      expect(result).toContain('margin: 10px 20px 10px 20px');
      expect(result).not.toContain('margin-top');
    });

    test('returns empty string for no styles', () => {
      const result = reducer.reduce({});
      expect(result).toBe('');
    });

    test('handles multiple selectors', () => {
      const styles = {
        '.card': { display: 'flex', padding: '1rem' },
        '.card-title': { 'font-size': '1.5rem', 'font-weight': 'bold' },
      };

      const result = reducer.reduce(styles);

      expect(result).toContain('.card');
      expect(result).toContain('.card-title');
      expect(result).toContain('display: flex');
      expect(result).toContain('font-size: 1.5rem');
    });
  });
});
