/**
 * Config Loader
 *
 * Loads configuration from file, environment, and CLI.
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Framework, Styling, SnatchOptions, FileConfig, ConfigValidationError } from '../types/index.ts';
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
  const fileResult = await loadConfigFile();
  if (fileResult.errors.length > 0) {
    const errorMessages = fileResult.errors.map(e =>
      e.received !== undefined
        ? `${e.path}: ${e.message} (got: ${JSON.stringify(e.received)})`
        : `${e.path}: ${e.message}`
    );
    throw new Error(`Config file errors:\n  ${errorMessages.join('\n  ')}`);
  }
  if (fileResult.config) {
    config = mergeConfig(config, fileResult.config);
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
 * Load config from file - searches cwd first, then home dir
 */
async function loadConfigFile(): Promise<{ config: Partial<Config> | null; errors: ConfigValidationError[] }> {
  const searchPaths = [process.cwd(), homedir()];

  for (const dir of searchPaths) {
    for (const filename of CONFIG_FILES) {
      const filepath = join(dir, filename);
      if (existsSync(filepath)) {
        try {
          const content = await readFile(filepath, 'utf-8');
          const raw = JSON.parse(content);
          const validation = validateFileConfig(raw, filepath);

          if (validation.errors.length > 0) {
            return { config: null, errors: validation.errors };
          }

          return { config: fileConfigToConfig(validation.config), errors: [] };
        } catch (error) {
          if (error instanceof SyntaxError) {
            return {
              config: null,
              errors: [{
                path: filepath,
                message: `Invalid JSON: ${error.message}`,
              }],
            };
          }
          // File read error - continue to next file
        }
      }
    }
  }

  return { config: null, errors: [] };
}

/**
 * Validate file config schema
 */
export function validateFileConfig(raw: unknown, filepath: string): { config: FileConfig; errors: ConfigValidationError[] } {
  const errors: ConfigValidationError[] = [];
  const config: FileConfig = {};

  if (typeof raw !== 'object' || raw === null) {
    errors.push({ path: filepath, message: 'Config must be an object' });
    return { config, errors };
  }

  const obj = raw as Record<string, unknown>;

  // Validate framework
  if (obj.framework !== undefined) {
    if (typeof obj.framework !== 'string' || !SUPPORTED_FRAMEWORKS.includes(obj.framework as Framework)) {
      errors.push({
        path: 'framework',
        message: `Invalid framework. Expected one of: ${SUPPORTED_FRAMEWORKS.join(', ')}`,
        received: obj.framework,
      });
    } else {
      config.framework = obj.framework as Framework;
    }
  }

  // Validate styling
  if (obj.styling !== undefined) {
    if (typeof obj.styling !== 'string' || !SUPPORTED_STYLING.includes(obj.styling as Styling)) {
      errors.push({
        path: 'styling',
        message: `Invalid styling. Expected one of: ${SUPPORTED_STYLING.join(', ')}`,
        received: obj.styling,
      });
    } else {
      config.styling = obj.styling as Styling;
    }
  }

  // Validate outputDir
  if (obj.outputDir !== undefined) {
    if (typeof obj.outputDir !== 'string') {
      errors.push({ path: 'outputDir', message: 'outputDir must be a string', received: obj.outputDir });
    } else {
      config.outputDir = obj.outputDir;
    }
  }

  // Validate booleans
  for (const key of ['headless', 'includeAssets', 'verbose'] as const) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] !== 'boolean') {
        errors.push({ path: key, message: `${key} must be a boolean`, received: obj[key] });
      } else {
        config[key] = obj[key] as boolean;
      }
    }
  }

  // Validate llm config
  if (obj.llm !== undefined) {
    if (typeof obj.llm !== 'object' || obj.llm === null) {
      errors.push({ path: 'llm', message: 'llm must be an object' });
    } else {
      const llm = obj.llm as Record<string, unknown>;
      config.llm = {};

      if (llm.model !== undefined) {
        if (!['sonnet', 'opus', 'haiku'].includes(llm.model as string)) {
          errors.push({
            path: 'llm.model',
            message: 'llm.model must be one of: sonnet, opus, haiku',
            received: llm.model,
          });
        } else {
          config.llm.model = llm.model as 'sonnet' | 'opus' | 'haiku';
        }
      }

      if (llm.timeout !== undefined) {
        if (typeof llm.timeout !== 'number' || llm.timeout <= 0) {
          errors.push({ path: 'llm.timeout', message: 'llm.timeout must be a positive number', received: llm.timeout });
        } else {
          config.llm.timeout = llm.timeout;
        }
      }
    }
  }

  // Validate browser config
  if (obj.browser !== undefined) {
    if (typeof obj.browser !== 'object' || obj.browser === null) {
      errors.push({ path: 'browser', message: 'browser must be an object' });
    } else {
      const browser = obj.browser as Record<string, unknown>;
      config.browser = {};

      if (browser.timeout !== undefined) {
        if (typeof browser.timeout !== 'number' || browser.timeout <= 0) {
          errors.push({ path: 'browser.timeout', message: 'browser.timeout must be a positive number', received: browser.timeout });
        } else {
          config.browser.timeout = browser.timeout;
        }
      }

      if (browser.viewport !== undefined) {
        if (typeof browser.viewport !== 'object' || browser.viewport === null) {
          errors.push({ path: 'browser.viewport', message: 'browser.viewport must be an object' });
        } else {
          const vp = browser.viewport as Record<string, unknown>;
          config.browser.viewport = {};

          for (const dim of ['width', 'height'] as const) {
            if (vp[dim] !== undefined) {
              if (typeof vp[dim] !== 'number' || vp[dim] <= 0) {
                errors.push({ path: `browser.viewport.${dim}`, message: `browser.viewport.${dim} must be a positive number`, received: vp[dim] });
              } else {
                config.browser.viewport[dim] = vp[dim] as number;
              }
            }
          }
        }
      }
    }
  }

  return { config, errors };
}

/**
 * Convert FileConfig to internal Config format
 */
function fileConfigToConfig(fileConfig: FileConfig): Partial<Config> {
  const config: Partial<Config> = {};

  if (fileConfig.framework) config.framework = fileConfig.framework;
  if (fileConfig.styling) config.styling = fileConfig.styling;
  if (fileConfig.outputDir) config.outputDir = fileConfig.outputDir;
  if (fileConfig.headless !== undefined) config.headless = fileConfig.headless;
  if (fileConfig.includeAssets !== undefined) config.includeAssets = fileConfig.includeAssets;
  if (fileConfig.verbose !== undefined) config.verbose = fileConfig.verbose;

  if (fileConfig.llm) {
    config.llm = {} as Config['llm'];
    if (fileConfig.llm.model) config.llm.model = fileConfig.llm.model;
    if (fileConfig.llm.timeout) config.llm.timeout = fileConfig.llm.timeout;
  }

  if (fileConfig.browser) {
    config.browser = {} as Config['browser'];
    if (fileConfig.browser.timeout) config.browser.timeout = fileConfig.browser.timeout;
    if (fileConfig.browser.viewport) {
      config.browser.viewport = {} as Config['browser']['viewport'];
      if (fileConfig.browser.viewport.width) config.browser.viewport.width = fileConfig.browser.viewport.width;
      if (fileConfig.browser.viewport.height) config.browser.viewport.height = fileConfig.browser.viewport.height;
    }
  }

  return config;
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
