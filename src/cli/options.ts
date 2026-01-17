/**
 * CLI Options Parser and Validator
 */

import type { SnatchOptions, Framework, Styling } from '../types/index.js';

const VALID_FRAMEWORKS: Framework[] = ['react', 'vue', 'svelte', 'html'];
const VALID_STYLING: Styling[] = ['tailwind', 'css-modules', 'vanilla', 'inline'];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate snatch options
 */
export function validateOptions(options: SnatchOptions): ValidationResult {
  const errors: string[] = [];

  // URL validation
  if (!options.url) {
    errors.push('URL is required');
  } else {
    try {
      new URL(options.url);
    } catch {
      // Try adding https://
      try {
        new URL(`https://${options.url}`);
      } catch {
        errors.push(`Invalid URL: ${options.url}`);
      }
    }
  }

  // Must have either selector or find
  if (!options.selector && !options.find) {
    errors.push('Either --selector or --find is required');
  }

  // Cannot have both selector and find
  if (options.selector && options.find) {
    errors.push('Cannot use both --selector and --find');
  }

  // Framework validation
  if (!VALID_FRAMEWORKS.includes(options.framework)) {
    errors.push(`Invalid framework: ${options.framework}. Valid: ${VALID_FRAMEWORKS.join(', ')}`);
  }

  // Styling validation
  if (!VALID_STYLING.includes(options.styling)) {
    errors.push(`Invalid styling: ${options.styling}. Valid: ${VALID_STYLING.join(', ')}`);
  }

  // Component name validation (if provided)
  if (options.componentName && !/^[A-Z][a-zA-Z0-9]*$/.test(options.componentName)) {
    errors.push('Component name must be PascalCase (e.g., MyComponent)');
  }

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
