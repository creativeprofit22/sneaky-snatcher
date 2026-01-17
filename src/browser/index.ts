/**
 * Browser Module
 *
 * Handles browser automation via Playwright:
 * - Page navigation
 * - Accessibility snapshots
 * - Element location
 * - Screenshot capture
 */

export { BrowserManager } from './browser.js';
export { createAccessibilitySnapshot, resolveRefToSelector } from './snapshot.js';
export { waitForPageReady, scrollToElement } from './utils.js';
