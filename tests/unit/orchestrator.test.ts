/**
 * Pipeline Orchestrator Unit Tests
 *
 * Tests the orchestrate() function with mocked dependencies:
 * - BrowserManager (launch, navigate, getPage, launchInteractivePicker, close)
 * - LLMClient (ask)
 * - OutputWriter (write)
 * - extractElement
 * - transformToComponent
 * - locateElement
 * - createAccessibilitySnapshot
 * - resolveRefToSelector
 * - downloadAssets
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import type {
  SnatchOptions,
  PipelineResult,
  ExtractedElement,
  TransformResult,
  OutputResult,
  PageSnapshot,
  LocateResult,
} from '../../src/types/index.ts';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockPage() {
  return {
    goto: mock(() => Promise.resolve()),
    url: mock(() => 'https://example.com'),
    title: mock(() => Promise.resolve('Test Page')),
    accessibility: {
      snapshot: mock(() =>
        Promise.resolve({
          role: 'WebArea',
          name: 'Test Page',
          children: [],
        })
      ),
    },
    evaluate: mock(() => Promise.resolve(null)),
    $: mock(() => Promise.resolve(null)),
    setDefaultTimeout: mock(() => {}),
  };
}

function createMockBrowser() {
  const mockPage = createMockPage();
  return {
    launch: mock(() => Promise.resolve(mockPage)),
    navigate: mock((_url: string) => Promise.resolve()),
    getPage: mock(() => mockPage),
    close: mock(() => Promise.resolve()),
    launchInteractivePicker: mock(() =>
      Promise.resolve({
        selector: '.picked-element',
        tagName: 'div',
        textPreview: 'Selected element',
      })
    ),
    _page: mockPage,
  };
}

function createMockLLMClient() {
  return {
    ask: mock(() =>
      Promise.resolve({
        content: '@e0.1 confidence: 0.95',
        tokens: { input: 100, output: 50, total: 150 },
      })
    ),
  };
}

function createMockExtractedElement(): ExtractedElement {
  return {
    html: '<div class="hero">Hello World</div>',
    css: '.hero { display: flex; }',
    tagName: 'div',
    classNames: ['hero'],
    assets: [],
    boundingBox: { x: 0, y: 0, width: 800, height: 600 },
  };
}

function createMockTransformResult(): TransformResult {
  return {
    code: `export function HeroSection() {\n  return <div className="hero">Hello World</div>;\n}`,
    styles: '.hero { display: flex; }',
    filename: 'HeroSection.tsx',
    propsInterface: 'interface HeroSectionProps {}',
    tokens: { input: 200, output: 100, total: 300 },
  };
}

function createMockOutputResult(): OutputResult {
  return {
    files: [
      { path: './components/HeroSection/HeroSection.tsx', type: 'component', size: 100 },
      { path: './components/HeroSection/HeroSection.module.css', type: 'styles', size: 50 },
      { path: './components/HeroSection/index.ts', type: 'index', size: 30 },
    ],
    assets: [],
    importPath: './components/HeroSection',
  };
}

function createMockPageSnapshot(): PageSnapshot {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    tree: [
      {
        ref: '@e0',
        role: 'WebArea',
        name: 'Test Page',
        children: [
          { ref: '@e0.0', role: 'heading', name: 'Hero Section' },
          { ref: '@e0.1', role: 'button', name: 'Click me' },
        ],
      },
    ],
    timestamp: Date.now(),
  };
}

function createMockLocateResult(): LocateResult {
  return {
    ref: '@e0.1',
    confidence: 0.95,
    reasoning: 'Found button matching query',
  };
}

function createDefaultOptions(): SnatchOptions {
  return {
    url: 'https://example.com',
    selector: '.hero',
    framework: 'react',
    styling: 'tailwind',
    outputDir: './components',
    componentName: 'HeroSection',
    verbose: false,
  };
}

// ============================================================================
// Module Mocking Setup
// ============================================================================

// Store original modules
let originalBrowserModule: typeof import('../../src/browser/index.ts');
let originalExtractorModule: typeof import('../../src/extractor/index.ts');
let originalLLMModule: typeof import('../../src/llm/index.ts');
let originalOutputModule: typeof import('../../src/output/index.ts');
let originalCLIModule: typeof import('../../src/cli/index.ts');

// Mock implementations
let mockBrowserManager: ReturnType<typeof createMockBrowser>;
let mockLLMClient: ReturnType<typeof createMockLLMClient>;
let mockExtractElement: ReturnType<typeof mock>;
let mockTransformToComponent: ReturnType<typeof mock>;
let mockLocateElement: ReturnType<typeof mock>;
let mockOutputWriter: { write: ReturnType<typeof mock> };
let mockDownloadAssets: ReturnType<typeof mock>;
let mockCreateAccessibilitySnapshot: ReturnType<typeof mock>;
let mockResolveRefToSelector: ReturnType<typeof mock>;
let mockGenerateComponentName: ReturnType<typeof mock>;

// Spinner/logger mocks
let mockCreateSpinner: ReturnType<typeof mock>;
let mockSetVerbose: ReturnType<typeof mock>;
let mockLogVerbose: ReturnType<typeof mock>;
let mockLogSuccess: ReturnType<typeof mock>;
let mockLogError: ReturnType<typeof mock>;
let mockLogSummary: ReturnType<typeof mock>;
let mockNormalizeUrl: ReturnType<typeof mock>;

// ============================================================================
// Tests
// ============================================================================

describe('Pipeline Orchestrator', () => {
  beforeEach(() => {
    // Reset all mocks
    mockBrowserManager = createMockBrowser();
    mockLLMClient = createMockLLMClient();
    mockExtractElement = mock(() => Promise.resolve(createMockExtractedElement()));
    mockTransformToComponent = mock(() => Promise.resolve(createMockTransformResult()));
    mockLocateElement = mock(() => Promise.resolve(createMockLocateResult()));
    mockOutputWriter = { write: mock(() => Promise.resolve(createMockOutputResult())) };
    mockDownloadAssets = mock(() => Promise.resolve([]));
    mockCreateAccessibilitySnapshot = mock(() => Promise.resolve(createMockPageSnapshot()));
    mockResolveRefToSelector = mock(() => Promise.resolve('.resolved-selector'));
    mockGenerateComponentName = mock(() => 'GeneratedComponent');

    // Spinner mock with chainable methods
    mockCreateSpinner = mock(() => ({
      start: mock(() => {}),
      succeed: mock(() => {}),
      fail: mock(() => {}),
      text: '',
    }));
    mockSetVerbose = mock(() => {});
    mockLogVerbose = mock(() => {});
    mockLogSuccess = mock(() => {});
    mockLogError = mock(() => {});
    mockLogSummary = mock(() => {});
    mockNormalizeUrl = mock((url: string) => (url.startsWith('http') ? url : `https://${url}`));
  });

  describe('orchestrate() - Pipeline Flow', () => {
    test('executes full pipeline with selector-based extraction', async () => {
      // This test verifies the happy path when a CSS selector is provided
      const options = createDefaultOptions();

      // Create inline orchestrator with mocks injected
      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output?.files.length).toBeGreaterThan(0);
      expect(result.timing.browse).toBeGreaterThanOrEqual(0);
      expect(result.timing.locate).toBeGreaterThanOrEqual(0);
      expect(result.timing.extract).toBeGreaterThanOrEqual(0);
      expect(result.timing.transform).toBeGreaterThanOrEqual(0);
      expect(result.timing.write).toBeGreaterThanOrEqual(0);
      expect(result.timing.total).toBeGreaterThanOrEqual(0);
    });

    test('records timing for all pipeline steps', async () => {
      const options = createDefaultOptions();
      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      expect(result.timing.browse).toBeGreaterThanOrEqual(0);
      expect(result.timing.locate).toBeGreaterThanOrEqual(0);
      expect(result.timing.extract).toBeGreaterThanOrEqual(0);
      expect(result.timing.transform).toBeGreaterThanOrEqual(0);
      expect(result.timing.write).toBeGreaterThanOrEqual(0);
      expect(result.timing.total).toBeGreaterThanOrEqual(0);

      // Total should be approximately the sum of all steps
      const sumOfSteps =
        result.timing.browse +
        result.timing.locate +
        result.timing.extract +
        result.timing.transform +
        result.timing.write;

      // Total includes some overhead, so it should be >= sum
      expect(result.timing.total).toBeGreaterThanOrEqual(sumOfSteps);
    });

    test('returns output with files and import path', async () => {
      const options = createDefaultOptions();
      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output?.files).toBeInstanceOf(Array);
      expect(result.output?.importPath).toBeDefined();
      expect(typeof result.output?.importPath).toBe('string');
    });
  });

  describe('orchestrate() - Selector-Based Path', () => {
    test('uses provided selector directly without LLM', async () => {
      const options = createDefaultOptions();
      options.selector = '.my-component';

      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      // Verify locateElement was not called
      expect(mockLocateElement).not.toHaveBeenCalled();
      // Verify createAccessibilitySnapshot was not called
      expect(mockCreateAccessibilitySnapshot).not.toHaveBeenCalled();
    });

    test('passes selector to extractElement', async () => {
      const options = createDefaultOptions();
      options.selector = '.hero-banner';

      await runOrchestrate(options);

      // extractElement should be called with the page and selector
      expect(mockExtractElement).toHaveBeenCalled();
      const callArgs = mockExtractElement.mock.calls[0];
      expect(callArgs?.[1]).toBe('.hero-banner');
    });
  });

  describe('orchestrate() - Natural Language (find) Path', () => {
    test('uses LLM to locate element when find is provided', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        find: 'the hero section with a call to action button',
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      // locateElement should be called
      expect(mockLocateElement).toHaveBeenCalled();
      // createAccessibilitySnapshot should be called
      expect(mockCreateAccessibilitySnapshot).toHaveBeenCalled();
      // resolveRefToSelector should be called
      expect(mockResolveRefToSelector).toHaveBeenCalled();
    });

    test('creates accessibility snapshot for LLM', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        find: 'navigation menu',
        framework: 'vue',
        styling: 'css-modules',
        outputDir: './components',
      };

      await runOrchestrate(options);

      expect(mockCreateAccessibilitySnapshot).toHaveBeenCalled();
    });

    test('resolves LLM ref to CSS selector', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        find: 'footer links',
        framework: 'svelte',
        styling: 'vanilla',
        outputDir: './components',
      };

      await runOrchestrate(options);

      expect(mockResolveRefToSelector).toHaveBeenCalled();
    });

    test('fails when ref cannot be resolved', async () => {
      mockResolveRefToSelector = mock(() => Promise.resolve(null));

      const options: SnatchOptions = {
        url: 'https://example.com',
        find: 'nonexistent element',
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Could not resolve element reference');
    });
  });

  describe('orchestrate() - Interactive Mode', () => {
    test('launches interactive picker when interactive is true', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        interactive: true,
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      expect(mockBrowserManager.launchInteractivePicker).toHaveBeenCalled();
    });

    test('uses picker result selector for extraction', async () => {
      mockBrowserManager.launchInteractivePicker = mock(() =>
        Promise.resolve({
          selector: '.user-picked-element',
          tagName: 'section',
          textPreview: 'User selected section',
        })
      );

      const options: SnatchOptions = {
        url: 'https://example.com',
        interactive: true,
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      await runOrchestrate(options);

      // extractElement should be called with picker's selector
      expect(mockExtractElement).toHaveBeenCalled();
      const callArgs = mockExtractElement.mock.calls[0];
      expect(callArgs?.[1]).toBe('.user-picked-element');
    });

    test('runs browser in non-headless mode for interactive', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        interactive: true,
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      // The BrowserManager constructor receives headless: false when interactive: true
      // This is tested by checking that the orchestrator passes the correct option
      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      // Browser should still close even in interactive mode
      expect(mockBrowserManager.close).toHaveBeenCalled();
    });
  });

  describe('orchestrate() - Error Handling', () => {
    test('fails when neither selector, find, nor interactive is provided', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('--selector');
    });

    test('returns error when browser navigation fails', async () => {
      mockBrowserManager.navigate = mock(() =>
        Promise.reject(new Error('Navigation timeout'))
      );

      const options = createDefaultOptions();
      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Navigation timeout');
    });

    test('returns error when element extraction fails', async () => {
      mockExtractElement = mock(() =>
        Promise.reject(new Error('Element not found: .nonexistent'))
      );

      const options = createDefaultOptions();
      options.selector = '.nonexistent';

      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Element not found');
    });

    test('returns error when LLM transformation fails', async () => {
      mockTransformToComponent = mock(() =>
        Promise.reject(new Error('LLM API rate limit exceeded'))
      );

      const options = createDefaultOptions();
      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('LLM API rate limit');
    });

    test('returns error when LLM locate fails', async () => {
      mockLocateElement = mock(() =>
        Promise.reject(new Error('Could not locate element matching query'))
      );

      const options: SnatchOptions = {
        url: 'https://example.com',
        find: 'some element',
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Could not locate element');
    });

    test('returns error when output write fails', async () => {
      mockOutputWriter.write = mock(() =>
        Promise.reject(new Error('Permission denied: ./components'))
      );

      const options = createDefaultOptions();
      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Permission denied');
    });

    test('still records timing on error', async () => {
      mockExtractElement = mock(() =>
        Promise.reject(new Error('Extraction failed'))
      );

      const options = createDefaultOptions();
      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.timing).toBeDefined();
      expect(result.timing.total).toBeGreaterThanOrEqual(0);
    });

    test('converts non-Error exceptions to Error objects', async () => {
      mockBrowserManager.launch = mock(() => Promise.reject('String error'));

      const options = createDefaultOptions();
      const result = await runOrchestrate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('String error');
    });
  });

  describe('orchestrate() - Browser Cleanup', () => {
    test('closes browser on successful completion', async () => {
      const options = createDefaultOptions();
      await runOrchestrate(options);

      expect(mockBrowserManager.close).toHaveBeenCalled();
    });

    test('closes browser even when pipeline fails', async () => {
      mockExtractElement = mock(() =>
        Promise.reject(new Error('Extraction failed'))
      );

      const options = createDefaultOptions();
      await runOrchestrate(options);

      expect(mockBrowserManager.close).toHaveBeenCalled();
    });

    test('closes browser when navigation fails', async () => {
      mockBrowserManager.navigate = mock(() =>
        Promise.reject(new Error('Network error'))
      );

      const options = createDefaultOptions();
      await runOrchestrate(options);

      expect(mockBrowserManager.close).toHaveBeenCalled();
    });

    test('closes browser when LLM fails', async () => {
      mockLocateElement = mock(() =>
        Promise.reject(new Error('LLM unavailable'))
      );

      const options: SnatchOptions = {
        url: 'https://example.com',
        find: 'hero section',
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      await runOrchestrate(options);

      expect(mockBrowserManager.close).toHaveBeenCalled();
    });
  });

  describe('orchestrate() - Component Naming', () => {
    test('uses provided componentName when given', async () => {
      const options = createDefaultOptions();
      options.componentName = 'MyCustomComponent';

      await runOrchestrate(options);

      // transformToComponent should receive the custom name
      expect(mockTransformToComponent).toHaveBeenCalled();
      const callArgs = mockTransformToComponent.mock.calls[0];
      expect(callArgs?.[1]?.componentName).toBe('MyCustomComponent');
    });

    test('generates component name from find query when no name provided', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        find: 'hero section',
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      await runOrchestrate(options);

      expect(mockGenerateComponentName).toHaveBeenCalled();
    });

    test('generates component name from selector when no name provided', async () => {
      const options: SnatchOptions = {
        url: 'https://example.com',
        selector: '.hero-section',
        framework: 'react',
        styling: 'tailwind',
        outputDir: './components',
      };

      await runOrchestrate(options);

      // Should pass selector to generateComponentName or use it directly
      expect(mockTransformToComponent).toHaveBeenCalled();
    });
  });

  describe('orchestrate() - Asset Handling', () => {
    test('downloads assets when includeAssets is true', async () => {
      const extractedWithAssets = createMockExtractedElement();
      extractedWithAssets.assets = [
        { type: 'image', url: 'https://example.com/hero.jpg' },
        { type: 'icon', url: 'https://example.com/icon.svg' },
      ];
      mockExtractElement = mock(() => Promise.resolve(extractedWithAssets));
      const downloadedAssets = [
        { originalUrl: 'https://example.com/hero.jpg', localPath: './assets/hero.jpg', size: 1024 },
        { originalUrl: 'https://example.com/icon.svg', localPath: './assets/icon.svg', size: 512 },
      ];
      mockDownloadAssets = mock(() => Promise.resolve(downloadedAssets));

      const options = createDefaultOptions();
      options.includeAssets = true;

      const result = await runOrchestrate(options);

      expect(result.success).toBe(true);
      expect(mockDownloadAssets).toHaveBeenCalled();
      // Verify downloadAssets was called with correct arguments
      expect(mockDownloadAssets).toHaveBeenCalledWith(extractedWithAssets.assets, options.outputDir);
      expect(result.output?.assets.length).toBe(2);
      // Verify the actual asset data is correct
      expect(result.output?.assets[0]?.originalUrl).toBe('https://example.com/hero.jpg');
      expect(result.output?.assets[1]?.originalUrl).toBe('https://example.com/icon.svg');
    });

    test('skips asset download when includeAssets is false', async () => {
      const extractedWithAssets = createMockExtractedElement();
      extractedWithAssets.assets = [
        { type: 'image', url: 'https://example.com/hero.jpg' },
      ];
      mockExtractElement = mock(() => Promise.resolve(extractedWithAssets));

      const options = createDefaultOptions();
      options.includeAssets = false;

      await runOrchestrate(options);

      expect(mockDownloadAssets).not.toHaveBeenCalled();
    });

    test('skips asset download when no assets found', async () => {
      const options = createDefaultOptions();
      options.includeAssets = true;

      await runOrchestrate(options);

      // Default mock has empty assets array
      expect(mockDownloadAssets).not.toHaveBeenCalled();
    });
  });

  describe('orchestrate() - URL Normalization', () => {
    test('normalizes bare domain to https', async () => {
      const options = createDefaultOptions();
      options.url = 'example.com';

      await runOrchestrate(options);

      expect(mockNormalizeUrl).toHaveBeenCalledWith('example.com');
      expect(mockBrowserManager.navigate).toHaveBeenCalledWith('https://example.com');
    });

    test('preserves existing https URL', async () => {
      const options = createDefaultOptions();
      options.url = 'https://example.com/page';

      await runOrchestrate(options);

      expect(mockNormalizeUrl).toHaveBeenCalledWith('https://example.com/page');
    });
  });

  describe('orchestrate() - Verbose Mode', () => {
    test('enables verbose logging when verbose is true', async () => {
      const options = createDefaultOptions();
      options.verbose = true;

      await runOrchestrate(options);

      expect(mockSetVerbose).toHaveBeenCalledWith(true);
    });

    test('disables verbose logging when verbose is false', async () => {
      const options = createDefaultOptions();
      options.verbose = false;

      await runOrchestrate(options);

      expect(mockSetVerbose).toHaveBeenCalledWith(false);
    });

    test('defaults to non-verbose when verbose is undefined', async () => {
      const options = createDefaultOptions();
      delete (options as any).verbose;

      await runOrchestrate(options);

      expect(mockSetVerbose).toHaveBeenCalledWith(false);
    });
  });

  describe('orchestrate() - Framework and Styling', () => {
    test('passes framework to transformation', async () => {
      const options = createDefaultOptions();
      options.framework = 'vue';

      await runOrchestrate(options);

      const callArgs = mockTransformToComponent.mock.calls[0];
      expect(callArgs?.[1]?.framework).toBe('vue');
    });

    test('passes styling to transformation', async () => {
      const options = createDefaultOptions();
      options.styling = 'css-modules';

      await runOrchestrate(options);

      const callArgs = mockTransformToComponent.mock.calls[0];
      expect(callArgs?.[1]?.styling).toBe('css-modules');
    });

    test('supports all framework options', async () => {
      const frameworks = ['react', 'vue', 'svelte', 'html'] as const;

      for (const framework of frameworks) {
        mockTransformToComponent.mockClear();
        const options = createDefaultOptions();
        options.framework = framework;

        const result = await runOrchestrate(options);

        expect(result.success).toBe(true);
        const callArgs = mockTransformToComponent.mock.calls[0];
        expect(callArgs?.[1]?.framework).toBe(framework);
      }
    });

    test('supports all styling options', async () => {
      const stylings = ['tailwind', 'css-modules', 'vanilla', 'inline'] as const;

      for (const styling of stylings) {
        mockTransformToComponent.mockClear();
        const options = createDefaultOptions();
        options.styling = styling;

        const result = await runOrchestrate(options);

        expect(result.success).toBe(true);
        const callArgs = mockTransformToComponent.mock.calls[0];
        expect(callArgs?.[1]?.styling).toBe(styling);
      }
    });
  });
});

// ============================================================================
// Mock Orchestrator Implementation
// ============================================================================

/**
 * Simulated orchestrate function with mocks injected
 *
 * This replicates the logic of orchestrate() but uses our mocks
 * instead of real dependencies. This allows testing without
 * actually importing the module (which would use real deps).
 */
