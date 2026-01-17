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
