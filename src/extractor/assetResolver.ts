/**
 * Asset Resolver
 *
 * Finds assets (images, fonts, icons) referenced by elements.
 * Download logic is delegated to output/assets.ts.
 */

import type { Page } from 'playwright';
import type { Asset } from '../types/index.ts';
import { extractFilenameFromUrl } from '../output/assets.ts';

/**
 * Find all assets referenced by element and its children.
 *
 * Collects:
 * - Images: <img> elements with src attribute
 * - Icons: <use> elements with href/xlink:href (external SVG sprites)
 * - Backgrounds: Elements with CSS background-image (excluding data URLs)
 */
export async function resolveAssets(page: Page, selector: string): Promise<Asset[]> {
  const assets = await page.evaluate(({ sel }) => {
    const element = document.querySelector(sel);
    if (!element) return [];

    const found: Array<{ type: string; url: string }> = [];
    const baseUrl = window.location.origin;

    // URL resolver - converts relative URLs to absolute
    function resolveUrl(url: string): string {
      if (url.startsWith('data:')) return url;
      if (url.startsWith('http')) return url;
      if (url.startsWith('//')) return `https:${url}`;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return `${baseUrl}/${url}`;
    }

    // Collect images from element
    function collectImages(el: Element): void {
      if (el instanceof HTMLImageElement && el.src) {
        found.push({ type: 'image', url: resolveUrl(el.src) });
      }
    }

    // Collect icons from SVG use elements
    function collectIcons(el: Element): void {
      if (el instanceof SVGUseElement) {
        const href = el.getAttribute('href') || el.getAttribute('xlink:href');
        if (href && !href.startsWith('#')) {
          found.push({ type: 'icon', url: resolveUrl(href) });
        }
      }
    }

    // Collect background images from computed styles
    // Handles multiple backgrounds (comma-separated) and various URL formats
    function collectBackgrounds(el: Element): void {
      const computed = window.getComputedStyle(el);
      const bgImage = computed.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        // Match all url() patterns, handling:
        // - Single and double quotes: url("..."), url('...'), url(...)
        // - Escaped quotes within URLs
        // - Multiple backgrounds: url(...), url(...)
        const urlRegex = /url\(\s*(?:["']([^"']+)["']|([^)]+))\s*\)/gi;
        let match;
        while ((match = urlRegex.exec(bgImage)) !== null) {
          // Use quoted value (group 1) or unquoted value (group 2)
          const url = (match[1] || match[2] || '').trim();
          if (url && !url.startsWith('data:')) {
            found.push({ type: 'background', url: resolveUrl(url) });
          }
        }
      }
    }

    // Recursively collect from element and children
    function collectFromElement(el: Element): void {
      collectImages(el);
      collectIcons(el);
      collectBackgrounds(el);

      // Recurse into children
      Array.from(el.children).forEach(collectFromElement);
    }

    collectFromElement(element);

    return found;
  }, { sel: selector });

  return assets.map((a) => ({
    type: a.type as Asset['type'],
    url: a.url,
    filename: extractFilenameFromUrl(a.url),
  }));
}
