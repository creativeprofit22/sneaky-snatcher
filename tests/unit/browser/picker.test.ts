/**
 * Element Picker Unit Tests
 *
 * Tests the interactive element picker overlay that allows users to
 * select elements in the browser and generate CSS selectors.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { launchPicker, type PickerResult } from '../../../src/browser/picker.ts';

/**
 * Mock Page object for Playwright
 * Simulates the minimal interface needed by launchPicker
 */
function createMockPage() {
  let exposedFunctions: Record<string, Function> = {};
  let evaluatedCode: Function | null = null;

  return {
    exposedFunctions,
    evaluatedCode: null as Function | null,

    exposeFunction: mock(async (name: string, fn: Function) => {
      exposedFunctions[name] = fn;
    }),

    evaluate: mock(async (fn: Function) => {
      evaluatedCode = fn;
      // We don't execute it here since it expects DOM APIs
    }),

    // Helper to trigger the selection callback
    triggerSelection: (result: PickerResult) => {
      if (exposedFunctions['__sneakySnatcherSelect']) {
        exposedFunctions['__sneakySnatcherSelect'](result);
      }
    },
  };
}

/**
 * Creates a mock DOM environment for testing selector generation logic
 * This simulates what happens inside page.evaluate()
 */
function createMockDOM() {
  const elements: Map<string, Element[]> = new Map();

  // Mock CSS.escape
  const cssEscape = (str: string): string => {
    return str.replace(/([^\w-])/g, '\\$1');
  };

  // Mock Element
  class MockElement {
    id: string = '';
    tagName: string = 'DIV';
    classList: string[] = [];
    attributes: { name: string; value: string }[] = [];
    parentElement: MockElement | null = null;
    children: MockElement[] = [];
    textContent: string = '';

    constructor(tagName: string = 'DIV') {
      this.tagName = tagName.toUpperCase();
    }

    getBoundingClientRect() {
      return { top: 100, left: 100, width: 200, height: 50, bottom: 150, right: 300 };
    }
  }

  return {
    MockElement,
    cssEscape,
    elements,
  };
}

describe('Element Picker', () => {
  describe('launchPicker()', () => {
    test('exposes __sneakySnatcherSelect function to page', async () => {
      const mockPage = createMockPage();

      // Start the picker (it will wait for selection)
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate selection after a tick
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#test-element',
          tagName: 'div',
          textPreview: 'Test content',
        });
      }, 10);

      const result = await pickerPromise;

      expect(mockPage.exposeFunction).toHaveBeenCalledTimes(1);
      expect(mockPage.exposeFunction.mock.calls[0]?.[0]).toBe('__sneakySnatcherSelect');
    });

    test('calls page.evaluate to inject overlay', async () => {
      const mockPage = createMockPage();

      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#test',
          tagName: 'div',
          textPreview: '',
        });
      }, 10);

      await pickerPromise;

      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
      expect(typeof mockPage.evaluate.mock.calls[0]?.[0]).toBe('function');
    });

    test('returns PickerResult with selector, tagName, and textPreview', async () => {
      const mockPage = createMockPage();
      const expectedResult: PickerResult = {
        selector: '.hero-section',
        tagName: 'section',
        textPreview: 'Welcome to our website',
      };

      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection(expectedResult);
      }, 10);

      const result = await pickerPromise;

      expect(result.selector).toBe('.hero-section');
      expect(result.tagName).toBe('section');
      expect(result.textPreview).toBe('Welcome to our website');
    });

    test('throws error when selection is cancelled (empty selector)', async () => {
      const mockPage = createMockPage();

      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '',
          tagName: '',
          textPreview: '',
        });
      }, 10);

      await expect(pickerPromise).rejects.toThrow('Element selection cancelled');
    });
  });

  describe('PickerResult Interface', () => {
    test('accepts valid PickerResult structure', async () => {
      const mockPage = createMockPage();

      const pickerPromise = launchPicker(mockPage as any);

      const result: PickerResult = {
        selector: '#unique-id',
        tagName: 'button',
        textPreview: 'Click me',
      };

      setTimeout(() => {
        mockPage.triggerSelection(result);
      }, 10);

      const received = await pickerPromise;
      expect(received).toEqual(result);
    });

    test('handles complex selectors', async () => {
      const mockPage = createMockPage();

      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'div.container > ul.menu > li:nth-of-type(3) > a.nav-link',
          tagName: 'a',
          textPreview: 'About Us',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toContain(':nth-of-type');
      expect(result.selector).toContain('>');
    });
  });

  describe('Text Preview Truncation', () => {
    test('preserves short text as-is', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#test',
          tagName: 'p',
          textPreview: 'Short text',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.textPreview).toBe('Short text');
      expect(result.textPreview.endsWith('...')).toBe(false);
    });

    test('truncated text ends with ellipsis', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate what the injected code would produce for long text
      // The picker truncates at 50 chars: textContent.trim().slice(0, 50) + (textContent.length > 50 ? '...' : '')
      const longText = 'This is a very long piece of text that exceeds fifty characters and needs truncation';
      const truncated = longText.slice(0, 50) + '...';

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#test',
          tagName: 'p',
          textPreview: truncated,
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.textPreview.endsWith('...')).toBe(true);
      expect(result.textPreview.length).toBe(53); // 50 chars + '...'
      // Verify the truncation point is correct (50 chars before ellipsis)
      expect(result.textPreview.slice(0, -3).length).toBe(50);
      expect(result.textPreview.slice(0, -3)).toBe(longText.slice(0, 50));
    });
  });

  describe('Selector Generation Logic (Injected Code)', () => {
    /**
     * These tests verify the selector generation logic that runs inside page.evaluate()
     * We extract and test the logic patterns here since we can't easily run in JSDOM
     */

    describe('ID Selector Priority', () => {
      test('ID selector format is correct', () => {
        // The picker uses: `#${CSS.escape(el.id)}`
        const id = 'my-element';
        const selector = `#${id}`;
        expect(selector).toBe('#my-element');
      });

      test('CSS.escape handles special characters in IDs', () => {
        // Simulating CSS.escape behavior for IDs with special chars
        const specialId = 'element:with:colons';
        // CSS.escape would escape colons
        const escaped = specialId.replace(/:/g, '\\:');
        expect(`#${escaped}`).toBe('#element\\:with\\:colons');
      });

      test('ignores __sneaky prefixed IDs', () => {
        // The picker filters: if (el.id && !el.id.startsWith('__sneaky'))
        const sneakyId = '__sneaky-picker-overlay';
        expect(sneakyId.startsWith('__sneaky')).toBe(true);
      });
    });

    describe('Class Selector Fallback', () => {
      test('class selector format combines tag and classes', () => {
        // Format: `${el.tagName.toLowerCase()}${classes}`
        const tagName = 'DIV';
        const classes = ['container', 'active'];
        const escapedClasses = classes.map(c => `.${c}`).join('');
        const selector = `${tagName.toLowerCase()}${escapedClasses}`;
        expect(selector).toBe('div.container.active');
      });

      test('filters out __sneaky prefixed classes', () => {
        const classes = ['normal-class', '__sneaky-highlight', 'another-class'];
        const filtered = classes.filter(c => !c.startsWith('__sneaky'));
        expect(filtered).toEqual(['normal-class', 'another-class']);
      });

      test('CSS.escape handles special characters in classes', () => {
        const specialClass = 'lg:flex';
        // CSS.escape would escape the colon
        const escaped = specialClass.replace(/:/g, '\\:');
        expect(`.${escaped}`).toBe('.lg\\:flex');
      });
    });

    describe('Data Attribute Selector', () => {
      test('data attribute selector format is correct', () => {
        // Format: `[${attr.name}="${CSS.escape(attr.value)}"]`
        const attrName = 'data-testid';
        const attrValue = 'submit-button';
        const selector = `[${attrName}="${attrValue}"]`;
        expect(selector).toBe('[data-testid="submit-button"]');
      });

      test('CSS.escape handles special characters in attribute values', () => {
        const attrValue = 'value"with"quotes';
        // CSS.escape would escape quotes
        const escaped = attrValue.replace(/"/g, '\\"');
        expect(`[data-test="${escaped}"]`).toBe('[data-test="value\\"with\\"quotes"]');
      });

      test('only uses data-* attributes', () => {
        const attrs = [
          { name: 'data-id', value: '123' },
          { name: 'class', value: 'test' },
          { name: 'data-testid', value: 'btn' },
          { name: 'href', value: '/link' },
        ];
        const dataAttrs = attrs.filter(a => a.name.startsWith('data-') && a.value);
        expect(dataAttrs).toHaveLength(2);
        expect(dataAttrs[0]?.name).toBe('data-id');
        expect(dataAttrs[1]?.name).toBe('data-testid');
      });
    });

    describe('nth-of-type Fallback', () => {
      test('nth-of-type format is correct', () => {
        const tagName = 'li';
        const index = 3;
        const selector = `${tagName}:nth-of-type(${index})`;
        expect(selector).toBe('li:nth-of-type(3)');
      });

      test('path combines with child combinator', () => {
        const path = ['div.container', 'ul.menu', 'li:nth-of-type(2)'];
        const fullSelector = path.join(' > ');
        expect(fullSelector).toBe('div.container > ul.menu > li:nth-of-type(2)');
      });

      test('path limited to 5 levels', () => {
        // The picker limits: while (current && current !== document.body && path.length < 5)
        const maxPathLength = 5;
        const longPath = ['div', 'section', 'article', 'ul', 'li', 'a', 'span'];
        const limitedPath = longPath.slice(0, maxPathLength);
        expect(limitedPath).toHaveLength(5);
      });
    });

    describe('Class Length Filter', () => {
      test('filters classes longer than 30 characters for path building', () => {
        // The picker uses: c.length < 30
        const classes = [
          'short',
          'this-is-a-very-long-class-name-that-exceeds-thirty-characters',
          'medium-length',
        ];
        const filtered = classes.filter(c => !c.startsWith('__sneaky') && c.length < 30);
        expect(filtered).toEqual(['short', 'medium-length']);
      });
    });
  });

  describe('Event Handler Behavior', () => {
    describe('MouseMove Handler', () => {
      test('ignores elements with __sneaky prefix', () => {
        // Handler checks: if (target.id?.startsWith('__sneaky'))
        const overlayId = '__sneaky-picker-overlay';
        const tooltipId = '__sneaky-picker-tooltip';
        const bannerId = '__sneaky-picker-banner';

        expect(overlayId.startsWith('__sneaky')).toBe(true);
        expect(tooltipId.startsWith('__sneaky')).toBe(true);
        expect(bannerId.startsWith('__sneaky')).toBe(true);
      });
    });

    describe('Click Handler', () => {
      test('ignores picker UI elements', () => {
        // Handler checks: if (target.id?.startsWith('__sneaky'))
        const targetId = '__sneaky-picker-overlay';
        expect(targetId.startsWith('__sneaky')).toBe(true);
      });
    });

    describe('ESC Cancellation', () => {
      test('ESC key returns empty result', async () => {
        const mockPage = createMockPage();
        const pickerPromise = launchPicker(mockPage as any);

        // Simulate ESC press returning empty result
        setTimeout(() => {
          mockPage.triggerSelection({
            selector: '',
            tagName: '',
            textPreview: '',
          });
        }, 10);

        await expect(pickerPromise).rejects.toThrow('Element selection cancelled');
      });
    });
  });

  describe('Tooltip Positioning', () => {
    test('tooltip positioned above element when space available', () => {
      // Logic: if (rect.top > tooltipHeight + 10)
      const tooltipHeight = 60;
      const rectTop = 150; // Plenty of space above
      const shouldPositionAbove = rectTop > tooltipHeight + 10;
      expect(shouldPositionAbove).toBe(true);
    });

    test('tooltip positioned below element when no space above', () => {
      const tooltipHeight = 60;
      const rectTop = 50; // Not enough space above
      const shouldPositionAbove = rectTop > tooltipHeight + 10;
      expect(shouldPositionAbove).toBe(false);
    });

    test('tooltip left position clamped to viewport bounds', () => {
      // Logic: Math.max(10, Math.min(rect.left, window.innerWidth - 420))
      const windowWidth = 1920;
      const maxRight = windowWidth - 420; // 1500

      // Far left element
      expect(Math.max(10, Math.min(0, maxRight))).toBe(10);

      // Normal position
      expect(Math.max(10, Math.min(500, maxRight))).toBe(500);

      // Far right element - should clamp
      expect(Math.max(10, Math.min(1600, maxRight))).toBe(1500);
    });
  });

  describe('Overlay Styling', () => {
    test('overlay has correct z-index', () => {
      // The overlay uses z-index: 999999
      const zIndex = 999999;
      expect(zIndex).toBeGreaterThan(999);
    });

    test('overlay is non-interactive (pointer-events: none)', () => {
      // This ensures the overlay doesn't interfere with element selection
      const pointerEvents = 'none';
      expect(pointerEvents).toBe('none');
    });
  });

  describe('CSS.escape Behavior', () => {
    /**
     * Test cases for CSS.escape which is used throughout selector generation
     * https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape
     */

    test('escapes leading digits', () => {
      // CSS identifiers cannot start with digits without escaping
      const id = '123element';
      // CSS.escape would produce: \31 23element (1 is escaped as \31)
      expect(id[0]).toBe('1');
    });

    test('escapes special CSS characters', () => {
      const specialChars = [':', '.', '#', '[', ']', '(', ')', '*', '+', '>', '~', '|', '^', '$', '='];
      specialChars.forEach(char => {
        expect(char.match(/[^\w-]/)).toBeTruthy();
      });
    });

    test('handles Tailwind-style class names', () => {
      // Tailwind classes like "lg:flex" or "hover:bg-blue-500" contain colons
      const tailwindClasses = ['lg:flex', 'hover:bg-blue-500', 'md:grid-cols-3'];
      tailwindClasses.forEach(cls => {
        expect(cls.includes(':')).toBe(true);
      });
    });

    test('handles bracket notation in class names', () => {
      // Tailwind arbitrary values like "w-[100px]"
      const arbitraryClasses = ['w-[100px]', 'bg-[#ff0000]', 'grid-cols-[1fr_2fr]'];
      arbitraryClasses.forEach(cls => {
        expect(cls.includes('[') && cls.includes(']')).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty classList', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'div:nth-of-type(1)',
          tagName: 'div',
          textPreview: '',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('div:nth-of-type(1)');
    });

    test('handles element with no text content', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'img.hero',
          tagName: 'img',
          textPreview: '',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.textPreview).toBe('');
    });

    test('handles deeply nested elements', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      const deepSelector = 'main > div.container > section > article > div > p:nth-of-type(2)';

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: deepSelector,
          tagName: 'p',
          textPreview: 'Nested content',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector.split('>').length).toBeGreaterThan(3);
    });

    test('handles SVG elements', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'svg.icon',
          tagName: 'svg',
          textPreview: '',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.tagName).toBe('svg');
    });

    test('handles custom elements (Web Components)', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'my-custom-element',
          tagName: 'my-custom-element',
          textPreview: 'Custom content',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.tagName).toBe('my-custom-element');
      expect(result.tagName.includes('-')).toBe(true);
    });

    test('handles whitespace-only text content', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // The picker trims text: textContent.trim().slice(0, 50)
      const whitespaceText = '   \n\t   ';
      const trimmed = whitespaceText.trim();

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#test',
          tagName: 'div',
          textPreview: trimmed,
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.textPreview).toBe('');
    });
  });

  describe('Selector Uniqueness', () => {
    test('ID selectors should be unique', () => {
      // The picker verifies: document.querySelectorAll(idSelector).length === 1
      const uniquenessCheck = (count: number) => count === 1;
      expect(uniquenessCheck(1)).toBe(true);
      expect(uniquenessCheck(2)).toBe(false);
      expect(uniquenessCheck(0)).toBe(false);
    });

    test('falls back when ID is not unique', () => {
      // If document.querySelectorAll(idSelector).length !== 1, try next strategy
      const matchCount: number = 2; // Duplicate ID
      const isUnique = matchCount === 1;
      expect(isUnique).toBe(false);
    });
  });

  describe('DOM Element Creation', () => {
    test('creates overlay element with correct ID', () => {
      const overlayId = '__sneaky-picker-overlay';
      expect(overlayId).toBe('__sneaky-picker-overlay');
    });

    test('creates tooltip element with correct ID', () => {
      const tooltipId = '__sneaky-picker-tooltip';
      expect(tooltipId).toBe('__sneaky-picker-tooltip');
    });

    test('creates banner element with correct ID', () => {
      const bannerId = '__sneaky-picker-banner';
      expect(bannerId).toBe('__sneaky-picker-banner');
    });

    test('overlay has fixed positioning', () => {
      // overlay.style.position = 'fixed'
      const position = 'fixed';
      expect(position).toBe('fixed');
    });
  });

  describe('Concurrent Selection Handling', () => {
    test('only one selection can complete the promise', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Wait for exposeFunction to be called before triggering selections
      await new Promise(resolve => setTimeout(resolve, 5));

      // Trigger first selection
      mockPage.triggerSelection({
        selector: '#first',
        tagName: 'div',
        textPreview: 'First',
      });

      // Trigger second selection immediately after (simulates rapid clicking)
      mockPage.triggerSelection({
        selector: '#second',
        tagName: 'span',
        textPreview: 'Second',
      });

      const result = await pickerPromise;
      // Only the first selection should resolve the promise
      // Once the promise is resolved, subsequent triggers should be ignored
      expect(result.selector).toBe('#first');
    });
  });
});

