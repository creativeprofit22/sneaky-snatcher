/**
 * Asset Management
 *
 * Downloads and organizes extracted assets.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Asset, DownloadedAsset } from '../types/index.js';

/**
 * Download all assets to output directory
 */
export async function downloadAssets(
  assets: Asset[],
  outputDir: string
): Promise<DownloadedAsset[]> {
  const downloaded: DownloadedAsset[] = [];
  const assetDir = path.join(outputDir, 'assets');

  // Ensure asset directory exists
  await fs.mkdir(assetDir, { recursive: true });

  for (const asset of assets) {
    try {
      const result = await downloadSingleAsset(asset, assetDir);
      downloaded.push(result);
    } catch (error) {
      console.warn(`Failed to download asset: ${asset.url}`, error);
    }
  }

  return downloaded;
}

/**
 * Download single asset
 */
async function downloadSingleAsset(asset: Asset, outputDir: string): Promise<DownloadedAsset> {
  const filename = asset.filename || generateFilename(asset.url, asset.type);
  const localPath = path.join(outputDir, filename);

  // Handle data URLs
  if (asset.url.startsWith('data:')) {
    const base64Data = asset.url.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL');
    }
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(localPath, buffer);
    return {
      originalUrl: asset.url,
      localPath,
      size: buffer.length,
    };
  }

  // Download from URL
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(localPath, buffer);

  return {
    originalUrl: asset.url,
    localPath,
    size: buffer.length,
  };
}

/**
 * Generate filename for asset
 */
function generateFilename(url: string, type: Asset['type']): string {
  const extensions: Record<Asset['type'], string> = {
    image: 'png',
    icon: 'svg',
    font: 'woff2',
    background: 'png',
  };

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const basename = pathname.split('/').pop();

    if (basename && basename.includes('.')) {
      return sanitizeFilename(basename);
    }
  } catch {
    // Invalid URL, use fallback
  }

  return `${type}-${Date.now()}.${extensions[type]}`;
}

/**
 * Sanitize filename for filesystem
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

/**
 * Organize assets by type
 */
export async function organizeAssets(
  assets: DownloadedAsset[],
  outputDir: string
): Promise<Map<Asset['type'], string[]>> {
  const organized = new Map<Asset['type'], string[]>();
  const types: Asset['type'][] = ['image', 'icon', 'font', 'background'];

  for (const type of types) {
    const typeDir = path.join(outputDir, 'assets', type + 's');
    await fs.mkdir(typeDir, { recursive: true });
    organized.set(type, []);
  }

  for (const asset of assets) {
    const type = detectAssetType(asset.localPath);
    const typeDir = path.join(outputDir, 'assets', type + 's');
    const newPath = path.join(typeDir, path.basename(asset.localPath));

    await fs.rename(asset.localPath, newPath);
    organized.get(type)?.push(newPath);
  }

  return organized;
}

/**
 * Detect asset type from path/extension
 */
function detectAssetType(filepath: string): Asset['type'] {
  const ext = path.extname(filepath).toLowerCase();

  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'];
  const iconExts = ['.svg', '.ico'];
  const fontExts = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];

  if (imageExts.includes(ext)) return 'image';
  if (iconExts.includes(ext)) return 'icon';
  if (fontExts.includes(ext)) return 'font';

  return 'image'; // Default
}
