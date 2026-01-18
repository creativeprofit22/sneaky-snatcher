/**
 * Batch Extraction Unit Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { loadBatchConfig } from '../../src/cli/options.ts';
import { BrowserManager } from '../../src/browser/browser.ts';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Batch Extraction', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `snatch-batch-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const writeTempConfig = (content: unknown): string => {
    const filePath = join(tempDir, 'batch.json');
    writeFileSync(filePath, JSON.stringify(content, null, 2));
    return filePath;
  };

  describe('loadBatchConfig()', () => {
    test('loads valid config with minimal component', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', name: 'Hero' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(true);
      expect(result.config?.components).toHaveLength(1);
      expect(result.config?.components[0].name).toBe('Hero');
    });

    test('loads valid config with find instead of selector', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', find: 'pricing card', name: 'PricingCard' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(true);
      expect(result.config?.components[0].find).toBe('pricing card');
    });

    test('loads valid config with defaults', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: 'nav', name: 'Navigation' },
        ],
        defaults: {
          framework: 'vue',
          styling: 'css-modules',
          outputDir: './my-components',
        },
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(true);
      expect(result.config?.defaults?.framework).toBe('vue');
      expect(result.config?.defaults?.styling).toBe('css-modules');
      expect(result.config?.defaults?.outputDir).toBe('./my-components');
    });

    test('loads valid config with per-component overrides', () => {
      const configPath = writeTempConfig({
        components: [
          {
            url: 'https://example.com',
            selector: '.btn',
            name: 'Button',
            framework: 'svelte',
            styling: 'vanilla',
          },
        ],
        defaults: {
          framework: 'react',
          styling: 'tailwind',
        },
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(true);
      expect(result.config?.components[0].framework).toBe('svelte');
      expect(result.config?.components[0].styling).toBe('vanilla');
    });

    test('loads config with multiple components', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://stripe.com/pricing', find: 'pricing card', name: 'PricingCard' },
          { url: 'https://linear.app', selector: 'nav', name: 'Navigation' },
          { url: 'https://vercel.com', selector: 'footer', name: 'Footer' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(true);
      expect(result.config?.components).toHaveLength(3);
    });

    test('rejects non-existent file', () => {
      const result = loadBatchConfig('/nonexistent/path/batch.json');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    test('rejects invalid JSON', () => {
      const filePath = join(tempDir, 'invalid.json');
      writeFileSync(filePath, '{ invalid json }');

      const result = loadBatchConfig(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('parse');
    });

    test('rejects config without components array', () => {
      const configPath = writeTempConfig({
        defaults: { framework: 'react' },
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('components');
    });

    test('rejects empty components array', () => {
      const configPath = writeTempConfig({
        components: [],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('empty');
    });

    test('rejects component without url', () => {
      const configPath = writeTempConfig({
        components: [
          { selector: '.hero', name: 'Hero' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('url'))).toBe(true);
    });

    test('rejects component without name', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    test('rejects component without selector or find', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', name: 'Hero' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('selector') || e.includes('find'))).toBe(true);
    });

    test('rejects component with both selector and find', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', find: 'hero section', name: 'Hero' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('both'))).toBe(true);
    });

    test('rejects non-PascalCase component name', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', name: 'hero' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('PascalCase'))).toBe(true);
    });

    test('rejects invalid framework in component', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', name: 'Hero', framework: 'angular' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('framework'))).toBe(true);
    });

    test('rejects invalid styling in component', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', name: 'Hero', styling: 'scss' },
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('styling'))).toBe(true);
    });

    test('rejects invalid framework in defaults', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', name: 'Hero' },
        ],
        defaults: { framework: 'angular' },
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('framework'))).toBe(true);
    });

    test('rejects invalid styling in defaults', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', name: 'Hero' },
        ],
        defaults: { styling: 'less' },
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('styling'))).toBe(true);
    });

    test('collects multiple validation errors', () => {
      const configPath = writeTempConfig({
        components: [
          { name: 'hero' }, // missing url, selector/find, non-PascalCase
        ],
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    test('accepts config with includeAssets option', () => {
      const configPath = writeTempConfig({
        components: [
          { url: 'https://example.com', selector: '.hero', name: 'Hero', includeAssets: true },
        ],
        defaults: { includeAssets: false },
      });

      const result = loadBatchConfig(configPath);
      expect(result.valid).toBe(true);
      expect(result.config?.components[0].includeAssets).toBe(true);
      expect(result.config?.defaults?.includeAssets).toBe(false);
    });
  });
});

describe('Browser Context Reuse', () => {
  // Browser tests need longer timeout due to Playwright startup time
  const BROWSER_TEST_TIMEOUT = 30000;

  describe('BrowserManager.isLaunched()', () => {
    test('returns false before launch', () => {
      const browser = new BrowserManager();
      expect(browser.isLaunched()).toBe(false);
    });

    test('returns true after launch', async () => {
      const browser = new BrowserManager({ headless: true });
      try {
        await browser.launch();
        expect(browser.isLaunched()).toBe(true);
      } finally {
        await browser.close();
      }
    }, BROWSER_TEST_TIMEOUT);

    test('returns false after close', async () => {
      const browser = new BrowserManager({ headless: true });
      await browser.launch();
      await browser.close();
      expect(browser.isLaunched()).toBe(false);
    }, BROWSER_TEST_TIMEOUT);
  });

  describe('BrowserManager.newPage()', () => {
    test('throws if browser not launched', async () => {
      const browser = new BrowserManager();
      await expect(browser.newPage()).rejects.toThrow('Browser not launched');
    });

    test('creates new page after launch', async () => {
      const browser = new BrowserManager({ headless: true });
      try {
        await browser.launch();
        const page = await browser.newPage();
        expect(page).toBeDefined();
        expect(browser.getPage()).toBe(page);
      } finally {
        await browser.close();
      }
    }, BROWSER_TEST_TIMEOUT);

    test('replaces previous page', async () => {
      const browser = new BrowserManager({ headless: true });
      try {
        await browser.launch();
        const firstPage = browser.getPage();
        const secondPage = await browser.newPage();

        expect(secondPage).not.toBe(firstPage);
        expect(browser.getPage()).toBe(secondPage);
        // First page should be closed (isClosed() returns true)
        expect(firstPage.isClosed()).toBe(true);
      } finally {
        await browser.close();
      }
    }, BROWSER_TEST_TIMEOUT);

    test('allows multiple page creations', async () => {
      const browser = new BrowserManager({ headless: true });
      try {
        await browser.launch();

        for (let i = 0; i < 3; i++) {
          const page = await browser.newPage();
          expect(page).toBeDefined();
          expect(browser.isLaunched()).toBe(true);
        }
      } finally {
        await browser.close();
      }
    }, BROWSER_TEST_TIMEOUT);
  });
});