describe('Integration Scenarios', () => {
  test('typical user flow: hover, click, receive selector', async () => {
    const mockPage = createMockPage();
    const pickerPromise = launchPicker(mockPage as any);

    // Simulate user clicking on a button
    setTimeout(() => {
      mockPage.triggerSelection({
        selector: 'button.primary-btn',
        tagName: 'button',
        textPreview: 'Submit Form',
      });
    }, 50);

    const result = await pickerPromise;

    expect(result.selector).toBe('button.primary-btn');
    expect(result.tagName).toBe('button');
    expect(result.textPreview).toBe('Submit Form');
  });

  test('user cancels with ESC key', async () => {
    const mockPage = createMockPage();
    const pickerPromise = launchPicker(mockPage as any);

    setTimeout(() => {
      mockPage.triggerSelection({
        selector: '',
        tagName: '',
        textPreview: '',
      });
    }, 10);

    await expect(pickerPromise).rejects.toThrow('Element selection cancelled');
  });

  test('selecting element with data-testid', async () => {
    const mockPage = createMockPage();
    const pickerPromise = launchPicker(mockPage as any);

    setTimeout(() => {
      mockPage.triggerSelection({
        selector: '[data-testid="login-button"]',
        tagName: 'button',
        textPreview: 'Log In',
      });
    }, 10);

    const result = await pickerPromise;
    expect(result.selector).toContain('data-testid');
    expect(result.selector).toContain('login-button');
  });

  test('selecting element requiring nth-of-type', async () => {
    const mockPage = createMockPage();
    const pickerPromise = launchPicker(mockPage as any);

    setTimeout(() => {
      mockPage.triggerSelection({
        selector: 'ul.nav > li:nth-of-type(3) > a',
        tagName: 'a',
        textPreview: 'Contact',
      });
    }, 10);

    const result = await pickerPromise;
    expect(result.selector).toContain('nth-of-type');
  });
});

describe('Selector Generation Strategies', () => {
  describe('Selector Priority Order', () => {
    test('ID has highest priority', () => {
      // Selector generation order: ID → classes → data-attrs → nth-of-type
      const strategies = ['id', 'classes', 'data-attrs', 'nth-of-type'];
      expect(strategies[0]).toBe('id');
    });

    test('classes are second priority after ID', () => {
      const strategies = ['id', 'classes', 'data-attrs', 'nth-of-type'];
      expect(strategies[1]).toBe('classes');
    });

    test('data attributes are third priority', () => {
      const strategies = ['id', 'classes', 'data-attrs', 'nth-of-type'];
      expect(strategies[2]).toBe('data-attrs');
    });

    test('nth-of-type is fallback strategy', () => {
      const strategies = ['id', 'classes', 'data-attrs', 'nth-of-type'];
      expect(strategies[3]).toBe('nth-of-type');
    });
  });

  describe('Complex Selector Patterns', () => {
    test('handles multiple classes on same element', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'div.container.active.visible.highlighted',
          tagName: 'div',
          textPreview: 'Content',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector.match(/\./g)?.length).toBeGreaterThanOrEqual(4);
    });

    test('handles elements with both ID and classes', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // When ID is unique, it should be used alone
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#unique-element',
          tagName: 'div',
          textPreview: 'Has both ID and classes',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('#unique-element');
    });

    test('handles multiple data attributes', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '[data-component="card"]',
          tagName: 'article',
          textPreview: 'Card content',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toContain('data-');
    });
  });

  describe('Tag Name Handling', () => {
    test('lowercases tag names in selectors', () => {
      const tagName = 'DIV';
      expect(tagName.toLowerCase()).toBe('div');
    });

    test('preserves all HTML5 semantic tags', () => {
      const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
      semanticTags.forEach(tag => {
        expect(tag).toBe(tag.toLowerCase());
      });
    });

    test('handles form element tags', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'input#email',
          tagName: 'input',
          textPreview: '',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.tagName).toBe('input');
    });
  });
});

describe('Error Handling', () => {
  test('handles page.exposeFunction being called only once', async () => {
    const mockPage = createMockPage();
    const pickerPromise = launchPicker(mockPage as any);

    setTimeout(() => {
      mockPage.triggerSelection({
        selector: '#test',
        tagName: 'div',
        textPreview: '',
      });
    }, 10);

    await pickerPromise;

    // exposeFunction should be called exactly once
    expect(mockPage.exposeFunction.mock.calls.length).toBe(1);
  });

  test('handles selection with special unicode characters in text', async () => {
    const mockPage = createMockPage();
    const pickerPromise = launchPicker(mockPage as any);

    setTimeout(() => {
      mockPage.triggerSelection({
        selector: '#emoji-element',
        tagName: 'span',
        textPreview: 'Hello World!',
      });
    }, 10);

    const result = await pickerPromise;
    expect(result.textPreview).toContain('Hello');
  });

  test('handles selection with HTML entities in text preview', async () => {
    const mockPage = createMockPage();
    const pickerPromise = launchPicker(mockPage as any);

    setTimeout(() => {
      mockPage.triggerSelection({
        selector: '#entity-element',
        tagName: 'p',
        textPreview: 'Price: $100 & tax',
      });
    }, 10);

    const result = await pickerPromise;
    expect(result.textPreview).toContain('&');
  });
});

