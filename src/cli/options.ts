/**
 * CLI Options Parser and Validator
 */

import type { SnatchOptions, Framework, Styling, BatchConfig, BatchComponent } from '../types/index.ts';
import { readFileSync, existsSync } from 'fs';

const VALID_FRAMEWORKS: Framework[] = ['react', 'vue', 'svelte', 'html'];
const VALID_STYLING: Styling[] = ['tailwind', 'css-modules', 'vanilla', 'inline'];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate URL format
 */
function validateUrl(url: string | undefined): string | null {
  if (!url) {
    return 'URL is required';
  }

  if (url.trim() === '') {
    return 'URL cannot be empty';
  }

  // Check for common typos and malformed URLs
  if (url.includes(' ')) {
    return `Invalid URL: "${url}" contains spaces. URLs cannot contain spaces.`;
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return `Invalid URL protocol: "${parsed.protocol}". Only http:// and https:// are supported.`;
    }
    return null;
  } catch {
    // Try adding https:// prefix
    try {
      const parsed = new URL(`https://${url}`);
      if (!parsed.hostname.includes('.')) {
        return `Invalid URL: "${url}" is missing a domain extension (e.g., .com, .org)`;
      }
      return null;
    } catch {
      // Provide specific error for common issues
      if (!url.includes('.')) {
        return `Invalid URL: "${url}" is missing a domain extension (e.g., .com, .org)`;
      }
      if (url.startsWith('.') || url.endsWith('.')) {
        return `Invalid URL: "${url}" has misplaced dots`;
      }
      return `Invalid URL: "${url}" is not a valid web address`;
    }
  }
}

/**
 * Validate selector mode options
 */
function validateSelectorMode(options: SnatchOptions): string | null {
  const hasSelector = Boolean(options.selector);
  const hasFind = Boolean(options.find);
  const hasInteractive = Boolean(options.interactive);

  if (!hasSelector && !hasFind && !hasInteractive) {
    return 'Either --selector, --find, or --interactive is required';
  }
  if (hasSelector && hasFind) {
    return 'Cannot use both --selector and --find';
  }
  if (hasInteractive && (hasSelector || hasFind)) {
    return '--interactive cannot be used with --selector or --find';
  }
  return null;
}

/**
 * Validate framework option
 */
function validateFramework(framework: Framework): string | null {
  if (!VALID_FRAMEWORKS.includes(framework)) {
    return `Invalid framework: ${framework}. Valid: ${VALID_FRAMEWORKS.join(', ')}`;
  }
  return null;
}

/**
 * Validate styling option
 */
function validateStyling(styling: Styling): string | null {
  if (!VALID_STYLING.includes(styling)) {
    return `Invalid styling: ${styling}. Valid: ${VALID_STYLING.join(', ')}`;
  }
  return null;
}

/**
 * Validate component name format
 */
function validateComponentName(name: string | undefined): string | null {
  if (name && !/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    return 'Component name must be PascalCase (e.g., MyComponent)';
  }
  return null;
}

/**
 * Validate snatch options
 */
