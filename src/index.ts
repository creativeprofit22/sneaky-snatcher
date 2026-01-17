/**
 * Sneaky Snatcher
 *
 * AI-powered component extraction and transformation CLI.
 * Browse, extract, transform, ship.
 *
 * @packageDocumentation
 */

// Core orchestrator
export { orchestrate } from './orchestrator.ts';

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
} from './types/index.ts';

// Config
export { loadConfig, getConfig, DEFAULTS, SUPPORTED_FRAMEWORKS, SUPPORTED_STYLING } from './config/index.ts';
export type { Config } from './config/index.ts';

// Errors
export {
  SnatchError,
  BrowserError,
  NavigationError,
  ElementNotFoundError,
  LLMError,
  LLMNotAvailableError,
  ExtractionError,
  TransformationError,
  OutputError,
  ConfigError,
  ValidationError,
  isSnatchError,
  formatError,
} from './errors/index.ts';

// Browser module
export { BrowserManager, createAccessibilitySnapshot, resolveRefToSelector } from './browser/index.ts';

// Extractor module
export { extractElement, StyleReducer, resolveAssets, downloadAsset } from './extractor/index.ts';

// LLM module
export { LLMClient, locateElement, transformToComponent, PROMPTS } from './llm/index.ts';

// Output module
export { OutputWriter, downloadAssets, generateIndex, updateIndex } from './output/index.ts';

// CLI (for programmatic use)
export { createProgram, runCli } from './cli/index.ts';

// Utils
export { sleep, retry, timeout, sanitize, toPascalCase, toKebabCase } from './utils/index.ts';