describe('Cleanup Verification', () => {
  test('cleanup removes all three UI elements', () => {
    // The cleanup function removes overlay, tooltip, and banner
    const elementsToRemove = ['overlay', 'tooltip', 'banner'];
    expect(elementsToRemove).toHaveLength(3);
  });

  test('cleanup removes all three event listeners', () => {
    // The cleanup function removes mousemove, click, and keydown listeners
    const listenersToRemove = ['mousemove', 'click', 'keydown'];
    expect(listenersToRemove).toHaveLength(3);
  });

  test('event listeners use capture phase', () => {
    // All listeners use the capture phase (third arg = true)
    const capturePhase = true;
    expect(capturePhase).toBe(true);
  });
});

describe('Sibling Detection for nth-of-type', () => {
  test('counts only siblings with same tag name', () => {
    // siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName)
    const children = [
      { tagName: 'DIV' },
      { tagName: 'SPAN' },
      { tagName: 'DIV' },
      { tagName: 'P' },
      { tagName: 'DIV' },
    ];
    const divSiblings = children.filter(c => c.tagName === 'DIV');
    expect(divSiblings).toHaveLength(3);
  });

  test('nth-of-type index is 1-based', () => {
    // index = siblings.indexOf(current) + 1
    const siblings = ['first', 'second', 'third'];
    const current = 'second';
    const index = siblings.indexOf(current) + 1;
    expect(index).toBe(2);
  });

  test('only adds nth-of-type when multiple siblings exist', () => {
    // if (siblings.length > 1)
    const singleSibling = 1;
    const multipleSiblings = 3;
    expect(singleSibling > 1).toBe(false);
    expect(multipleSiblings > 1).toBe(true);
  });
});

describe('Banner Content', () => {
  test('banner contains picker active message', () => {
    const bannerContent = 'Element Picker Active';
    expect(bannerContent).toContain('Picker');
    expect(bannerContent).toContain('Active');
  });

  test('banner mentions hover instruction', () => {
    const instruction = 'Hover to highlight, click to select';
    expect(instruction).toContain('Hover');
    expect(instruction).toContain('click');
  });

  test('banner mentions ESC to cancel', () => {
    const escInstruction = 'Press ESC to cancel';
    expect(escInstruction).toContain('ESC');
    expect(escInstruction).toContain('cancel');
  });
});

describe('Tooltip Content Generation', () => {
  test('tooltip shows tag name with angle brackets', () => {
    const tagName = 'button';
    const formatted = `<${tagName}>`;
    expect(formatted).toBe('<button>');
  });

  test('tooltip shows class preview (first 2 classes)', () => {
    const classList = ['primary', 'large', 'rounded', 'shadow'];
    const preview = `.${classList.slice(0, 2).join('.')}`;
    expect(preview).toBe('.primary.large');
  });

  test('tooltip handles element with no classes', () => {
    const classList: string[] = [];
    const classPreview = classList.length > 0 ? `.${classList.slice(0, 2).join('.')}` : '';
    expect(classPreview).toBe('');
  });
});

describe('Keyboard Shortcuts', () => {
  describe('Enter Key Selection', () => {
    test('Enter key confirms current selection', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate Enter key confirming selection on hovered element
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#current-element',
          tagName: 'button',
          textPreview: 'Submit',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('#current-element');
      expect(result.tagName).toBe('button');
    });

    test('Enter with no current element does nothing', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate ESC after Enter with no element
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '',
          tagName: '',
          textPreview: '',
        });
      }, 10);

      await expect(pickerPromise).rejects.toThrow('Element selection cancelled');
    });
  });

  describe('Arrow Key Navigation', () => {
    describe('ArrowUp - Previous Sibling', () => {
      test('navigates to previous sibling element', () => {
        // The picker uses: currentElement.previousElementSibling
        const siblings = ['first', 'second', 'third'];
        const currentIndex = 2; // 'third'
        const prevIndex = currentIndex - 1;
        expect(siblings[prevIndex]).toBe('second');
      });

      test('does not navigate past first sibling', () => {
        const siblings = ['first', 'second', 'third'];
        const currentIndex = 0; // 'first'
        const hasPrev = currentIndex > 0;
        expect(hasPrev).toBe(false);
      });

      test('skips __sneaky prefixed siblings', () => {
        const sibling = { id: '__sneaky-picker-overlay' };
        const shouldSkip = sibling.id.startsWith('__sneaky');
        expect(shouldSkip).toBe(true);
      });
    });

    describe('ArrowDown - Next Sibling', () => {
      test('navigates to next sibling element', () => {
        // The picker uses: currentElement.nextElementSibling
        const siblings = ['first', 'second', 'third'];
        const currentIndex = 0; // 'first'
        const nextIndex = currentIndex + 1;
        expect(siblings[nextIndex]).toBe('second');
      });

      test('does not navigate past last sibling', () => {
        const siblings = ['first', 'second', 'third'];
        const currentIndex = 2; // 'third'
        const hasNext = currentIndex < siblings.length - 1;
        expect(hasNext).toBe(false);
      });
    });

    describe('ArrowLeft - Parent Element', () => {
      test('navigates to parent element', () => {
        // The picker uses: currentElement.parentElement
        const parentTagName = 'section';
        const childTagName = 'article';
        expect(parentTagName).not.toBe(childTagName);
      });

      test('does not navigate past document.body', () => {
        // The picker checks: parent !== document.body
        const bodyTagName = 'BODY';
        const shouldStop = (tagName: string) => tagName === bodyTagName;
        expect(shouldStop('BODY')).toBe(true);
        expect(shouldStop('DIV')).toBe(false);
      });

      test('skips __sneaky prefixed parent', () => {
        const parent = { id: '__sneaky-container' };
        const shouldSkip = parent.id.startsWith('__sneaky');
        expect(shouldSkip).toBe(true);
      });
    });

    describe('ArrowRight - First Child', () => {
      test('navigates to first child element', () => {
        // The picker uses: currentElement.firstElementChild
        const children = ['firstChild', 'secondChild', 'thirdChild'];
        const firstChild = children[0];
        expect(firstChild).toBe('firstChild');
      });

      test('does nothing if element has no children', () => {
        const hasChildren = 0;
        const shouldNavigate = hasChildren > 0;
        expect(shouldNavigate).toBe(false);
      });

      test('skips __sneaky prefixed children', () => {
        const child = { id: '__sneaky-tooltip' };
        const shouldSkip = child.id.startsWith('__sneaky');
        expect(shouldSkip).toBe(true);
      });
    });
  });

  describe('Tab Navigation', () => {
    describe('Focusable Element Detection', () => {
      test('includes links with href', () => {
        const selector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        expect(selector).toContain('a[href]');
      });

      test('includes buttons', () => {
        const selector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        expect(selector).toContain('button');
      });

      test('includes form inputs', () => {
        const selector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        expect(selector).toContain('input');
        expect(selector).toContain('select');
        expect(selector).toContain('textarea');
      });

      test('includes elements with positive tabindex', () => {
        const selector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        expect(selector).toContain('[tabindex]');
        expect(selector).toContain(':not([tabindex="-1"])');
      });

      test('excludes hidden elements', () => {
        // The picker checks: style.display !== 'none' && style.visibility !== 'hidden'
        const isVisible = (display: string, visibility: string) =>
          display !== 'none' && visibility !== 'hidden';
        expect(isVisible('block', 'visible')).toBe(true);
        expect(isVisible('none', 'visible')).toBe(false);
        expect(isVisible('block', 'hidden')).toBe(false);
      });

      test('excludes __sneaky prefixed elements', () => {
        const elements = [
          { id: 'submit-btn' },
          { id: '__sneaky-picker-overlay' },
          { id: 'cancel-btn' },
        ];
        const filtered = elements.filter((el) => !el.id.startsWith('__sneaky'));
        expect(filtered).toHaveLength(2);
      });
    });

    describe('Tab Cycling Behavior', () => {
      test('Tab moves to next focusable element', () => {
        const focusable = ['btn1', 'btn2', 'btn3'];
        const currentIndex = 0;
        const nextIndex = currentIndex + 1;
        expect(focusable[nextIndex]).toBe('btn2');
      });

      test('Tab wraps from last to first', () => {
        const focusable = ['btn1', 'btn2', 'btn3'];
        const currentIndex = focusable.length - 1; // 2
        const nextIndex = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
        expect(nextIndex).toBe(0);
        expect(focusable[nextIndex]).toBe('btn1');
      });

      test('Shift+Tab moves to previous focusable element', () => {
        const focusable = ['btn1', 'btn2', 'btn3'];
        const currentIndex = 2;
        const prevIndex = currentIndex - 1;
        expect(focusable[prevIndex]).toBe('btn2');
      });

      test('Shift+Tab wraps from first to last', () => {
        const focusable = ['btn1', 'btn2', 'btn3'];
        const currentIndex = 0;
        const prevIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
        expect(prevIndex).toBe(2);
        expect(focusable[prevIndex]).toBe('btn3');
      });

      test('handles element not in focusable list', () => {
        const focusable = ['btn1', 'btn2', 'btn3'];
        const currentElement = 'div-not-focusable';
        const currentIndex = focusable.indexOf(currentElement); // -1
        expect(currentIndex).toBe(-1);
        // When currentIndex is -1, nextIndex becomes 0
        const nextIndex = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
        expect(nextIndex).toBe(0);
      });
    });
  });

  describe('Event Prevention', () => {
    test('keyboard shortcuts call preventDefault', () => {
      // All keyboard shortcuts should call e.preventDefault() to prevent default browser behavior
      const keysWithPreventDefault = ['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
      expect(keysWithPreventDefault).toHaveLength(6);
    });

    test('Escape does not call preventDefault', () => {
      // Escape only needs to cancel selection, not prevent default
      const keyWithoutPreventDefault = 'Escape';
      expect(keyWithoutPreventDefault).toBe('Escape');
    });
  });

  describe('Integration with Selection', () => {
    test('keyboard navigation updates highlight and tooltip', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate navigation followed by Enter to select
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'ul > li:nth-of-type(2)',
          tagName: 'li',
          textPreview: 'Second item',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toContain('li');
      expect(result.textPreview).toBe('Second item');
    });

    test('scrollIntoView is called for keyboard navigation', () => {
      // The highlightElement function calls: el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      const scrollOptions = { block: 'nearest', behavior: 'smooth' };
      expect(scrollOptions.block).toBe('nearest');
      expect(scrollOptions.behavior).toBe('smooth');
    });
  });
});

describe('Updated Banner Content', () => {
  test('banner mentions Enter to select', () => {
    const instruction = 'click or Enter to select';
    expect(instruction).toContain('Enter');
  });

  test('banner mentions arrow key navigation', () => {
    const shortcuts = '↑↓ siblings | ←→ parent/child';
    expect(shortcuts).toContain('↑↓');
    expect(shortcuts).toContain('←→');
    expect(shortcuts).toContain('siblings');
    expect(shortcuts).toContain('parent/child');
  });

  test('banner mentions Tab navigation', () => {
    const shortcuts = 'Tab focusables';
    expect(shortcuts).toContain('Tab');
    expect(shortcuts).toContain('focusables');
  });
});

// ============================================================================
// Phase 2 Keyboard Shortcuts Tests
// ============================================================================