export function validateOptions(options: SnatchOptions): ValidationResult {
  const validators = [
    () => validateUrl(options.url),
    () => validateSelectorMode(options),
    () => validateFramework(options.framework),
    () => validateStyling(options.styling),
    () => validateComponentName(options.componentName),
  ];

  const errors = validators
    .map((validate) => validate())
    .filter((error): error is string => error !== null);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse and normalize options
 */
export function parseOptions(raw: Record<string, unknown>): Partial<SnatchOptions> {
  return {
    url: String(raw.url || ''),
    selector: raw.selector ? String(raw.selector) : undefined,
    find: raw.find ? String(raw.find) : undefined,
    framework: parseFramework(raw.framework),
    styling: parseStyling(raw.styling),
    outputDir: String(raw.output || raw.outputDir || './components'),
    componentName: raw.name ? String(raw.name) : undefined,
    interactive: Boolean(raw.interactive),
    includeAssets: Boolean(raw.assets || raw.includeAssets),
    verbose: Boolean(raw.verbose),
    generateStories: Boolean(raw.stories || raw.generateStories),
  };
}

function parseFramework(value: unknown): Framework {
  const str = String(value || 'react').toLowerCase();
  if (VALID_FRAMEWORKS.includes(str as Framework)) {
    return str as Framework;
  }
  return 'react';
}

function parseStyling(value: unknown): Styling {
  const str = String(value || 'tailwind').toLowerCase();
  if (VALID_STYLING.includes(str as Styling)) {
    return str as Styling;
  }
  return 'tailwind';
}

/**
 * Normalize URL (add https if missing)
 */
export function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

// ============================================================================
// Batch Config Validation
// ============================================================================

interface BatchValidationResult {
  valid: boolean;
  errors: string[];
  config?: BatchConfig;
}

/**
 * Load and validate a batch config file
 */
export function loadBatchConfig(filePath: string): BatchValidationResult {
  const errors: string[] = [];

  // Check file exists
  if (!existsSync(filePath)) {
    return { valid: false, errors: [`Batch file not found: ${filePath}`] };
  }

  // Read and parse JSON
  let raw: unknown;
  try {
    const content = readFileSync(filePath, 'utf-8');
    raw = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, errors: [`Failed to parse batch file: ${message}`] };
  }

  // Validate structure
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Batch config must be an object'] };
  }

  const config = raw as Record<string, unknown>;

  // Validate components array
  if (!Array.isArray(config.components)) {
    return { valid: false, errors: ['Batch config must have a "components" array'] };
  }

  if (config.components.length === 0) {
    return { valid: false, errors: ['Batch config "components" array cannot be empty'] };
  }

  // Validate each component
  const components: BatchComponent[] = [];
  for (let i = 0; i < config.components.length; i++) {
    const comp = config.components[i];
    const prefix = `components[${i}]`;

    if (typeof comp !== 'object' || comp === null) {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    const c = comp as Record<string, unknown>;

    // Required: url and name
    if (typeof c.url !== 'string' || c.url.trim() === '') {
      errors.push(`${prefix}: "url" is required`);
    }
    if (typeof c.name !== 'string' || c.name.trim() === '') {
      errors.push(`${prefix}: "name" is required`);
    }

    // Must have selector or find
    if (!c.selector && !c.find) {
      errors.push(`${prefix}: either "selector" or "find" is required`);
    }
    if (c.selector && c.find) {
      errors.push(`${prefix}: cannot have both "selector" and "find"`);
    }

    // Validate name format
    if (typeof c.name === 'string' && !/^[A-Z][a-zA-Z0-9]*$/.test(c.name)) {
      errors.push(`${prefix}: "name" must be PascalCase (e.g., MyComponent)`);
    }

    // Validate optional framework
    if (c.framework !== undefined && !VALID_FRAMEWORKS.includes(c.framework as Framework)) {
      errors.push(`${prefix}: invalid framework "${c.framework}"`);
    }

    // Validate optional styling
    if (c.styling !== undefined && !VALID_STYLING.includes(c.styling as Styling)) {
      errors.push(`${prefix}: invalid styling "${c.styling}"`);
    }

    if (errors.length === 0) {
      components.push({
        url: String(c.url),
        selector: c.selector ? String(c.selector) : undefined,
        find: c.find ? String(c.find) : undefined,
        name: String(c.name),
        framework: c.framework as Framework | undefined,
        styling: c.styling as Styling | undefined,
        outputDir: c.outputDir ? String(c.outputDir) : undefined,
        includeAssets: c.includeAssets !== undefined ? Boolean(c.includeAssets) : undefined,
      });
    }
  }

  // Validate defaults (optional)
  let defaults = config.defaults as BatchConfig['defaults'];
  if (config.defaults !== undefined) {
    if (typeof config.defaults !== 'object' || config.defaults === null) {
      errors.push('"defaults" must be an object');
      defaults = undefined;
    } else {
      const d = config.defaults as Record<string, unknown>;
      if (d.framework !== undefined && !VALID_FRAMEWORKS.includes(d.framework as Framework)) {
        errors.push(`defaults: invalid framework "${d.framework}"`);
      }
      if (d.styling !== undefined && !VALID_STYLING.includes(d.styling as Styling)) {
        errors.push(`defaults: invalid styling "${d.styling}"`);
      }
      defaults = {
        framework: d.framework as Framework | undefined,
        styling: d.styling as Styling | undefined,
        outputDir: d.outputDir ? String(d.outputDir) : undefined,
        includeAssets: d.includeAssets !== undefined ? Boolean(d.includeAssets) : undefined,
      };
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    config: { components, defaults },
  };
}
