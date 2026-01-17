/**
 * Style Reducer
 *
 * Reduces computed CSS by 70-90% by removing:
 * - Browser default values
 * - Inherited styles
 * - Vendor prefixes
 * - Redundant properties
 *
 * Ported from sneaky-rat's StyleReducer.
 */

import type { StyleReducerOptions } from '../types/index.js';

// Browser default values to filter out
const BROWSER_DEFAULTS: Record<string, string[]> = {
  display: ['inline', 'block'], // Depends on element
  position: ['static'],
  visibility: ['visible'],
  opacity: ['1'],
  overflow: ['visible'],
  'overflow-x': ['visible'],
  'overflow-y': ['visible'],
  float: ['none'],
  clear: ['none'],
  'z-index': ['auto'],
  'vertical-align': ['baseline'],
  'text-align': ['start', 'left'],
  'text-decoration': ['none'],
  'text-transform': ['none'],
  'white-space': ['normal'],
  'word-break': ['normal'],
  'word-wrap': ['normal'],
  'font-style': ['normal'],
  'font-weight': ['400', 'normal'],
  'font-stretch': ['normal'],
  'letter-spacing': ['normal'],
  'line-height': ['normal'],
  'list-style-type': ['disc', 'none'],
  'list-style-position': ['outside'],
  'border-style': ['none'],
  'border-width': ['0px'],
  'border-color': ['currentcolor'],
  'background-color': ['transparent', 'rgba(0, 0, 0, 0)'],
  'background-image': ['none'],
  'background-repeat': ['repeat'],
  'background-position': ['0% 0%', '0px 0px'],
  'background-size': ['auto', 'auto auto'],
  cursor: ['auto'],
  'pointer-events': ['auto'],
  'box-shadow': ['none'],
  'text-shadow': ['none'],
  transform: ['none'],
  transition: ['none', 'all 0s ease 0s'],
  animation: ['none'],
  filter: ['none'],
  'backdrop-filter': ['none'],
  'mix-blend-mode': ['normal'],
  isolation: ['auto'],
};

// Properties that are inherited by default
const INHERITED_PROPERTIES = new Set([
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'letter-spacing',
  'line-height',
  'text-align',
  'text-indent',
  'text-transform',
  'white-space',
  'word-spacing',
  'direction',
  'visibility',
  'cursor',
  'list-style',
  'list-style-type',
  'list-style-position',
  'list-style-image',
  'quotes',
]);

// Vendor prefixes to remove
const VENDOR_PREFIXES = ['-webkit-', '-moz-', '-ms-', '-o-'];

// Properties to always keep
const ESSENTIAL_PROPERTIES = new Set([
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'flex',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-self',
  'gap',
  'grid',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'border',
  'border-radius',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'text-align',
  'box-shadow',
  'transform',
  'transition',
  'opacity',
  'z-index',
  'overflow',
]);

const DEFAULT_OPTIONS: StyleReducerOptions = {
  removeInherited: false,
  removeVendorPrefixes: true,
  useShorthand: true,
  removeDefaults: true,
};

export class StyleReducer {
  private options: StyleReducerOptions;

  constructor(options: Partial<StyleReducerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Reduce styles object to minimal CSS
   */
  reduce(styles: Record<string, Record<string, string>>): string {
    const cssRules: string[] = [];

    for (const [selector, properties] of Object.entries(styles)) {
      const reducedProps = this.reduceProperties(properties);

      if (Object.keys(reducedProps).length > 0) {
        const rule = this.formatRule(selector, reducedProps);
        cssRules.push(rule);
      }
    }

    return cssRules.join('\n\n');
  }

  /**
   * Reduce individual property set
   */
  private reduceProperties(properties: Record<string, string>): Record<string, string> {
    const reduced: Record<string, string> = {};

    for (const [prop, value] of Object.entries(properties)) {
      // Skip vendor prefixed properties
      if (this.options.removeVendorPrefixes && this.isVendorPrefixed(prop)) {
        continue;
      }

      // Skip browser defaults
      if (this.options.removeDefaults && this.isDefault(prop, value)) {
        continue;
      }

      // Skip inherited properties (optional)
      if (this.options.removeInherited && INHERITED_PROPERTIES.has(prop)) {
        continue;
      }

      // Only keep essential properties
      if (ESSENTIAL_PROPERTIES.has(prop) || this.hasVisualImpact(prop, value)) {
        reduced[prop] = value;
      }
    }

    // Convert to shorthand if enabled
    if (this.options.useShorthand) {
      return this.convertToShorthand(reduced);
    }

    return reduced;
  }

  /**
   * Check if property has vendor prefix
   */
  private isVendorPrefixed(prop: string): boolean {
    return VENDOR_PREFIXES.some((prefix) => prop.startsWith(prefix));
  }

  /**
   * Check if value is browser default
   */
  private isDefault(prop: string, value: string): boolean {
    const defaults = BROWSER_DEFAULTS[prop];
    if (!defaults) return false;

    return defaults.includes(value.toLowerCase());
  }

  /**
   * Check if property has visual impact
   */
  private hasVisualImpact(prop: string, value: string): boolean {
    // Non-default backgrounds
    if (prop.startsWith('background') && value !== 'none' && value !== 'transparent') {
      return true;
    }

    // Non-default borders
    if (prop.startsWith('border') && !value.includes('0px') && value !== 'none') {
      return true;
    }

    // Shadows
    if ((prop === 'box-shadow' || prop === 'text-shadow') && value !== 'none') {
      return true;
    }

    return false;
  }

  /**
   * Convert longhand properties to shorthand
   */
  private convertToShorthand(properties: Record<string, string>): Record<string, string> {
    const result = { ...properties };

    // Margin shorthand
    if (
      result['margin-top'] &&
      result['margin-right'] &&
      result['margin-bottom'] &&
      result['margin-left']
    ) {
      result['margin'] =
        `${result['margin-top']} ${result['margin-right']} ${result['margin-bottom']} ${result['margin-left']}`;
      delete result['margin-top'];
      delete result['margin-right'];
      delete result['margin-bottom'];
      delete result['margin-left'];
    }

    // Padding shorthand
    if (
      result['padding-top'] &&
      result['padding-right'] &&
      result['padding-bottom'] &&
      result['padding-left']
    ) {
      result['padding'] =
        `${result['padding-top']} ${result['padding-right']} ${result['padding-bottom']} ${result['padding-left']}`;
      delete result['padding-top'];
      delete result['padding-right'];
      delete result['padding-bottom'];
      delete result['padding-left'];
    }

    return result;
  }

  /**
   * Format CSS rule
   */
  private formatRule(selector: string, properties: Record<string, string>): string {
    const props = Object.entries(properties)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n');

    return `${selector} {\n${props}\n}`;
  }
}