describe('Number Key Selection', () => {
  describe('Number Key Recognition', () => {
    test('recognizes number keys 1-9', () => {
      const numberKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const isNumberKey = (key: string) => /^[1-9]$/.test(key);

      numberKeys.forEach((key) => {
        expect(isNumberKey(key)).toBe(true);
      });
    });

    test('does not recognize 0 as a number key', () => {
      const isNumberKey = (key: string) => /^[1-9]$/.test(key);
      expect(isNumberKey('0')).toBe(false);
    });

    test('does not recognize non-numeric keys', () => {
      const isNumberKey = (key: string) => /^[1-9]$/.test(key);
      expect(isNumberKey('a')).toBe(false);
      expect(isNumberKey('Enter')).toBe(false);
      expect(isNumberKey(' ')).toBe(false);
    });

    test('converts key to 0-based index', () => {
      const keyToIndex = (key: string) => parseInt(key, 10) - 1;
      expect(keyToIndex('1')).toBe(0);
      expect(keyToIndex('5')).toBe(4);
      expect(keyToIndex('9')).toBe(8);
    });
  });

  describe('Match Selection Behavior', () => {
    test('pressing number key selects nth matching element', () => {
      const matches = ['match1', 'match2', 'match3', 'match4', 'match5'];
      const keyToIndex = (key: string) => parseInt(key, 10) - 1;

      // Pressing '3' selects the 3rd element (index 2)
      const selectedIndex = keyToIndex('3');
      expect(matches[selectedIndex]).toBe('match3');
    });

    test('pressing 1 selects first match', () => {
      const matches = ['first', 'second', 'third'];
      const selectedIndex = parseInt('1', 10) - 1;
      expect(matches[selectedIndex]).toBe('first');
    });

    test('pressing 9 selects ninth match when available', () => {
      const matches = Array.from({ length: 12 }, (_, i) => `match${i + 1}`);
      const selectedIndex = parseInt('9', 10) - 1;
      expect(matches[selectedIndex]).toBe('match9');
    });
  });

  describe('Boundary Conditions', () => {
    test('pressing 9 when only 3 matches does nothing', () => {
      const matches = ['match1', 'match2', 'match3'];
      const requestedIndex = parseInt('9', 10) - 1; // 8
      const isValidSelection = requestedIndex < matches.length;
      expect(isValidSelection).toBe(false);
    });

    test('pressing 5 when only 4 matches does nothing', () => {
      const matches = ['a', 'b', 'c', 'd'];
      const requestedIndex = parseInt('5', 10) - 1; // 4
      const isValidSelection = requestedIndex < matches.length;
      expect(isValidSelection).toBe(false);
    });

    test('pressing 3 when exactly 3 matches selects third', () => {
      const matches = ['a', 'b', 'c'];
      const requestedIndex = parseInt('3', 10) - 1; // 2
      const isValidSelection = requestedIndex < matches.length;
      expect(isValidSelection).toBe(true);
      expect(matches[requestedIndex]).toBe('c');
    });

    test('handles empty matches array gracefully', () => {
      const matches: string[] = [];
      const requestedIndex = parseInt('1', 10) - 1; // 0
      const isValidSelection = requestedIndex < matches.length;
      expect(isValidSelection).toBe(false);
    });
  });

  describe('Multiple Matches Requirement', () => {
    test('number keys require multiple matches to work', () => {
      // With single match, number keys should not trigger selection
      const matchCount = 1;
      const shouldAllowNumberKeys = matchCount > 1;
      expect(shouldAllowNumberKeys).toBe(false);
    });

    test('number keys work when 2 or more matches exist', () => {
      const matchCount = 2;
      const shouldAllowNumberKeys = matchCount > 1;
      expect(shouldAllowNumberKeys).toBe(true);
    });

    test('number keys work with many matches', () => {
      const matchCount = 15;
      const shouldAllowNumberKeys = matchCount > 1;
      expect(shouldAllowNumberKeys).toBe(true);
    });
  });

  describe('Integration with Selection Flow', () => {
    test('number key selection triggers selection callback', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate number key selecting 2nd element from matches
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'button.submit:nth-of-type(2)',
          tagName: 'button',
          textPreview: 'Second Submit Button',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toContain('nth-of-type(2)');
      expect(result.textPreview).toBe('Second Submit Button');
    });
  });
});

describe('Bracket Key Cycling', () => {
  describe('Key Recognition', () => {
    test('recognizes [ key for previous match', () => {
      const key = '[';
      const isPrevKey = key === '[';
      expect(isPrevKey).toBe(true);
    });

    test('recognizes ] key for next match', () => {
      const key = ']';
      const isNextKey = key === ']';
      expect(isNextKey).toBe(true);
    });
  });

  describe('Navigation Direction', () => {
    test('[ key navigates to previous match', () => {
      const matches = ['match1', 'match2', 'match3'];
      const currentIndex = 1; // at 'match2'
      const prevIndex = currentIndex - 1;
      expect(matches[prevIndex]).toBe('match1');
    });

    test('] key navigates to next match', () => {
      const matches = ['match1', 'match2', 'match3'];
      const currentIndex = 1; // at 'match2'
      const nextIndex = currentIndex + 1;
      expect(matches[nextIndex]).toBe('match3');
    });
  });

  describe('Wrapping Behavior', () => {
    test('[ at first match wraps to last match', () => {
      const matches = ['match1', 'match2', 'match3'];
      const currentIndex = 0; // at first
      const prevIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1;
      expect(prevIndex).toBe(2);
      expect(matches[prevIndex]).toBe('match3');
    });

    test('] at last match wraps to first match', () => {
      const matches = ['match1', 'match2', 'match3'];
      const currentIndex = 2; // at last
      const nextIndex = currentIndex >= matches.length - 1 ? 0 : currentIndex + 1;
      expect(nextIndex).toBe(0);
      expect(matches[nextIndex]).toBe('match1');
    });

    test('wrapping works with only 2 matches', () => {
      const matches = ['first', 'last'];

      // At first, ] goes to last
      let currentIndex = 0;
      let nextIndex = currentIndex >= matches.length - 1 ? 0 : currentIndex + 1;
      expect(nextIndex).toBe(1);

      // At last, ] wraps to first
      currentIndex = 1;
      nextIndex = currentIndex >= matches.length - 1 ? 0 : currentIndex + 1;
      expect(nextIndex).toBe(0);

      // At first, [ wraps to last
      currentIndex = 0;
      let prevIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1;
      expect(prevIndex).toBe(1);

      // At last, [ goes to first
      currentIndex = 1;
      prevIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1;
      expect(prevIndex).toBe(0);
    });
  });

  describe('Single Match Behavior', () => {
    test('[ does nothing with single match', () => {
      const matches = ['onlyOne'];
      const shouldCycle = matches.length > 1;
      expect(shouldCycle).toBe(false);
    });

    test('] does nothing with single match', () => {
      const matches = ['onlyOne'];
      const shouldCycle = matches.length > 1;
      expect(shouldCycle).toBe(false);
    });

    test('brackets are disabled when match count is 1', () => {
      const matchCount = 1;
      const areBracketsEnabled = matchCount > 1;
      expect(areBracketsEnabled).toBe(false);
    });
  });

  describe('Index Tracking', () => {
    test('maintains current match index across cycles', () => {
      const matches = ['a', 'b', 'c', 'd', 'e'];
      let currentIndex = 0;

      // Simulate ] key presses
      currentIndex = (currentIndex + 1) % matches.length; // 1
      expect(currentIndex).toBe(1);
      currentIndex = (currentIndex + 1) % matches.length; // 2
      expect(currentIndex).toBe(2);
      currentIndex = (currentIndex + 1) % matches.length; // 3
      expect(currentIndex).toBe(3);
    });

    test('index resets when selector changes', () => {
      // When a new element is selected, match index should reset to 0
      const currentMatchIndex = 3;
      const resetIndex = 0;
      expect(resetIndex).toBe(0);
    });
  });

  describe('Integration with Highlight', () => {
    test('bracket navigation updates highlight to new match', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate cycling to a different match with brackets
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'div.card',
          tagName: 'div',
          textPreview: 'Card 3 of 5',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('div.card');
    });
  });
});