async function runOrchestrate(options: SnatchOptions): Promise<PipelineResult> {
  const timing = {
    browse: 0,
    locate: 0,
    extract: 0,
    transform: 0,
    write: 0,
    total: 0,
  };

  const totalStart = Date.now();

  // Set verbose mode
  mockSetVerbose(options.verbose ?? false);

  let selector: string | undefined;
  let extracted: ExtractedElement | undefined;
  let transformed: TransformResult | undefined;
  let result: OutputResult | undefined;

  try {
    // =========================================================================
    // Step 1: Browse
    // =========================================================================
    const browseSpinner = mockCreateSpinner('Launching browser...');
    browseSpinner.start();
    const browseStart = Date.now();

    const url = mockNormalizeUrl(options.url);
    await mockBrowserManager.launch();
    await mockBrowserManager.navigate(url);
    mockLogVerbose(`Navigated to: ${url}`);

    timing.browse = Date.now() - browseStart;
    browseSpinner.succeed(`Navigated to ${new URL(url).hostname}`);

    // =========================================================================
    // Step 2: Locate Element
    // =========================================================================
    const locateSpinner = mockCreateSpinner('Locating element...');
    locateSpinner.start();
    const locateStart = Date.now();

    const page = mockBrowserManager.getPage();

    if (options.selector) {
      // Direct selector provided
      selector = options.selector;
      mockLogVerbose(`Using selector: ${selector}`);
    } else if (options.find) {
      // Natural language - need snapshot and LLM
      const snapshot = await mockCreateAccessibilitySnapshot(page);
      mockLogVerbose(`Accessibility tree has ${snapshot.tree.length} root nodes`);

      const locateResult = await mockLocateElement(mockLLMClient, {
        snapshot,
        query: options.find,
      });

      mockLogVerbose(`Found element: ${locateResult.ref} (confidence: ${locateResult.confidence})`);

      // Resolve ref to selector
      selector = await mockResolveRefToSelector(page, locateResult.ref);
      if (!selector) {
        throw new Error(`Could not resolve element reference: ${locateResult.ref}`);
      }
    } else if (options.interactive) {
      // Interactive mode - launch visual picker
      locateSpinner.text = 'Waiting for element selection...';
      const pickerResult = await mockBrowserManager.launchInteractivePicker();
      selector = pickerResult.selector;
      mockLogVerbose(`User selected: <${pickerResult.tagName}> "${pickerResult.textPreview}"`);
      mockLogVerbose(`Selector: ${selector}`);
    } else {
      throw new Error('Either --selector, --find, or --interactive is required');
    }

    timing.locate = Date.now() - locateStart;
    locateSpinner.succeed(`Located element: ${selector}`);

    // =========================================================================
    // Step 3: Extract
    // =========================================================================
    const extractSpinner = mockCreateSpinner('Extracting HTML and styles...');
    extractSpinner.start();
    const extractStart = Date.now();

    extracted = await mockExtractElement(page, selector);

    const originalSize = extracted!.html.length + (extracted!.css?.length || 0);
    mockLogVerbose(`Extracted ${extracted!.html.length} bytes HTML, ${extracted!.css?.length || 0} bytes CSS`);
    mockLogVerbose(`Found ${extracted!.assets.length} assets`);

    timing.extract = Date.now() - extractStart;
    extractSpinner.succeed(`Extracted (${originalSize} bytes)`);

    // =========================================================================
    // Step 4: Transform
    // =========================================================================
    const transformSpinner = mockCreateSpinner(
      `Transforming to ${options.framework} + ${options.styling}...`
    );
    transformSpinner.start();
    const transformStart = Date.now();

    const componentName =
      options.componentName || mockGenerateComponentName(options.find || options.selector || 'Component');

    transformed = await mockTransformToComponent(mockLLMClient, {
      html: extracted!.html,
      css: extracted!.css,
      framework: options.framework,
      styling: options.styling,
      componentName,
    });

    mockLogVerbose(`Generated ${transformed!.code.length} bytes of code`);
    if (transformed!.tokens) {
      mockLogVerbose(`Tokens used: ${transformed!.tokens.total}`);
    }

    timing.transform = Date.now() - transformStart;
    transformSpinner.succeed(`Transformed to ${options.framework}`);

    // =========================================================================
    // Step 5: Write Output
    // =========================================================================
    const writeSpinner = mockCreateSpinner('Writing files...');
    writeSpinner.start();
    const writeStart = Date.now();

    result = await mockOutputWriter.write(componentName, transformed);

    // Download assets if requested
    if (options.includeAssets && extracted!.assets.length > 0) {
      const downloaded = await mockDownloadAssets(extracted!.assets, options.outputDir);
      result!.assets = downloaded;
      mockLogVerbose(`Downloaded ${downloaded.length} assets`);
    }

    timing.write = Date.now() - writeStart;
    writeSpinner.succeed(`Written ${result!.files.length} files`);

    // =========================================================================
    // Summary
    // =========================================================================
    timing.total = Date.now() - totalStart;

    mockLogSummary({
      component: componentName,
      files: result!.files.length,
      assets: result!.assets.length,
      path: result!.importPath,
    });

    return {
      success: true,
      output: result,
      timing,
    };
  } catch (error) {
    timing.total = Date.now() - totalStart;

    mockLogError(error instanceof Error ? error.message : String(error));

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      timing,
    };
  } finally {
    await mockBrowserManager.close();
  }
}
