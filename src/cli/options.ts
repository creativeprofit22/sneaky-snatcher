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
  try {
    new URL(url);
    return null;
  } catch {
    try {
      new URL(`https://${url}`);
      return null;
    } catch {
      return `Invalid URL: ${url}`;
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