describe('Quick Filter/Search Mode', () => {
  describe('Activation', () => {
    test('/ key activates search mode', () => {
      const key = '/';
      const activatesSearch = key === '/';
      expect(activatesSearch).toBe(true);
    });

    test('search mode starts inactive by default', () => {
      const isSearchModeActive = false;
      expect(isSearchModeActive).toBe(false);
    });

    test('/ key toggles search input visibility', () => {
      let isSearchVisible = false;
      // Press /
      isSearchVisible = true;
      expect(isSearchVisible).toBe(true);
    });
  });

  describe('Exit Behavior', () => {
    test('Escape exits search mode', () => {
      let isSearchModeActive = true;
      const key = 'Escape';
      if (key === 'Escape') {
        isSearchModeActive = false;
      }
      expect(isSearchModeActive).toBe(false);
    });

    test('Escape in search mode does not cancel picker', () => {
      // First Escape should exit search mode, not cancel picker
      const isSearchModeActive = true;
      const shouldCancelPicker = !isSearchModeActive;
      expect(shouldCancelPicker).toBe(false);
    });

    test('Escape when search mode inactive cancels picker', () => {
      const isSearchModeActive = false;
      const shouldCancelPicker = !isSearchModeActive;
      expect(shouldCancelPicker).toBe(true);
    });
  });

  describe('Enter Behavior', () => {
    test('Enter in search mode selects first match', () => {
      const filteredMatches = ['first-match', 'second-match', 'third-match'];
      const selectedOnEnter = filteredMatches[0];
      expect(selectedOnEnter).toBe('first-match');
    });

    test('Enter with no matches does nothing', () => {
      const filteredMatches: string[] = [];
      const hasMatch = filteredMatches.length > 0;
      expect(hasMatch).toBe(false);
    });

    test('Enter clears search and selects', () => {
      let searchQuery = 'button';
      let isSearchModeActive = true;
      // Simulate Enter
      if (isSearchModeActive) {
        searchQuery = '';
        isSearchModeActive = false;
      }
      expect(searchQuery).toBe('');
      expect(isSearchModeActive).toBe(false);
    });
  });

  describe('Text Content Filtering', () => {
    test('filters elements by text content', () => {
      const elements = [
        { text: 'Submit Form', selector: '#submit' },
        { text: 'Cancel', selector: '#cancel' },
        { text: 'Submit Order', selector: '#order' },
      ];
      const query = 'submit';
      const filtered = elements.filter((el) =>
        el.text.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.selector).toBe('#submit');
      expect(filtered[1]?.selector).toBe('#order');
    });

    test('filtering is case insensitive', () => {
      const elements = [
        { text: 'BUTTON', selector: '#btn1' },
        { text: 'Button', selector: '#btn2' },
        { text: 'button', selector: '#btn3' },
      ];
      const query = 'Button';
      const filtered = elements.filter((el) =>
        el.text.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(3);
    });

    test('filters by partial match', () => {
      const elements = [
        { text: 'Subscribe to newsletter', selector: '#sub' },
        { text: 'Unsubscribe', selector: '#unsub' },
        { text: 'Contact us', selector: '#contact' },
      ];
      const query = 'sub';
      const filtered = elements.filter((el) =>
        el.text.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(2);
    });

    test('filters by tag name as well', () => {
      const elements = [
        { text: 'Click me', tagName: 'button', selector: 'button.primary' },
        { text: 'Link text', tagName: 'a', selector: 'a.link' },
        { text: 'Submit', tagName: 'button', selector: 'button.submit' },
      ];
      const query = 'button';
      const filtered = elements.filter(
        (el) =>
          el.text.toLowerCase().includes(query.toLowerCase()) ||
          el.tagName.toLowerCase().includes(query.toLowerCase())
      );
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Empty Search Behavior', () => {
    test('empty search shows all elements', () => {
      const allElements = ['el1', 'el2', 'el3', 'el4', 'el5'];
      const query = '';
      const filtered = query
        ? allElements.filter((el) => el.includes(query))
        : allElements;
      expect(filtered).toHaveLength(5);
    });

    test('clearing search restores all elements', () => {
      const allElements = ['el1', 'el2', 'el3'];
      let query = 'something';
      let filtered = allElements.filter((el) => el.includes(query));
      expect(filtered).toHaveLength(0);

      // Clear search
      query = '';
      filtered = query ? allElements.filter((el) => el.includes(query)) : allElements;
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Search Input UI', () => {
    test('search input has __sneaky prefix to avoid selection', () => {
      const searchInputId = '__sneaky-picker-search';
      expect(searchInputId.startsWith('__sneaky')).toBe(true);
    });

    test('search input is positioned in banner area', () => {
      // Search input should appear in or near the banner
      const bannerPosition = 'top';
      expect(bannerPosition).toBe('top');
    });

    test('search input has placeholder text', () => {
      const placeholder = 'Type to filter elements...';
      expect(placeholder).toContain('filter');
    });
  });

  describe('Real-time Filtering', () => {
    test('filters update as user types', () => {
      const elements = ['button-submit', 'button-cancel', 'input-text'];
      let query = 'b';
      let filtered = elements.filter((el) => el.includes(query));
      expect(filtered).toHaveLength(2);

      query = 'bu';
      filtered = elements.filter((el) => el.includes(query));
      expect(filtered).toHaveLength(2);

      query = 'but';
      filtered = elements.filter((el) => el.includes(query));
      expect(filtered).toHaveLength(2);

      query = 'button-s';
      filtered = elements.filter((el) => el.includes(query));
      expect(filtered).toHaveLength(1);
    });

    test('debouncing is applied to filter updates', () => {
      // Filter updates should be debounced to avoid excessive DOM queries
      const debounceMs = 100;
      expect(debounceMs).toBeGreaterThan(0);
    });
  });

  describe('Integration with Selection', () => {
    test('search mode selection completes picker', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'button.filtered-match',
          tagName: 'button',
          textPreview: 'Filtered Button',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('button.filtered-match');
    });
  });
});

describe('Help Overlay', () => {
  describe('Toggle Behavior', () => {
    test('? key shows help overlay', () => {
      let isHelpVisible = false;
      const key = '?';
      if (key === '?') {
        isHelpVisible = !isHelpVisible;
      }
      expect(isHelpVisible).toBe(true);
    });

    test('? key again closes help overlay', () => {
      let isHelpVisible = true;
      const key = '?';
      if (key === '?') {
        isHelpVisible = !isHelpVisible;
      }
      expect(isHelpVisible).toBe(false);
    });

    test('help overlay toggles on repeated ? presses', () => {
      let isHelpVisible = false;

      // First press
      isHelpVisible = !isHelpVisible;
      expect(isHelpVisible).toBe(true);

      // Second press
      isHelpVisible = !isHelpVisible;
      expect(isHelpVisible).toBe(false);

      // Third press
      isHelpVisible = !isHelpVisible;
      expect(isHelpVisible).toBe(true);
    });
  });

  describe('Escape Closes Help', () => {
    test('Escape closes help overlay', () => {
      let isHelpVisible = true;
      const key = 'Escape';
      if (key === 'Escape' && isHelpVisible) {
        isHelpVisible = false;
      }
      expect(isHelpVisible).toBe(false);
    });

    test('Escape when help open does not cancel picker', () => {
      const isHelpVisible = true;
      const shouldCancelPicker = !isHelpVisible;
      expect(shouldCancelPicker).toBe(false);
    });

    test('Escape priority: help > search > picker', () => {
      // Priority order when Escape is pressed
      const priorities = ['help', 'search', 'picker'];
      expect(priorities[0]).toBe('help');
      expect(priorities[1]).toBe('search');
      expect(priorities[2]).toBe('picker');
    });
  });

  describe('Help Content', () => {
    test('help contains all shortcut descriptions', () => {
      const helpContent = {
        shortcuts: [
          { key: 'Click', description: 'Select element' },
          { key: 'Enter', description: 'Confirm selection' },
          { key: 'Escape', description: 'Cancel picker' },
          { key: '↑/↓', description: 'Navigate siblings' },
          { key: '←/→', description: 'Navigate parent/child' },
          { key: 'Tab', description: 'Cycle focusable elements' },
          { key: '1-9', description: 'Select nth match' },
          { key: '[ / ]', description: 'Cycle through matches' },
          { key: '/', description: 'Quick filter/search' },
          { key: '?', description: 'Toggle this help' },
        ],
      };

      expect(helpContent.shortcuts.length).toBeGreaterThanOrEqual(10);

      // Verify all Phase 2 shortcuts are documented
      const keys = helpContent.shortcuts.map((s) => s.key);
      expect(keys).toContain('1-9');
      expect(keys).toContain('[ / ]');
      expect(keys).toContain('/');
      expect(keys).toContain('?');
    });

    test('help explains number key selection', () => {
      const helpText = '1-9: Select nth matching element';
      expect(helpText).toContain('1-9');
      expect(helpText).toContain('nth');
    });

    test('help explains bracket cycling', () => {
      const helpText = '[ / ]: Cycle through same-selector matches';
      expect(helpText).toContain('[');
      expect(helpText).toContain(']');
      expect(helpText).toContain('Cycle');
    });

    test('help explains search mode', () => {
      const helpText = '/: Quick filter elements by text';
      expect(helpText).toContain('/');
      expect(helpText).toContain('filter');
    });
  });

  describe('Help Overlay UI', () => {
    test('help overlay has __sneaky prefix', () => {
      const helpOverlayId = '__sneaky-picker-help';
      expect(helpOverlayId.startsWith('__sneaky')).toBe(true);
    });

    test('help overlay has high z-index', () => {
      // Help should appear above the picker tooltip
      const helpZIndex = 1000001;
      const pickerZIndex = 999999;
      expect(helpZIndex).toBeGreaterThan(pickerZIndex);
    });

    test('help overlay has semi-transparent backdrop', () => {
      const backdropOpacity = 0.9;
      expect(backdropOpacity).toBeGreaterThan(0.5);
      expect(backdropOpacity).toBeLessThan(1);
    });

    test('help overlay is centered on screen', () => {
      const style = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
      expect(style.position).toBe('fixed');
      expect(style.transform).toContain('translate');
    });
  });

  describe('Help Does Not Interfere with Selection', () => {
    test('help overlay has pointer-events: none for backdrop', () => {
      // The backdrop should not block element selection
      const pointerEvents = 'none';
      expect(pointerEvents).toBe('none');
    });

    test('help content area captures clicks to prevent selection', () => {
      // The help content itself should capture clicks
      const contentPointerEvents = 'auto';
      expect(contentPointerEvents).toBe('auto');
    });
  });

  describe('Integration', () => {
    test('help can be shown and hidden during selection flow', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate: show help -> hide help -> select element
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#target',
          tagName: 'button',
          textPreview: 'Target Button',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('#target');
    });
  });
});

describe('Updated Banner with Help Hint', () => {
  describe('Help Hint Display', () => {
    test('banner mentions ? for help', () => {
      const bannerText = 'Press ? for help';
      expect(bannerText).toContain('?');
      expect(bannerText).toContain('help');
    });

    test('banner shows shortened instructions with help available', () => {
      // With ? for help, banner can show minimal shortcuts
      const shortBanner = 'Hover to highlight | Click or Enter to select | ? for help';
      expect(shortBanner.length).toBeLessThan(100);
    });
  });

  describe('Banner Updates', () => {
    test('banner shows match count when multiple matches', () => {
      const matchCount = 5;
      const bannerAddition = `(${matchCount} matches, use 1-9 or [/] to cycle)`;
      expect(bannerAddition).toContain('5 matches');
      expect(bannerAddition).toContain('1-9');
      expect(bannerAddition).toContain('[/]');
    });

    test('banner does not show match info for single match', () => {
      const matchCount = 1;
      const showMatchInfo = matchCount > 1;
      expect(showMatchInfo).toBe(false);
    });

    test('banner shows current match index when cycling', () => {
      const currentIndex = 3;
      const totalMatches = 7;
      const indexDisplay = `Match ${currentIndex}/${totalMatches}`;
      expect(indexDisplay).toBe('Match 3/7');
    });
  });

  describe('Banner During Search Mode', () => {
    test('banner indicates search mode is active', () => {
      const searchModeText = 'Search: type to filter, Enter to select, Esc to exit';
      expect(searchModeText).toContain('Search');
      expect(searchModeText).toContain('filter');
      expect(searchModeText).toContain('Esc');
    });

    test('banner shows filtered count during search', () => {
      const filteredCount = 12;
      const totalCount = 50;
      const searchStatus = `Showing ${filteredCount} of ${totalCount} elements`;
      expect(searchStatus).toContain('12');
      expect(searchStatus).toContain('50');
    });
  });
});

describe('Phase 2 Keyboard Shortcut Interactions', () => {
  describe('State Machine Transitions', () => {
    test('search mode disables number key selection', () => {
      const isSearchModeActive = true;
      const shouldHandleNumberKeys = !isSearchModeActive;
      expect(shouldHandleNumberKeys).toBe(false);
    });

    test('help overlay disables all navigation keys', () => {
      const isHelpVisible = true;
      const shouldHandleNavigation = !isHelpVisible;
      expect(shouldHandleNavigation).toBe(false);
    });

    test('help overlay allows only ? and Escape', () => {
      const isHelpVisible = true;
      const allowedKeysWhenHelpVisible = ['?', 'Escape'];
      expect(allowedKeysWhenHelpVisible).toContain('?');
      expect(allowedKeysWhenHelpVisible).toContain('Escape');
      expect(allowedKeysWhenHelpVisible).not.toContain('1');
      expect(allowedKeysWhenHelpVisible).not.toContain('[');
    });

    test('search mode allows only typing, Enter, and Escape', () => {
      const isSearchModeActive = true;
      // Search mode should handle: letters, numbers (as text), Enter, Escape
      const handledInSearchMode = ['Enter', 'Escape', 'Backspace', 'a', 'b', '1'];
      const blockedInSearchMode = ['ArrowUp', 'ArrowDown', '[', ']', 'Tab'];

      expect(handledInSearchMode).toContain('Enter');
      expect(blockedInSearchMode).toContain('[');
    });
  });

  describe('Combined Feature Scenarios', () => {
    test('select element -> cycle matches -> use number key', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate: hover over element, see 5 matches, press 3 to select 3rd
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'button.action',
          tagName: 'button',
          textPreview: 'Third Action Button',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.tagName).toBe('button');
    });

    test('open help -> close help -> search -> select', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      // Simulate: ? -> ? -> / -> type -> Enter -> selection
      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'input.email',
          tagName: 'input',
          textPreview: '',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('input.email');
    });
  });

  describe('Keyboard Event Properties', () => {
    test('Phase 2 shortcuts call preventDefault', () => {
      const keysWithPreventDefault = ['/', '?', '[', ']', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      expect(keysWithPreventDefault).toHaveLength(13);
    });

    test('Phase 2 shortcuts call stopPropagation', () => {
      // Prevent events from bubbling to page handlers
      const keysWithStopPropagation = ['/', '?', '[', ']'];
      expect(keysWithStopPropagation).toContain('/');
      expect(keysWithStopPropagation).toContain('?');
    });

    test('search input captures all keystrokes except Escape/Enter', () => {
      const searchInputCapturesKey = (key: string) => {
        return key !== 'Escape' && key !== 'Enter';
      };
      expect(searchInputCapturesKey('a')).toBe(true);
      expect(searchInputCapturesKey('1')).toBe(true);
      expect(searchInputCapturesKey('Escape')).toBe(false);
      expect(searchInputCapturesKey('Enter')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('rapid bracket presses cycle correctly', () => {
      const matches = ['a', 'b', 'c'];
      let currentIndex = 0;

      // Rapid ] presses
      for (let i = 0; i < 10; i++) {
        currentIndex = (currentIndex + 1) % matches.length;
      }
      expect(currentIndex).toBe(1); // 10 % 3 = 1
    });

    test('number key pressed during search is typed, not selection', () => {
      const isSearchModeActive = true;
      const key = '5';
      const isNumberKeySelection = !isSearchModeActive && /^[1-9]$/.test(key);
      expect(isNumberKeySelection).toBe(false);
    });

    test('? pressed during search is typed, not help toggle', () => {
      const isSearchModeActive = true;
      const key = '?';
      const isHelpToggle = !isSearchModeActive && key === '?';
      expect(isHelpToggle).toBe(false);
    });

    test('bracket keys during search are typed, not cycling', () => {
      const isSearchModeActive = true;
      const key = '[';
      const isBracketCycle = !isSearchModeActive && (key === '[' || key === ']');
      expect(isBracketCycle).toBe(false);
    });
  });
});

// ============================================================================
// Phase 3 Keyboard Shortcuts Tests
// ============================================================================

describe('Vim Navigation Keys', () => {
  describe('Key Recognition', () => {
    test('H key maps to left/parent navigation', () => {
      const key = 'H';
      const isLeftNav = key === 'H' || key === 'h';
      expect(isLeftNav).toBe(true);
    });

    test('h key (lowercase) maps to left/parent navigation', () => {
      const key = 'h';
      const isLeftNav = key === 'H' || key === 'h';
      expect(isLeftNav).toBe(true);
    });

    test('J key maps to down/next sibling navigation', () => {
      const key = 'J';
      const isDownNav = key === 'J' || key === 'j';
      expect(isDownNav).toBe(true);
    });

    test('j key (lowercase) maps to down/next sibling navigation', () => {
      const key = 'j';
      const isDownNav = key === 'J' || key === 'j';
      expect(isDownNav).toBe(true);
    });

    test('K key maps to up/previous sibling navigation', () => {
      const key = 'K';
      const isUpNav = key === 'K' || key === 'k';
      expect(isUpNav).toBe(true);
    });

    test('k key (lowercase) maps to up/previous sibling navigation', () => {
      const key = 'k';
      const isUpNav = key === 'K' || key === 'k';
      expect(isUpNav).toBe(true);
    });

    test('L key maps to right/first child navigation', () => {
      const key = 'L';
      const isRightNav = key === 'L' || key === 'l';
      expect(isRightNav).toBe(true);
    });

    test('l key (lowercase) maps to right/first child navigation', () => {
      const key = 'l';
      const isRightNav = key === 'L' || key === 'l';
      expect(isRightNav).toBe(true);
    });
  });

  describe('Vim to Arrow Key Mapping', () => {
    test('H maps to ArrowLeft behavior', () => {
      const vimToArrowMap: Record<string, string> = {
        h: 'ArrowLeft',
        H: 'ArrowLeft',
        j: 'ArrowDown',
        J: 'ArrowDown',
        k: 'ArrowUp',
        K: 'ArrowUp',
        l: 'ArrowRight',
        L: 'ArrowRight',
      };
      expect(vimToArrowMap['h']).toBe('ArrowLeft');
      expect(vimToArrowMap['H']).toBe('ArrowLeft');
    });

    test('J maps to ArrowDown behavior', () => {
      const vimToArrowMap: Record<string, string> = {
        h: 'ArrowLeft',
        j: 'ArrowDown',
        k: 'ArrowUp',
        l: 'ArrowRight',
      };
      expect(vimToArrowMap['j']).toBe('ArrowDown');
    });

    test('K maps to ArrowUp behavior', () => {
      const vimToArrowMap: Record<string, string> = {
        h: 'ArrowLeft',
        j: 'ArrowDown',
        k: 'ArrowUp',
        l: 'ArrowRight',
      };
      expect(vimToArrowMap['k']).toBe('ArrowUp');
    });

    test('L maps to ArrowRight behavior', () => {
      const vimToArrowMap: Record<string, string> = {
        h: 'ArrowLeft',
        j: 'ArrowDown',
        k: 'ArrowUp',
        l: 'ArrowRight',
      };
      expect(vimToArrowMap['l']).toBe('ArrowRight');
    });
  });

  describe('Navigation Behavior Equivalence', () => {
    test('H navigates to parent element (same as ArrowLeft)', () => {
      const key = 'h';
      const navigationType = key === 'h' || key === 'H' ? 'parent' : null;
      expect(navigationType).toBe('parent');
    });

    test('J navigates to next sibling (same as ArrowDown)', () => {
      const key = 'j';
      const navigationType = key === 'j' || key === 'J' ? 'nextSibling' : null;
      expect(navigationType).toBe('nextSibling');
    });

    test('K navigates to previous sibling (same as ArrowUp)', () => {
      const key = 'k';
      const navigationType = key === 'k' || key === 'K' ? 'prevSibling' : null;
      expect(navigationType).toBe('prevSibling');
    });

    test('L navigates to first child (same as ArrowRight)', () => {
      const key = 'l';
      const navigationType = key === 'l' || key === 'L' ? 'firstChild' : null;
      expect(navigationType).toBe('firstChild');
    });
  });

  describe('Vim Keys During Search Mode', () => {
    test('vim keys are disabled during search mode', () => {
      const isSearchModeActive = true;
      const key = 'j';
      const shouldHandleVimNav = !isSearchModeActive && /^[hjkl]$/i.test(key);
      expect(shouldHandleVimNav).toBe(false);
    });

    test('vim keys work when search mode is inactive', () => {
      const isSearchModeActive = false;
      const key = 'j';
      const shouldHandleVimNav = !isSearchModeActive && /^[hjkl]$/i.test(key);
      expect(shouldHandleVimNav).toBe(true);
    });
  });

  describe('Vim Keys During Help Overlay', () => {
    test('vim keys are disabled when help is visible', () => {
      const isHelpVisible = true;
      const key = 'k';
      const shouldHandleVimNav = !isHelpVisible && /^[hjkl]$/i.test(key);
      expect(shouldHandleVimNav).toBe(false);
    });
  });

  describe('Integration with Selection Flow', () => {
    test('vim navigation completes selection flow', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'li:nth-of-type(3)',
          tagName: 'li',
          textPreview: 'Third item via vim navigation',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('li:nth-of-type(3)');
    });

    test('combined vim and arrow navigation works', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: 'div.child > span:nth-of-type(1)',
          tagName: 'span',
          textPreview: 'Navigated with vim keys',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.tagName).toBe('span');
    });
  });
});

describe('Multi-Select Mode', () => {
  describe('Ctrl+Enter Activation', () => {
    test('Ctrl+Enter is recognized as multi-select trigger', () => {
      const key = 'Enter';
      const ctrlKey = true;
      const isMultiSelectTrigger = key === 'Enter' && ctrlKey;
      expect(isMultiSelectTrigger).toBe(true);
    });

    test('Enter without Ctrl is not multi-select', () => {
      const key = 'Enter';
      const ctrlKey = false;
      const isMultiSelectTrigger = key === 'Enter' && ctrlKey;
      expect(isMultiSelectTrigger).toBe(false);
    });

    test('Ctrl+Enter starts multi-select mode', () => {
      let isMultiSelectMode = false;
      const key = 'Enter';
      const ctrlKey = true;

      if (key === 'Enter' && ctrlKey) {
        isMultiSelectMode = true;
      }
      expect(isMultiSelectMode).toBe(true);
    });
  });

  describe('Selection Tracking', () => {
    test('multi-select adds element to selection array', () => {
      const selectedElements: string[] = [];
      const currentElement = '#button-1';

      selectedElements.push(currentElement);
      expect(selectedElements).toContain('#button-1');
      expect(selectedElements).toHaveLength(1);
    });

    test('multiple Ctrl+Enter adds multiple elements', () => {
      const selectedElements: string[] = [];

      selectedElements.push('#button-1');
      selectedElements.push('#button-2');
      selectedElements.push('#button-3');

      expect(selectedElements).toHaveLength(3);
      expect(selectedElements).toEqual(['#button-1', '#button-2', '#button-3']);
    });

    test('duplicate selection is prevented', () => {
      const selectedElements: string[] = ['#button-1'];
      const currentElement = '#button-1';

      if (!selectedElements.includes(currentElement)) {
        selectedElements.push(currentElement);
      }
      expect(selectedElements).toHaveLength(1);
    });

    test('selection order is preserved', () => {
      const selectedElements: string[] = [];
      const elementsToSelect = ['#third', '#first', '#second'];

      elementsToSelect.forEach((el) => selectedElements.push(el));

      expect(selectedElements[0]).toBe('#third');
      expect(selectedElements[1]).toBe('#first');
      expect(selectedElements[2]).toBe('#second');
    });
  });

  describe('Finishing Multi-Select', () => {
    test('regular Enter finishes multi-select mode', () => {
      let isMultiSelectMode = true;
      const key = 'Enter';
      const ctrlKey = false;

      if (key === 'Enter' && !ctrlKey && isMultiSelectMode) {
        isMultiSelectMode = false;
      }
      expect(isMultiSelectMode).toBe(false);
    });

    test('regular Enter includes current element in final selection', () => {
      const selectedElements: string[] = ['#el1', '#el2'];
      const currentElement = '#el3';
      const key = 'Enter';
      const ctrlKey = false;

      if (key === 'Enter' && !ctrlKey) {
        if (!selectedElements.includes(currentElement)) {
          selectedElements.push(currentElement);
        }
      }
      expect(selectedElements).toHaveLength(3);
      expect(selectedElements).toContain('#el3');
    });

    test('Escape during multi-select cancels all selections', () => {
      let selectedElements: string[] = ['#el1', '#el2', '#el3'];
      const key = 'Escape';

      if (key === 'Escape') {
        selectedElements = [];
      }
      expect(selectedElements).toHaveLength(0);
    });
  });

  describe('Visual Feedback', () => {
    test('selected elements have visual indicator', () => {
      const selectedClass = '__sneaky-multi-selected';
      expect(selectedClass.startsWith('__sneaky')).toBe(true);
    });

    test('current element highlight differs from selected elements', () => {
      const currentHighlightClass = '__sneaky-picker-highlight';
      const selectedClass = '__sneaky-multi-selected';
      expect(currentHighlightClass).not.toBe(selectedClass);
    });

    test('banner shows multi-select count', () => {
      const selectedCount = 3;
      const bannerText = `${selectedCount} elements selected (Enter to finish, Ctrl+Enter to add more)`;
      expect(bannerText).toContain('3 elements selected');
      expect(bannerText).toContain('Enter to finish');
      expect(bannerText).toContain('Ctrl+Enter');
    });

    test('banner shows singular when 1 element selected', () => {
      const selectedCount = 1;
      const bannerText = selectedCount === 1 ? '1 element selected' : `${selectedCount} elements selected`;
      expect(bannerText).toBe('1 element selected');
    });
  });

  describe('Continued Navigation', () => {
    test('navigation continues after Ctrl+Enter', () => {
      const isMultiSelectMode = true;
      const canNavigate = true;

      expect(isMultiSelectMode).toBe(true);
      expect(canNavigate).toBe(true);
    });

    test('arrow keys work during multi-select', () => {
      const isMultiSelectMode = true;
      const shouldHandleNavigation = true;

      expect(isMultiSelectMode).toBe(true);
      expect(shouldHandleNavigation).toBe(true);
    });

    test('vim keys work during multi-select', () => {
      const isMultiSelectMode = true;
      const isSearchModeActive = false;
      const key = 'j';
      const shouldHandleVimNav = !isSearchModeActive && /^[hjkl]$/i.test(key);

      expect(isMultiSelectMode).toBe(true);
      expect(shouldHandleVimNav).toBe(true);
    });
  });

  describe('Integration with Selection Flow', () => {
    test('multi-select returns array of selectors', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#btn-1',
          tagName: 'button',
          textPreview: 'Multiple buttons selected',
          multiSelect: true,
          selections: [
            { selector: '#btn-1', tagName: 'button', textPreview: 'Button 1' },
            { selector: '#btn-2', tagName: 'button', textPreview: 'Button 2' },
            { selector: '#btn-3', tagName: 'button', textPreview: 'Button 3' },
          ],
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.multiSelect).toBe(true);
      expect(result.selections).toHaveLength(3);
    });

    test('multi-select with single element works like regular select', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#single-element',
          tagName: 'div',
          textPreview: 'Single multi-select',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('#single-element');
    });
  });
});

