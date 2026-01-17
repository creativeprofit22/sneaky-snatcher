/**
 * Browser Utilities
 *
 * Helper functions for page interaction and waiting.
 */

import type { Page } from 'playwright';

/**
 * Wait for page to be fully ready (network idle + DOM stable)
 */
export async function waitForPageReady(page: Page, timeout = 10000): Promise<void> {
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout }),
    page.waitForLoadState('domcontentloaded', { timeout }),
  ]);

  // Additional wait for any lazy-loaded content
  await page.waitForTimeout(500);
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
  await page.waitForTimeout(300);
}

/**
 * Get element bounding box
 */
export async function getElementBounds(
  page: Page,
  selector: string
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const element = await page.$(selector);
  if (!element) return null;

  const box = await element.boundingBox();
  return box;
}

/**
 * Check if element is visible in viewport
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  const element = await page.$(selector);
  if (!element) return false;

  return element.isVisible();
}

/**
 * Wait for element to appear
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return true;
  } catch {
    return false;
  }
}
