/**
 * Browser Utilities
 *
 * Helper functions for page interaction and waiting.
 */

import type { Page } from 'playwright';

/** Time to wait for lazy-loaded content after page load (ms) */
const LAZY_CONTENT_WAIT_MS = 500;

/** Time to wait for scroll animation to complete (ms) */
const SCROLL_ANIMATION_WAIT_MS = 300;

/**
 * Wait for page to be fully ready (network idle + DOM stable)
 */
export async function waitForPageReady(page: Page, timeout = 10000): Promise<void> {
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout }),
    page.waitForLoadState('domcontentloaded', { timeout }),
  ]);

  // Additional wait for any lazy-loaded content
  await page.waitForTimeout(LAZY_CONTENT_WAIT_MS);
}

/**
 * Scroll element into view
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, selector);

  // Wait for scroll to complete
  await page.waitForTimeout(SCROLL_ANIMATION_WAIT_MS);
}