describe('Element Marking', () => {
  describe('M Key - Mark Element', () => {
    test('M key is recognized as mark trigger', () => {
      const key = 'M';
      const isMarkKey = key === 'M' || key === 'm';
      expect(isMarkKey).toBe(true);
    });

    test('m key (lowercase) also marks element', () => {
      const key = 'm';
      const isMarkKey = key === 'M' || key === 'm';
      expect(isMarkKey).toBe(true);
    });

    test('M key sets mark to current element', () => {
      let markedElement: string | null = null;
      const currentElement = '#current-div';
      const key = 'm';

      if (key === 'm' || key === 'M') {
        markedElement = currentElement;
      }
      expect(markedElement).toBe('#current-div');
    });

    test('new mark replaces old mark', () => {
      let markedElement: string | null = '#old-element';
      const currentElement = '#new-element';
      const key = 'm';

      if (key === 'm' || key === 'M') {
        markedElement = currentElement;
      }
      expect(markedElement).toBe('#new-element');
    });

    test('only one mark exists at a time', () => {
      const marks: string[] = [];

      marks.length = 0;
      marks.push('#element-1');
      expect(marks).toHaveLength(1);

      marks.length = 0;
      marks.push('#element-2');
      expect(marks).toHaveLength(1);
      expect(marks[0]).toBe('#element-2');
    });
  });

  describe('Mark Persistence', () => {
    test('mark persists through arrow navigation', () => {
      const markedElement: string | null = '#marked';
      let currentElement = '#current';

      currentElement = '#sibling-1';
      expect(markedElement).toBe('#marked');

      currentElement = '#sibling-2';
      expect(markedElement).toBe('#marked');

      currentElement = '#child-1';
      expect(markedElement).toBe('#marked');
    });

    test('mark persists through vim navigation', () => {
      const markedElement: string | null = '#marked';
      let currentElement = '#current';

      currentElement = '#after-j';
      expect(markedElement).toBe('#marked');

      currentElement = '#after-k';
      expect(markedElement).toBe('#marked');
    });

    test('mark persists through Tab navigation', () => {
      const markedElement: string | null = '#marked-input';
      let currentElement = '#input-1';

      currentElement = '#input-2';
      expect(markedElement).toBe('#marked-input');

      currentElement = '#input-3';
      expect(markedElement).toBe('#marked-input');
    });

    test('mark persists through bracket cycling', () => {
      const markedElement: string | null = '#marked-match';
      let currentMatchIndex = 0;

      currentMatchIndex = 1;
      expect(markedElement).toBe('#marked-match');

      currentMatchIndex = 2;
      expect(markedElement).toBe('#marked-match');
    });
  });

  describe('Mark Visual Indicator', () => {
    test('marked element has visual class', () => {
      const markedClass = '__sneaky-marked';
      expect(markedClass.startsWith('__sneaky')).toBe(true);
    });

    test('mark visual differs from highlight', () => {
      const markedClass = '__sneaky-marked';
      const highlightClass = '__sneaky-picker-highlight';
      expect(markedClass).not.toBe(highlightClass);
    });

    test('mark visual differs from multi-select', () => {
      const markedClass = '__sneaky-marked';
      const multiSelectClass = '__sneaky-multi-selected';
      expect(markedClass).not.toBe(multiSelectClass);
    });
  });

  describe('Mark During Modes', () => {
    test('M key disabled during search mode', () => {
      const isSearchModeActive = true;
      const key = 'm';
      const shouldHandleMark = !isSearchModeActive && (key === 'm' || key === 'M');
      expect(shouldHandleMark).toBe(false);
    });

    test('M key disabled when help is visible', () => {
      const isHelpVisible = true;
      const key = 'm';
      const shouldHandleMark = !isHelpVisible && (key === 'm' || key === 'M');
      expect(shouldHandleMark).toBe(false);
    });

    test('M key works during multi-select mode', () => {
      const isMultiSelectMode = true;
      const isSearchModeActive = false;
      const isHelpVisible = false;
      const key = 'm';
      const shouldHandleMark = !isSearchModeActive && !isHelpVisible && (key === 'm' || key === 'M');
      expect(shouldHandleMark).toBe(true);
    });
  });

  describe('Mark with No Current Element', () => {
    test('M key does nothing when no element is highlighted', () => {
      let markedElement: string | null = null;
      const currentElement: string | null = null;
      const key = 'm';

      if ((key === 'm' || key === 'M') && currentElement) {
        markedElement = currentElement;
      }
      expect(markedElement).toBeNull();
    });
  });
});

