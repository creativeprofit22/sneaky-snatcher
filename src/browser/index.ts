/**
 * Browser Module
 *
 * Handles browser automation via Playwright:
 * - Page navigation
 * - Accessibility snapshots
 * - Element location
 * - Screenshot capture
 */

export { BrowserManager } from './browser.ts';
export { createAccessibilitySnapshot, resolveRefToSelector, formatTreeForLLM } from './snapshot.ts';
export { waitForPageReady, scrollToElement } from './utils.ts';
