/**
 * Config Loader
 *
 * Loads configuration from file, environment, and CLI.
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Framework, Styling, SnatchOptions } from '../types/index.ts';
import { DEFAULTS, CONFIG_FILES, ENV_PREFIX, SUPPORTED_FRAMEWORKS, SUPPORTED_STYLING } from './constants.ts';

export interface Config {
  framework: Framework;
  styling: Styling;
  outputDir: string;
  headless: boolean;
  includeAssets: boolean;
  verbose: boolean;
  llm: {
    model: 'sonnet' | 'opus' | 'haiku';
    timeout: number;
  };
  browser: {
    viewport: { width: number; height: number };
    timeout: number;
  };
}

let cachedConfig: Config | null = null;

/**
 * Load configuration with priority: CLI > ENV > File > Defaults
 */
export async function loadConfig(cliOptions?: Partial<SnatchOptions>): Promise<Config> {
  // Start with defaults
  let config: Config = {
    framework: DEFAULTS.framework,
    styling: DEFAULTS.styling,
    outputDir: DEFAULTS.outputDir,
    headless: DEFAULTS.headless,
    includeAssets: DEFAULTS.includeAssets,
    verbose: DEFAULTS.verbose,
    llm: {
      model: DEFAULTS.llmModel,
      timeout: DEFAULTS.llmTimeout,
    },
    browser: {
      viewport: { ...DEFAULTS.viewport },
      timeout: DEFAULTS.timeout,
    },
  };

  // Load from file
  const fileConfig = await loadConfigFile();
  if (fileConfig) {
    config = mergeConfig(config, fileConfig);
  }

  // Load from environment
  const envConfig = loadEnvConfig();
  config = mergeConfig(config, envConfig);

  // Apply CLI options (highest priority)
  if (cliOptions) {
    config = mergeConfig(config, cliOptionsToConfig(cliOptions));
  }

  cachedConfig = config;
  return config;
}

/**
 * Get cached config or load fresh
 */
export async function getConfig(): Promise<Config> {
  if (cachedConfig) return cachedConfig;
  return loadConfig();
}

/**
 * Load config from file
 */
async function loadConfigFile(): Promise<Partial<Config> | null> {
  const cwd = process.cwd();

  for (const filename of CONFIG_FILES) {
    const filepath = join(cwd, filename);
    if (existsSync(filepath)) {
      try {
        const content = await readFile(filepath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.warn(`Failed to parse config file: ${filepath}`);
      }
    }
  }

  return null;
}

/**
 * Load config from environment variables
 */
function loadEnvConfig(): Partial<Config> {
  const config: Partial<Config> = {};

  const framework = process.env[`${ENV_PREFIX}FRAMEWORK`];
  if (framework && SUPPORTED_FRAMEWORKS.includes(framework as Framework)) {
    config.framework = framework as Framework;
  }

  const styling = process.env[`${ENV_PREFIX}STYLING`];
  if (styling && SUPPORTED_STYLING.includes(styling as Styling)) {
    config.styling = styling as Styling;
  }

  const outputDir = process.env[`${ENV_PREFIX}OUTPUT_DIR`];
  if (outputDir) {
    config.outputDir = outputDir;
  }

  const verbose = process.env[`${ENV_PREFIX}VERBOSE`];
  if (verbose === 'true' || verbose === '1') {
    config.verbose = true;
  }

  return config;
}

/**
 * Convert CLI options to config format
 */
function cliOptionsToConfig(options: Partial<SnatchOptions>): Partial<Config> {
  const config: Partial<Config> = {};

  if (options.framework) config.framework = options.framework;
  if (options.styling) config.styling = options.styling;
  if (options.outputDir) config.outputDir = options.outputDir;
  if (options.verbose !== undefined) config.verbose = options.verbose;
  if (options.includeAssets !== undefined) config.includeAssets = options.includeAssets;
  if (options.interactive !== undefined) config.headless = !options.interactive;

  return config;
}

/**
 * Deep merge configs
 */
function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    ...base,
    ...override,
    llm: {
      ...base.llm,
      ...(override.llm || {}),
    },
    browser: {
      ...base.browser,
      ...(override.browser || {}),
      viewport: {
        ...base.browser.viewport,
        ...(override.browser?.viewport || {}),
      },
    },
  };
}