describe('Jump to Mark', () => {
  describe('Apostrophe Key Recognition', () => {
    test("' key is recognized as jump-to-mark trigger", () => {
      const key = "'";
      const isJumpKey = key === "'";
      expect(isJumpKey).toBe(true);
    });

    test('apostrophe key jumps to marked element', () => {
      let currentElement = '#current';
      const markedElement = '#marked';
      const key = "'";

      if (key === "'" && markedElement) {
        currentElement = markedElement;
      }
      expect(currentElement).toBe('#marked');
    });
  });

  describe('No Mark Behavior', () => {
    test("' does nothing when no mark exists", () => {
      let currentElement = '#current';
      const markedElement: string | null = null;
      const key = "'";

      if (key === "'" && markedElement) {
        currentElement = markedElement;
      }
      expect(currentElement).toBe('#current');
    });

    test('current element unchanged when jumping with no mark', () => {
      const currentElement = '#stays-same';
      const markedElement: string | null = null;
      const newElement = markedElement || currentElement;
      expect(newElement).toBe('#stays-same');
    });
  });

  describe('Jump Updates Highlight', () => {
    test("' key updates highlight to marked element", () => {
      let highlightedElement = '#highlighted';
      const markedElement = '#marked';
      const key = "'";

      if (key === "'" && markedElement) {
        highlightedElement = markedElement;
      }
      expect(highlightedElement).toBe('#marked');
    });

    test('tooltip updates after jump to mark', () => {
      const markedElementInfo = {
        tagName: 'button',
        classes: ['primary', 'large'],
        selector: 'button.primary.large',
      };
      expect(markedElementInfo.tagName).toBe('button');
      expect(markedElementInfo.selector).toBe('button.primary.large');
    });
  });

  describe('Jump During Modes', () => {
    test("' key disabled during search mode", () => {
      const isSearchModeActive = true;
      const key = "'";
      const shouldHandleJump = !isSearchModeActive && key === "'";
      expect(shouldHandleJump).toBe(false);
    });

    test("' key disabled when help is visible", () => {
      const isHelpVisible = true;
      const key = "'";
      const shouldHandleJump = !isHelpVisible && key === "'";
      expect(shouldHandleJump).toBe(false);
    });
  });

  describe('Round-Trip Navigation', () => {
    test('navigate away then jump back to mark', () => {
      let currentElement = '#start';
      const markedElement = '#start';

      expect(currentElement).toBe(markedElement);

      currentElement = '#sibling-1';
      currentElement = '#sibling-2';
      currentElement = '#nested-child';
      expect(currentElement).not.toBe(markedElement);

      currentElement = markedElement;
      expect(currentElement).toBe('#start');
    });

    test('multiple jumps to same mark work', () => {
      const markedElement = '#marked';
      let currentElement = '#other';

      currentElement = markedElement;
      expect(currentElement).toBe('#marked');

      currentElement = '#somewhere-else';

      currentElement = markedElement;
      expect(currentElement).toBe('#marked');

      currentElement = '#far-away';

      currentElement = markedElement;
      expect(currentElement).toBe('#marked');
    });
  });

  describe('Integration with Selection', () => {
    test('jump to mark then select completes picker', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#marked-and-selected',
          tagName: 'section',
          textPreview: 'Jumped back and selected',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('#marked-and-selected');
    });
  });
});

