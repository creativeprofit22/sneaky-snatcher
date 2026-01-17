/**
 * Element Extractor
 *
 * Extracts HTML elements from page with clean markup.
 */

import type { Page } from 'playwright';
import type { ExtractedElement, Asset } from '../types/index.js';
import { StyleReducer } from './styleReducer.js';
import { resolveAssets } from './assetResolver.js';

/**
 * Extract element HTML and styles from page
 */
export async function extractElement(page: Page, selector: string): Promise<ExtractedElement> {
  // Get raw HTML and computed styles
  const rawData = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) {
      throw new Error(`Element not found: ${sel}`);
    }

    // Get outer HTML
    const html = element.outerHTML;

    // Get computed styles for element and all children
    const styles: Record<string, Record<string, string>> = {};

    function collectStyles(el: Element, path: string): void {
      const computed = window.getComputedStyle(el);
      const styleObj: Record<string, string> = {};

      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i]!;
        styleObj[prop] = computed.getPropertyValue(prop);
      }

      styles[path] = styleObj;

      // Collect from children
      Array.from(el.children).forEach((child, index) => {
        collectStyles(child, `${path} > :nth-child(${index + 1})`);
      });
    }

    collectStyles(element, sel);

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
  }, selector);

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
      .replace(/\s+data-(?!testid)[a-z-]+="[^"]*"/gi, '')
      // Remove tracking attributes
      .replace(/\s+(?:onclick|onmouseover|onmouseout|onfocus|onblur)="[^"]*"/gi, '')
      // Remove style attributes (we extract styles separately)
      .replace(/\s+style="[^"]*"/gi, '')
      // Remove empty class attributes
      .replace(/\s+class=""/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}
