/**
 * Element Extractor
 *
 * Extracts HTML elements from page with clean markup.
 */

import type { Page } from 'playwright';
import type { ExtractedElement } from '../types/index.ts';
import { StyleReducer } from './styleReducer.ts';
import { resolveAssets } from './assetResolver.ts';

/** Maximum recursion depth for style collection to prevent stack overflow */
const MAX_DEPTH = 10;

/** Regex patterns for HTML cleanup */
const REGEX_DATA_ATTRS = /\s+data-(?!testid)[a-z-]+="[^"]*"/gi;
const REGEX_EVENT_HANDLERS = /\s+(?:onclick|onmouseover|onmouseout|onfocus|onblur)="[^"]*"/gi;
const REGEX_STYLE_ATTRS = /\s+style="[^"]*"/gi;
const REGEX_EMPTY_CLASS = /\s+class=""/g;
const REGEX_WHITESPACE = /\s+/g;

/**
 * Extract element HTML and styles from page
 */
export async function extractElement(page: Page, selector: string): Promise<ExtractedElement> {
  // Get raw HTML and computed styles
  let rawData: {
    html: string;
    styles: Record<string, Record<string, string>>;
    tagName: string;
    classNames: string[];
    boundingBox: { x: number; y: number; width: number; height: number };
  };

  try {
    rawData = await page.evaluate(
      ({ sel, maxDepth }) => {
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        // Get outer HTML
        const html = element.outerHTML;

        // Get computed styles for element and all children
        const styles: Record<string, Record<string, string>> = {};

        function collectStyles(el: Element, path: string, depth: number): void {
          // Prevent excessive recursion
          if (depth >= maxDepth) {
            return;
          }

          const computed = window.getComputedStyle(el);
          const styleObj: Record<string, string> = {};

          for (let i = 0; i < computed.length; i++) {
            const prop = computed[i]!;
            styleObj[prop] = computed.getPropertyValue(prop);
          }

          styles[path] = styleObj;

          // Collect from children
          Array.from(el.children).forEach((child, index) => {
            collectStyles(child, `${path} > :nth-child(${index + 1})`, depth + 1);
          });
        }

        collectStyles(element, sel, 0);

        // Get bounding box
        const rect = element.getBoundingClientRect();

        return {
          html,
          styles,
          tagName: element.tagName.toLowerCase(),
          classNames: Array.from(element.classList),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        };
      },
      { sel: selector, maxDepth: MAX_DEPTH }
    );
  } catch (evalError) {
    throw new Error(`Failed to extract element "${selector}": ${evalError instanceof Error ? evalError.message : String(evalError)}`);
  }

  // Reduce styles
  const reducer = new StyleReducer();
  const reducedCss = reducer.reduce(rawData.styles);

  // Find assets in HTML
  const assets = await resolveAssets(page, selector);

  return {
    html: cleanHtml(rawData.html),
    css: reducedCss,
    tagName: rawData.tagName,
    classNames: rawData.classNames,
    assets,
    boundingBox: rawData.boundingBox,
  };
}

/**
 * Clean HTML by removing unnecessary attributes
 */
function cleanHtml(html: string): string {
  return (
    html
      // Remove data attributes (except data-testid which might be useful)
      .replace(REGEX_DATA_ATTRS, '')
      // Remove tracking attributes
      .replace(REGEX_EVENT_HANDLERS, '')
      // Remove style attributes (we extract styles separately)
      .replace(REGEX_STYLE_ATTRS, '')
      // Remove empty class attributes
      .replace(REGEX_EMPTY_CLASS, '')
      // Normalize whitespace
      .replace(REGEX_WHITESPACE, ' ')
      .trim()
  );
}