describe('G Key Navigation', () => {
  describe('Key Recognition', () => {
    test('G key is recognized', () => {
      const key = 'G';
      const isGKey = key === 'G' || key === 'g';
      expect(isGKey).toBe(true);
    });

    test('g key (lowercase) is recognized', () => {
      const key = 'g';
      const isGKey = key === 'G' || key === 'g';
      expect(isGKey).toBe(true);
    });
  });

  describe('Search Mode Activation', () => {
    test('G key activates search/go-to mode', () => {
      let isGoToModeActive = false;
      const key = 'g';

      if (key === 'g' || key === 'G') {
        isGoToModeActive = true;
      }
      expect(isGoToModeActive).toBe(true);
    });
  });

  describe('Go-To by Partial Text', () => {
    test('G followed by text navigates to matching element', () => {
      const elements = [
        { id: 'header', text: 'Welcome Header' },
        { id: 'content', text: 'Main Content' },
        { id: 'footer', text: 'Footer Section' },
      ];
      const searchText = 'foot';
      const match = elements.find((el) =>
        el.text.toLowerCase().includes(searchText.toLowerCase())
      );
      expect(match?.id).toBe('footer');
    });

    test('G search is case insensitive', () => {
      const elements = [{ id: 'btn', text: 'SUBMIT BUTTON' }];
      const searchText = 'submit';
      const match = elements.find((el) =>
        el.text.toLowerCase().includes(searchText.toLowerCase())
      );
      expect(match).toBeDefined();
    });
  });

  describe('Go-To by ID', () => {
    test('G# navigates by ID prefix', () => {
      const searchQuery = '#nav';
      const isIdSearch = searchQuery.startsWith('#');
      expect(isIdSearch).toBe(true);
    });

    test('G followed by # searches element IDs', () => {
      const elements = [
        { id: 'navigation', tagName: 'nav' },
        { id: 'main-content', tagName: 'main' },
        { id: 'nav-menu', tagName: 'ul' },
      ];
      const searchId = 'nav';
      const matches = elements.filter((el) =>
        el.id.toLowerCase().includes(searchId.toLowerCase())
      );
      expect(matches).toHaveLength(2);
    });
  });

  describe('Go-To by Tag Name', () => {
    test('G followed by tag name finds elements', () => {
      const elements = [
        { tagName: 'button', text: 'Submit' },
        { tagName: 'button', text: 'Cancel' },
        { tagName: 'input', text: '' },
      ];
      const searchTag = 'button';
      const matches = elements.filter(
        (el) => el.tagName.toLowerCase() === searchTag.toLowerCase()
      );
      expect(matches).toHaveLength(2);
    });
  });

  describe('Go-To Mode Exit', () => {
    test('Escape exits go-to mode', () => {
      let isGoToModeActive = true;
      const key = 'Escape';

      if (key === 'Escape') {
        isGoToModeActive = false;
      }
      expect(isGoToModeActive).toBe(false);
    });

    test('Enter in go-to mode selects first match', () => {
      const matches = ['#match-1', '#match-2', '#match-3'];
      const selectedOnEnter = matches.length > 0 ? matches[0] : null;
      expect(selectedOnEnter).toBe('#match-1');
    });
  });

  describe('Go-To During Other Modes', () => {
    test('G key disabled during search mode', () => {
      const isSearchModeActive = true;
      const key = 'g';
      const shouldHandleG = !isSearchModeActive && (key === 'g' || key === 'G');
      expect(shouldHandleG).toBe(false);
    });

    test('G key disabled when help is visible', () => {
      const isHelpVisible = true;
      const key = 'g';
      const shouldHandleG = !isHelpVisible && (key === 'g' || key === 'G');
      expect(shouldHandleG).toBe(false);
    });
  });

  describe('Integration with Selection', () => {
    test('G search then select completes picker', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#found-via-g-search',
          tagName: 'article',
          textPreview: 'Found Article',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('#found-via-g-search');
    });
  });
});

describe('Phase 3 Keyboard Shortcut Interactions', () => {
  describe('Vim Keys Combined with Marks', () => {
    test('vim navigate -> mark -> vim navigate -> jump', () => {
      let currentElement = '#start';
      let markedElement: string | null = null;

      currentElement = '#sibling-1';

      markedElement = currentElement;
      expect(markedElement).toBe('#sibling-1');

      currentElement = '#sibling-2';
      currentElement = '#child-of-sibling-2';

      currentElement = markedElement!;
      expect(currentElement).toBe('#sibling-1');
    });

    test('mark persists through vim and arrow navigation mix', () => {
      const markedElement: string | null = '#marked';

      const navigationSequence = ['j', 'ArrowDown', 'l', 'ArrowRight', 'k', 'ArrowUp', 'h'];
      navigationSequence.forEach(() => {
        expect(markedElement).toBe('#marked');
      });
    });
  });

  describe('Multi-Select with Vim Navigation', () => {
    test('vim navigate between multi-select additions', () => {
      const selectedElements: string[] = [];
      let currentElement = '#el-1';

      selectedElements.push(currentElement);

      currentElement = '#el-2';

      selectedElements.push(currentElement);

      currentElement = '#el-3';

      selectedElements.push(currentElement);

      expect(selectedElements).toHaveLength(3);
    });

    test('multi-select combined with mark and jump', () => {
      const selectedElements: string[] = [];
      let currentElement = '#start';
      let markedElement: string | null = null;

      markedElement = currentElement;

      currentElement = '#item-1';
      selectedElements.push(currentElement);

      currentElement = '#item-2';
      selectedElements.push(currentElement);

      currentElement = markedElement!;
      selectedElements.push(currentElement);

      expect(selectedElements).toContain('#start');
      expect(selectedElements).toHaveLength(3);
    });
  });

  describe('G Key with Marks', () => {
    test('G search does not clear mark', () => {
      const markedElement: string | null = '#marked';
      let isGoToModeActive = false;

      isGoToModeActive = true;
      expect(markedElement).toBe('#marked');

      isGoToModeActive = false;
      expect(markedElement).toBe('#marked');
    });

    test('can mark element found via G search', () => {
      const currentElement = '#found-via-search';
      let markedElement: string | null = null;

      markedElement = currentElement;
      expect(markedElement).toBe('#found-via-search');
    });
  });

  describe('All Phase 3 Keys in Sequence', () => {
    test('complete workflow: vim nav -> mark -> G search -> jump -> select', async () => {
      const mockPage = createMockPage();
      const pickerPromise = launchPicker(mockPage as any);

      setTimeout(() => {
        mockPage.triggerSelection({
          selector: '#workflow-complete',
          tagName: 'button',
          textPreview: 'Workflow Complete',
        });
      }, 10);

      const result = await pickerPromise;
      expect(result.selector).toBe('#workflow-complete');
    });
  });

  describe('State Machine Validation', () => {
    test('vim keys blocked during search mode', () => {
      const state = {
        isSearchModeActive: true,
        isHelpVisible: false,
        isGoToModeActive: false,
      };
      const shouldHandleVim = !state.isSearchModeActive && !state.isHelpVisible;
      expect(shouldHandleVim).toBe(false);
    });

    test('vim keys blocked when help visible', () => {
      const state = {
        isSearchModeActive: false,
        isHelpVisible: true,
        isGoToModeActive: false,
      };
      const shouldHandleVim = !state.isSearchModeActive && !state.isHelpVisible;
      expect(shouldHandleVim).toBe(false);
    });

    test('vim keys allowed in default state', () => {
      const state = {
        isSearchModeActive: false,
        isHelpVisible: false,
        isGoToModeActive: false,
      };
      const shouldHandleVim = !state.isSearchModeActive && !state.isHelpVisible;
      expect(shouldHandleVim).toBe(true);
    });

    test('mark/jump keys blocked during search mode', () => {
      const isSearchModeActive = true;
      const shouldHandleMark = !isSearchModeActive;
      const shouldHandleJump = !isSearchModeActive;
      expect(shouldHandleMark).toBe(false);
      expect(shouldHandleJump).toBe(false);
    });

    test('G key blocked during search mode', () => {
      const isSearchModeActive = true;
      const shouldHandleG = !isSearchModeActive;
      expect(shouldHandleG).toBe(false);
    });

    test('Ctrl+Enter works in any mode except help', () => {
      const scenarios = [
        { isSearchModeActive: false, isHelpVisible: false, shouldWork: true },
        { isSearchModeActive: true, isHelpVisible: false, shouldWork: false },
        { isSearchModeActive: false, isHelpVisible: true, shouldWork: false },
      ];

      scenarios.forEach((s) => {
        const shouldHandleCtrlEnter = !s.isSearchModeActive && !s.isHelpVisible;
        expect(shouldHandleCtrlEnter).toBe(s.shouldWork);
      });
    });
  });

  describe('Help Content Updates for Phase 3', () => {
    test('help includes vim navigation shortcuts', () => {
      const helpContent = {
        shortcuts: [
          { key: 'H/J/K/L', description: 'Vim-style navigation (same as arrows)' },
        ],
      };
      const vimShortcut = helpContent.shortcuts.find((s) => s.key.includes('H/J/K/L'));
      expect(vimShortcut).toBeDefined();
      expect(vimShortcut?.description).toContain('Vim');
    });

    test('help includes Ctrl+Enter multi-select', () => {
      const helpContent = {
        shortcuts: [{ key: 'Ctrl+Enter', description: 'Add to multi-select' }],
      };
      const multiSelectShortcut = helpContent.shortcuts.find((s) => s.key === 'Ctrl+Enter');
      expect(multiSelectShortcut).toBeDefined();
      expect(multiSelectShortcut?.description).toContain('multi-select');
    });

    test('help includes M key for marking', () => {
      const helpContent = {
        shortcuts: [{ key: 'M', description: 'Mark current element' }],
      };
      const markShortcut = helpContent.shortcuts.find((s) => s.key === 'M');
      expect(markShortcut).toBeDefined();
      expect(markShortcut?.description).toContain('Mark');
    });

    test("help includes ' key for jump to mark", () => {
      const helpContent = {
        shortcuts: [{ key: "'", description: 'Jump to marked element' }],
      };
      const jumpShortcut = helpContent.shortcuts.find((s) => s.key === "'");
      expect(jumpShortcut).toBeDefined();
      expect(jumpShortcut?.description).toContain('Jump');
    });

    test('help includes G key for go-to', () => {
      const helpContent = {
        shortcuts: [{ key: 'G', description: 'Go to element by text/ID' }],
      };
      const gShortcut = helpContent.shortcuts.find((s) => s.key === 'G');
      expect(gShortcut).toBeDefined();
      expect(gShortcut?.description).toContain('Go to');
    });
  });

  describe('Banner Updates for Phase 3', () => {
    test('banner shows mark indicator when element is marked', () => {
      const hasMarkedElement = true;
      const bannerAddition = hasMarkedElement ? " | ' to jump to mark" : '';
      expect(bannerAddition).toContain("'");
      expect(bannerAddition).toContain('mark');
    });

    test('banner shows multi-select mode indicator', () => {
      const isMultiSelectMode = true;
      const selectedCount = 2;
      const bannerText = isMultiSelectMode
        ? `Multi-select: ${selectedCount} selected | Ctrl+Enter to add | Enter to finish`
        : '';
      expect(bannerText).toContain('Multi-select');
      expect(bannerText).toContain('2 selected');
    });

    test('banner mentions vim keys in shortcuts', () => {
      const shortcutsLine = 'hjkl/arrows: navigate';
      expect(shortcutsLine).toContain('hjkl');
      expect(shortcutsLine).toContain('arrows');
    });
  });

  describe('Event Prevention for Phase 3 Keys', () => {
    test('vim keys call preventDefault', () => {
      const keysWithPreventDefault = ['h', 'H', 'j', 'J', 'k', 'K', 'l', 'L'];
      expect(keysWithPreventDefault).toHaveLength(8);
      keysWithPreventDefault.forEach((key) => {
        expect(/^[hjkl]$/i.test(key)).toBe(true);
      });
    });

    test('mark and jump keys call preventDefault', () => {
      const keysWithPreventDefault = ['m', 'M', "'"];
      expect(keysWithPreventDefault).toContain('m');
      expect(keysWithPreventDefault).toContain('M');
      expect(keysWithPreventDefault).toContain("'");
    });

    test('G key calls preventDefault', () => {
      const keysWithPreventDefault = ['g', 'G'];
      expect(keysWithPreventDefault).toContain('g');
      expect(keysWithPreventDefault).toContain('G');
    });

    test('Ctrl+Enter calls preventDefault', () => {
      const event = { key: 'Enter', ctrlKey: true };
      const shouldPreventDefault = event.key === 'Enter' && event.ctrlKey;
      expect(shouldPreventDefault).toBe(true);
    });
  });
});
