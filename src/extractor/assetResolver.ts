/**
 * Asset Resolver
 *
 * Finds and downloads assets (images, fonts, icons) referenced by elements.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import type { Asset } from '../types/index.ts';

/**
 * Find all assets referenced by element and its children
 */
export async function resolveAssets(page: Page, selector: string): Promise<Asset[]> {
  const assets = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return [];

    const found: Array<{ type: string; url: string }> = [];
    const baseUrl = window.location.origin;

    function resolveUrl(url: string): string {
      if (url.startsWith('data:')) return url;
      if (url.startsWith('http')) return url;
      if (url.startsWith('//')) return `https:${url}`;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return `${baseUrl}/${url}`;
    }

    function collectFromElement(el: Element): void {
      // Images
      if (el instanceof HTMLImageElement && el.src) {
        found.push({ type: 'image', url: resolveUrl(el.src) });
      }

      // SVG use elements
      if (el instanceof SVGUseElement) {
        const href = el.getAttribute('href') || el.getAttribute('xlink:href');
        if (href && !href.startsWith('#')) {
          found.push({ type: 'icon', url: resolveUrl(href) });
        }
      }

      // Background images from computed styles
      const computed = window.getComputedStyle(el);
      const bgImage = computed.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (urlMatch?.[1] && !urlMatch[1].startsWith('data:')) {
          found.push({ type: 'background', url: resolveUrl(urlMatch[1]) });
        }
      }

      // Recurse into children
      Array.from(el.children).forEach(collectFromElement);
    }

    collectFromElement(element);

    return found;
  }, selector);

  return assets.map((a) => ({
    type: a.type as Asset['type'],
    url: a.url,
    filename: extractFilename(a.url),
  }));
}

/**
 * Extract filename from URL
 */
function extractFilename(url: string): string {
  if (url.startsWith('data:')) {
    // Generate name for data URLs
    const mimeMatch = url.match(/data:([^;,]+)/);
    const ext = mimeMatch?.[1]?.split('/')[1] || 'bin';
    return `asset-${Date.now()}.${ext}`;
  }

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'asset';

    // Ensure filename has extension
    if (!filename.includes('.')) {
      return `${filename}.png`;
    }

    return filename;
  } catch {
    return `asset-${Date.now()}.png`;
  }
}

/**
 * Download asset to local path
 */
export async function downloadAsset(
  url: string,
  outputDir: string,
  filename?: string
): Promise<{ localPath: string; size: number }> {
  // Skip data URLs
  if (url.startsWith('data:')) {
    const base64Data = url.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const finalFilename = filename || extractFilename(url);
    const localPath = path.join(outputDir, finalFilename);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(localPath, buffer);

    return { localPath, size: buffer.length };
  }

  // Download from URL
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const finalFilename = filename || extractFilename(url);
  const localPath = path.join(outputDir, finalFilename);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(localPath, buffer);

  return { localPath, size: buffer.length };
}
