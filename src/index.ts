/**
 * Sneaky Snatcher
 *
 * AI-powered component extraction and transformation CLI.
 * Browse, extract, transform, ship.
 *
 * @packageDocumentation
 */

// Core orchestrator
export { orchestrate } from './orchestrator.js';

// Types
export type {
  SnatchOptions,
  Framework,
  Styling,
  BrowserConfig,
  ExtractedElement,
  TransformResult,
  OutputResult,
  PipelineResult,
} from './types/index.js';

// Browser module
export { BrowserManager, createAccessibilitySnapshot, resolveRefToSelector } from './browser/index.js';

// Extractor module
export { extractElement, StyleReducer, resolveAssets, downloadAsset } from './extractor/index.js';

// LLM module
export { LLMClient, locateElement, transformToComponent, PROMPTS } from './llm/index.js';

// Output module
export { OutputWriter, downloadAssets, generateIndex, updateIndex } from './output/index.js';

// CLI (for programmatic use)
export { createProgram, runCli } from './cli/index.js';

// Utils
export { sleep, retry, timeout, sanitize, toPascalCase, toKebabCase } from './utils/index.js';
