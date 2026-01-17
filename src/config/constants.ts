/**
 * Constants
 *
 * Centralized configuration defaults and supported values.
 */

import type { Framework, Styling } from '../types/index.ts';

/** Supported output frameworks */
export const SUPPORTED_FRAMEWORKS: readonly Framework[] = [
  'react',
  'vue',
  'svelte',
  'html',
] as const;

/** Supported styling approaches */
export const SUPPORTED_STYLING: readonly Styling[] = [
  'tailwind',
  'css-modules',
  'vanilla',
  'inline',
] as const;

/** Default configuration values */
export const DEFAULTS = {
  /** Default output framework */
  framework: 'react' as Framework,

  /** Default styling approach */
  styling: 'tailwind' as Styling,

  /** Default output directory */
  outputDir: './components',

  /** Default browser viewport */
  viewport: {
    width: 1920,
    height: 1080,
  },

  /** Navigation timeout in ms */
  timeout: 30000,

  /** LLM model */
  llmModel: 'sonnet' as const,

  /** LLM request timeout in ms */
  llmTimeout: 120000,

  /** Run browser in headless mode */
  headless: true,

  /** Include assets by default */
  includeAssets: false,

  /** Verbose logging */
  verbose: false,
} as const;

/** File extensions by framework */
export const FRAMEWORK_EXTENSIONS: Record<Framework, string> = {
  react: '.tsx',
  vue: '.vue',
  svelte: '.svelte',
  html: '.html',
};

/** Config file names to search for */
export const CONFIG_FILES = [
  '.snatchrc.json',
  '.snatchrc',
  'snatch.config.json',
] as const;

/** Environment variable prefix */
export const ENV_PREFIX = 'SNATCH_';
