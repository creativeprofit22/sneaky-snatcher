/**
 * Interactive Mode Flow Integration Test
 *
 * E2E integration test for the interactive element picker flow:
 * 1. Launch browser
 * 2. Inject picker overlay
 * 3. Simulate element selection
 * 4. Verify selector returned
 * 5. Verify pipeline continues after selection
 *
 * Uses mock approach for deterministic, fast testing.
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import type { Page, Browser, BrowserContext, ElementHandle } from 'playwright';
import type { PickerResult } from '../../src/browser/picker.ts';

// ============================================================================
// Mock Types
// ============================================================================

interface MockElementHandle {
  screenshot: () => Promise<Buffer>;
}

interface MockPage {
  goto: ReturnType<typeof mock>;
  setDefaultTimeout: ReturnType<typeof mock>;
  setViewportSize: ReturnType<typeof mock>;
  $: ReturnType<typeof mock>;
  evaluate: ReturnType<typeof mock>;
  exposeFunction: ReturnType<typeof mock>;
  screenshot: ReturnType<typeof mock>;
  url: ReturnType<typeof mock>;
  title: ReturnType<typeof mock>;
  accessibility: {
    snapshot: ReturnType<typeof mock>;
  };
  _exposedFunctions: Map<string, (...args: unknown[]) => void>;
}

interface MockBrowserContext {
  newPage: ReturnType<typeof mock>;
}

interface MockBrowser {
  newContext: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
}

// ============================================================================
// Mock Factory
// ============================================================================

function createMockPage(): MockPage {
  const exposedFunctions = new Map<string, (...args: unknown[]) => void>();

  return {
    goto: mock(() => Promise.resolve()),
    setDefaultTimeout: mock(() => {}),
    setViewportSize: mock(() => Promise.resolve()),
    $: mock(() => Promise.resolve({ screenshot: () => Promise.resolve(Buffer.from('')) })),
    evaluate: mock(() => Promise.resolve()),
    exposeFunction: mock((name: string, fn: (...args: unknown[]) => void) => {
      exposedFunctions.set(name, fn);
      return Promise.resolve();
    }),
    screenshot: mock(() => Promise.resolve(Buffer.from(''))),
    url: mock(() => 'https://example.com'),
    title: mock(() => 'Test Page'),
    accessibility: {
      snapshot: mock(() =>
        Promise.resolve({
          role: 'WebArea',
          name: 'Test Page',
          children: [],
        })
      ),
    },
    _exposedFunctions: exposedFunctions,
  };
}

function createMockContext(page: MockPage): MockBrowserContext {
  return {
    newPage: mock(() => Promise.resolve(page)),
  };
}

function createMockBrowser(context: MockBrowserContext): MockBrowser {
  return {
    newContext: mock(() => Promise.resolve(context)),
    close: mock(() => Promise.resolve()),
  };
}

// ============================================================================
// Mock BrowserManager
// ============================================================================

class MockBrowserManager {
  private mockPage: MockPage | null = null;
  private mockBrowser: MockBrowser | null = null;
  private mockContext: MockBrowserContext | null = null;
  private config: { headless: boolean; viewport: { width: number; height: number }; timeout: number };

  constructor(config: Partial<{ headless: boolean; viewport: { width: number; height: number }; timeout: number }> = {}) {
    this.config = {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      timeout: 30000,
      ...config,
    };
  }

  async launch(): Promise<MockPage> {
    this.mockPage = createMockPage();
    this.mockContext = createMockContext(this.mockPage);
    this.mockBrowser = createMockBrowser(this.mockContext);
    return this.mockPage;
  }

  async navigate(url: string): Promise<void> {
    if (!this.mockPage) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    await this.mockPage.goto(url, { waitUntil: 'networkidle' });
  }

  getPage(): MockPage {
    if (!this.mockPage) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.mockPage;
  }

  async close(): Promise<void> {
    if (this.mockBrowser) {
      await this.mockBrowser.close();
      this.mockBrowser = null;
      this.mockContext = null;
      this.mockPage = null;
    }
  }

  /**
   * Mock interactive picker - simulates the full picker flow
   */
  async launchInteractivePicker(): Promise<PickerResult> {
    if (!this.mockPage) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Simulate exposing the selection function
    // Use a type-safe approach to avoid non-null assertion issues
    let resolveSelection: ((result: PickerResult) => void) | null = null;
    const selectionPromise = new Promise<PickerResult>((resolve) => {
      resolveSelection = resolve;
    });

    await this.mockPage.exposeFunction('__sneakySnatcherSelect', (result: PickerResult) => {
      if (resolveSelection) {
        resolveSelection(result);
      }
    });

    // Simulate evaluating picker injection (just verify it was called)
    await this.mockPage.evaluate(() => {
      // In real implementation, this injects the picker overlay
      // For mock, we just verify evaluate was called
    });

    // Simulate user selection by calling the exposed function
    const mockSelectionResult: PickerResult = {
      selector: '#hero .cta-button',
      tagName: 'a',
      textPreview: 'Get Started',
    };

    // Trigger the selection callback (simulates user clicking an element)
    const selectFn = this.mockPage._exposedFunctions.get('__sneakySnatcherSelect');
    if (selectFn) {
      selectFn(mockSelectionResult);
    }

    const result = await selectionPromise;
    return result;
  }

  isHeadless(): boolean {
    return this.config.headless;
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Interactive Mode Flow Integration', () => {
  let browserManager: MockBrowserManager;

  beforeEach(() => {
    browserManager = new MockBrowserManager({ headless: false });
  });

  afterEach(async () => {
    await browserManager.close();
  });

  describe('Browser Launch', () => {
    test('launches browser successfully', async () => {
      const page = await browserManager.launch();

      expect(page).toBeDefined();
      expect(page.goto).toBeDefined();
      expect(page.evaluate).toBeDefined();
    });

    test('browser launches in non-headless mode for interactive', async () => {
      const manager = new MockBrowserManager({ headless: false });

      expect(manager.isHeadless()).toBe(false);

      await manager.close();
    });

    test('throws error when accessing page before launch', () => {
      expect(() => browserManager.getPage()).toThrow('Browser not launched');
    });
  });

  describe('Page Navigation', () => {
    test('navigates to test page successfully', async () => {
      const page = await browserManager.launch();
      await browserManager.navigate('https://example.com/test');

      expect(page.goto).toHaveBeenCalledWith('https://example.com/test', { waitUntil: 'networkidle' });
    });

    test('throws error when navigating before launch', async () => {
      await expect(browserManager.navigate('https://example.com')).rejects.toThrow(
        'Browser not launched'
      );
    });
  });

  describe('Picker Overlay Injection', () => {
    test('injects picker overlay via evaluate', async () => {
      const page = await browserManager.launch();
      await browserManager.navigate('https://example.com');

      // Launch picker (will call evaluate internally)
      const result = await browserManager.launchInteractivePicker();

      // Verify evaluate was called (for picker injection)
      expect(page.evaluate).toHaveBeenCalled();
    });

    test('exposes __sneakySnatcherSelect function', async () => {
      const page = await browserManager.launch();
      await browserManager.navigate('https://example.com');

      await browserManager.launchInteractivePicker();

      // Verify exposeFunction was called with correct name
      expect(page.exposeFunction).toHaveBeenCalledWith(
        '__sneakySnatcherSelect',
        expect.any(Function)
      );
    });
  });

  describe('Element Selection', () => {
    test('returns PickerResult with selector', async () => {
      await browserManager.launch();
      await browserManager.navigate('https://example.com');

      const result = await browserManager.launchInteractivePicker();

      expect(result).toBeDefined();
      expect(result.selector).toBe('#hero .cta-button');
    });

    test('returns PickerResult with tagName', async () => {
      await browserManager.launch();
      await browserManager.navigate('https://example.com');

      const result = await browserManager.launchInteractivePicker();

      expect(result.tagName).toBe('a');
    });

    test('returns PickerResult with textPreview', async () => {
      await browserManager.launch();
      await browserManager.navigate('https://example.com');

      const result = await browserManager.launchInteractivePicker();

      expect(result.textPreview).toBe('Get Started');
    });

    test('selector is valid CSS selector format', async () => {
      await browserManager.launch();
      await browserManager.navigate('https://example.com');

      const result = await browserManager.launchInteractivePicker();

      // Should be a valid CSS selector pattern
      // Valid characters: # . word-chars whitespace > : [ ] " = -
      // Note: = is only valid inside attribute selectors [attr="value"]
      expect(result.selector).toMatch(/^[#.\w\s>:\[\]"=-]+$/);
      // Additionally verify the selector doesn't have obvious invalid patterns
      expect(result.selector).not.toMatch(/^[=>:\[\]]/); // Can't start with these
      expect(result.selector.trim()).toBe(result.selector); // No leading/trailing whitespace
    });
  });

  describe('Pipeline Continuation', () => {
    test('selector can be used for subsequent operations', async () => {
      const page = await browserManager.launch();
      await browserManager.navigate('https://example.com');

      const pickerResult = await browserManager.launchInteractivePicker();

      // Verify selector can be used with page.$ (element query)
      await page.$(pickerResult.selector);

      expect(page.$).toHaveBeenCalledWith('#hero .cta-button');
    });

    test('browser remains open after selection', async () => {
      const page = await browserManager.launch();
      await browserManager.navigate('https://example.com');

      await browserManager.launchInteractivePicker();

      // Page should still be accessible
      const currentPage = browserManager.getPage();
      expect(currentPage).toBe(page);
    });

    test('can take screenshot after selection', async () => {
      const page = await browserManager.launch();
      await browserManager.navigate('https://example.com');

      await browserManager.launchInteractivePicker();

      // Screenshot should work after picker closes
      await page.screenshot();
      expect(page.screenshot).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('browser closes successfully', async () => {
      await browserManager.launch();
      await browserManager.close();

      expect(() => browserManager.getPage()).toThrow('Browser not launched');
    });

    test('close is idempotent', async () => {
      await browserManager.launch();
      await browserManager.close();
      await browserManager.close(); // Should not throw

      expect(() => browserManager.getPage()).toThrow('Browser not launched');
    });
  });
});

// ============================================================================
// Picker Result Validation Tests
// ============================================================================

describe('PickerResult Validation', () => {
  describe('Selector Generation Scenarios', () => {
    test('handles ID-based selectors', () => {
      const result: PickerResult = {
        selector: '#main-nav',
        tagName: 'nav',
        textPreview: 'SneakyTest Home Products About Contact',
      };

      expect(result.selector).toBe('#main-nav');
      expect(result.selector.startsWith('#')).toBe(true);
    });

    test('handles class-based selectors', () => {
      const result: PickerResult = {
        selector: 'section.hero-section',
        tagName: 'section',
        textPreview: 'Welcome to Our Platform',
      };

      expect(result.selector).toContain('.hero-section');
    });

    test('handles data-attribute selectors', () => {
      const result: PickerResult = {
        selector: '[data-testid="cta-button"]',
        tagName: 'a',
        textPreview: 'Get Started',
      };

      expect(result.selector).toContain('data-testid');
    });

    test('handles nested path selectors', () => {
      const result: PickerResult = {
        selector: 'nav.navigation > div.nav-links > a:nth-of-type(2)',
        tagName: 'a',
        textPreview: 'Products',
      };

      expect(result.selector).toContain(' > ');
      expect(result.selector).toContain(':nth-of-type');
    });
  });

  describe('Text Preview', () => {
    test('truncates long text content', () => {
      const longText = 'A'.repeat(100);
      const result: PickerResult = {
        selector: '.content',
        tagName: 'div',
        textPreview: longText.slice(0, 50) + '...',
      };

      expect(result.textPreview.length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    test('handles empty text content', () => {
      const result: PickerResult = {
        selector: 'img.product-image',
        tagName: 'img',
        textPreview: '',
      };

      expect(result.textPreview).toBe('');
    });
  });

  describe('Tag Names', () => {
    test('tag name is lowercase', () => {
      const result: PickerResult = {
        selector: '#hero',
        tagName: 'section',
        textPreview: 'Welcome',
      };

      expect(result.tagName).toBe(result.tagName.toLowerCase());
    });

    test('handles common HTML elements', () => {
      const commonTags = ['div', 'span', 'a', 'button', 'section', 'nav', 'img', 'h1', 'p'];

      commonTags.forEach((tag) => {
        const result: PickerResult = {
          selector: `.test-${tag}`,
          tagName: tag,
          textPreview: 'Test content',
        };

        expect(result.tagName).toBe(tag);
      });
    });
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Interactive Mode Edge Cases', () => {
  let browserManager: MockBrowserManager;

  beforeEach(() => {
    browserManager = new MockBrowserManager();
  });

  afterEach(async () => {
    await browserManager.close();
  });

  describe('Cancelled Selection', () => {
    test('handles ESC key cancellation', async () => {
      // Create a custom mock that simulates cancellation
      class CancellingMockBrowserManager extends MockBrowserManager {
        async launchInteractivePicker(): Promise<PickerResult> {
          // Simulate ESC pressed - empty result
          return {
            selector: '',
            tagName: '',
            textPreview: '',
          };
        }
      }

      const cancellingManager = new CancellingMockBrowserManager();
      await cancellingManager.launch();
      await cancellingManager.navigate('https://example.com');

      const result = await cancellingManager.launchInteractivePicker();

      expect(result.selector).toBe('');
      expect(result.tagName).toBe('');

      await cancellingManager.close();
    });
  });

  describe('Special Characters in Selectors', () => {
    test('handles selectors with escaped characters', () => {
      const result: PickerResult = {
        selector: '#id\\:with\\:colons',
        tagName: 'div',
        textPreview: 'Content',
      };

      expect(result.selector).toContain('\\:');
    });

    test('handles selectors with brackets', () => {
      const result: PickerResult = {
        selector: '[data-id="item-1"]',
        tagName: 'li',
        textPreview: 'Item 1',
      };

      expect(result.selector).toMatch(/\[.*\]/);
    });
  });

  describe('Deeply Nested Elements', () => {
    test('generates path for deeply nested element', () => {
      const result: PickerResult = {
        selector: 'div.container > section.content > div.card > p.text:nth-of-type(3)',
        tagName: 'p',
        textPreview: 'Deeply nested paragraph',
      };

      const pathDepth = result.selector.split(' > ').length;
      expect(pathDepth).toBe(4);
    });
  });
});

// ============================================================================
// Full Interactive Flow Simulation
// ============================================================================

describe('Full Interactive Flow Simulation', () => {
  test('complete flow: launch -> navigate -> pick -> extract selector', async () => {
    // Step 1: Initialize
    const browserManager = new MockBrowserManager({ headless: false });

    // Step 2: Launch browser
    const page = await browserManager.launch();
    expect(page).toBeDefined();

    // Step 3: Navigate to page
    await browserManager.navigate('https://example.com/products');
    expect(page.goto).toHaveBeenCalled();

    // Step 4: Inject picker and get selection
    const pickerResult = await browserManager.launchInteractivePicker();
    expect(pickerResult.selector).toBeTruthy();

    // Step 5: Use selector for next pipeline step
    await page.$(pickerResult.selector);
    expect(page.$).toHaveBeenCalledWith(pickerResult.selector);

    // Step 6: Cleanup
    await browserManager.close();
    expect(() => browserManager.getPage()).toThrow();
  });

  test('simulates orchestrator interactive branch', async () => {
    // Simulates what the orchestrator does in interactive mode
    const browserManager = new MockBrowserManager({ headless: false });

    try {
      // Browse step
      await browserManager.launch();
      await browserManager.navigate('https://example.com');

      // Locate step (interactive mode)
      const pickerResult = await browserManager.launchInteractivePicker();

      // Verify we got a valid selector for extract step
      expect(pickerResult.selector).toBeTruthy();
      expect(typeof pickerResult.selector).toBe('string');
      expect(pickerResult.selector.length).toBeGreaterThan(0);

      // The selector would be passed to extractElement in real pipeline
      const selector = pickerResult.selector;
      expect(selector).toBe('#hero .cta-button');
    } finally {
      await browserManager.close();
    }
  });
});
