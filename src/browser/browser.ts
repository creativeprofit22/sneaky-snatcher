/**
 * Browser Manager
 *
 * Manages Playwright browser instance lifecycle and page interactions.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import type { BrowserConfig, Viewport } from '../types/index.ts';
import { launchPicker, type PickerResult } from './picker.ts';

const DEFAULT_CONFIG: BrowserConfig = {
  headless: true,
  viewport: { width: 1920, height: 1080 },
  timeout: 30000,
};

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Ensure page exists or throw
   */
  private ensurePage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.page;
  }

  /**
   * Launch browser and create page
   */
  async launch(): Promise<Page> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);

    return this.page;
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Unsupported protocol: ${parsed.protocol}. Only http: and https: are supported.`);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Invalid URL format: ${url}`);
      }
      throw error;
    }
  }

  /**
   * Navigate to URL and wait for load
   */
  async navigate(url: string): Promise<void> {
    this.validateUrl(url);
    const page = this.ensurePage();
    await page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Get current page instance
   */
  getPage(): Page {
    return this.ensurePage();
  }

  /**
   * Take screenshot of page or element
   */
  async screenshot(selector?: string): Promise<Buffer> {
    const page = this.ensurePage();

    if (selector) {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      return element.screenshot();
    }

    return page.screenshot({ fullPage: true });
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * Set viewport size
   */
  async setViewport(viewport: Viewport): Promise<void> {
    const page = this.ensurePage();
    await page.setViewportSize(viewport);
  }

  /**
   * Launch interactive element picker
   *
   * Opens a visual picker overlay in the browser that lets users
   * select an element by clicking. Returns the CSS selector.
   */
  async launchInteractivePicker(): Promise<PickerResult> {
    const page = this.ensurePage();
    return launchPicker(page);
  }
}
