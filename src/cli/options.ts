/**
 * CLI Options Parser and Validator
 */

import type { SnatchOptions, Framework, Styling } from '../types/index.ts';

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
