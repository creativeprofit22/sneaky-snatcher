/**
 * Extractor Module
 *
 * Extracts HTML elements with reduced CSS styles.
 * Ported from sneaky-rat's core logic.
 *
 * Exports:
 * - extractElement: Main extraction function (recommended)
 * - StyleReducer: CSS reduction utility class
 * - resolveAssets: Asset resolution (used internally by extractElement, exposed for advanced use)
 */

// Primary API
export { extractElement } from './extractor.ts';
export { StyleReducer } from './styleReducer.ts';

// Internal helper exposed for advanced programmatic use
export { resolveAssets } from './assetResolver.ts';
