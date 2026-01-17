/**
 * Output Module
 *
 * Handles file writing and asset management:
 * - Component file writing
 * - Style file writing
 * - Asset downloading and organization
 * - Index/barrel export generation
 */

export { OutputWriter } from './writer.ts';
export { downloadAssets, organizeAssets } from './assets.ts';
export { generateIndex, updateIndex } from './barrel.ts';
