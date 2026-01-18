/**
 * Asset Management
 *
 * Downloads and organizes extracted assets.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Asset, DownloadedAsset } from '../types/index.ts';

/**
 * Single source of truth for extension-to-type mappings
 */
const EXTENSION_TYPE_MAP: Record<string, Asset['type']> = {
  // Images
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.avif': 'image',
  // Icons
  '.svg': 'icon',
  '.ico': 'icon',
  // Fonts
  '.woff': 'font',
  '.woff2': 'font',
  '.ttf': 'font',
  '.otf': 'font',
  '.eot': 'font',
};

/**
 * Default extensions for each asset type (for URL fallback)
 */
const DEFAULT_EXTENSIONS: Record<Asset['type'], string> = {
  image: 'png',
  icon: 'svg',
  font: 'woff2',
  background: 'png',
};

/** Valid MIME type prefixes for data URLs */
const VALID_DATA_URL_MIME_PREFIXES = [
  'image/',
  'font/',
  'application/font',
  'application/x-font',
  'application/octet-stream',
] as const;

/** Default asset size limits in bytes */
export const DEFAULT_ASSET_SIZE_LIMITS: Record<Asset['type'], number> = {
  image: 10 * 1024 * 1024,      // 10 MB
  icon: 1 * 1024 * 1024,        // 1 MB
  font: 5 * 1024 * 1024,        // 5 MB
  background: 10 * 1024 * 1024, // 10 MB
};

/** Options for asset downloading */
export interface AssetDownloadOptions {
  /** Maximum size in bytes per asset type. Set to 0 to disable limit for that type. */
  sizeLimits?: Partial<Record<Asset['type'], number>>;
  /** Skip assets that exceed size limits instead of throwing (default: true) */
  skipOversized?: boolean;
}

/**
 * Validate data URL has proper mime type prefix
 */
function validateDataUrlMimeType(url: string): boolean {
  const mimeMatch = url.match(/^data:([^;,]+)/);
  if (!mimeMatch?.[1]) {
    return false;
  }
  const mimeType = mimeMatch[1].toLowerCase();
  return VALID_DATA_URL_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
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
 * Extract filename from URL (consolidated source of truth)
 */
export function extractFilenameFromUrl(url: string, assetType?: Asset['type']): string {
  // Handle data URLs
  if (url.startsWith('data:')) {
    const mimeMatch = url.match(/data:([^;,]+)/);
    const ext = mimeMatch?.[1]?.split('/')[1] || 'bin';
    return `asset-${Date.now()}.${ext}`;
  }

  // Parse URL and extract filename
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const basename = pathname.split('/').pop();

    if (basename && basename.includes('.')) {
      return sanitizeFilename(basename);
    }

    // Fallback with type-based extension (using consolidated mapping)
    const ext = assetType ? DEFAULT_EXTENSIONS[assetType] : 'png';
    return `${basename || 'asset'}-${Date.now()}.${ext}`;
  } catch {
    return `asset-${Date.now()}.png`;
  }
}

/**
 * Get the size limit for an asset type
 */
function getSizeLimit(
  assetType: Asset['type'],
  customLimits?: Partial<Record<Asset['type'], number>>
): number {
  if (customLimits && assetType in customLimits) {
    return customLimits[assetType]!;
  }
  return DEFAULT_ASSET_SIZE_LIMITS[assetType];
}

/**
 * Download all assets to output directory
 */
export async function downloadAssets(
  assets: Asset[],
  outputDir: string,
  options: AssetDownloadOptions = {}
): Promise<DownloadedAsset[]> {
  const { sizeLimits, skipOversized = true } = options;
  const downloaded: DownloadedAsset[] = [];
  const assetDir = path.join(outputDir, 'assets');

  // Ensure asset directory exists
  await fs.mkdir(assetDir, { recursive: true });

  for (const asset of assets) {
    try {
      const limit = getSizeLimit(asset.type, sizeLimits);
      const result = await downloadSingleAsset(asset, assetDir, limit);
      downloaded.push(result);
    } catch (error) {
      if (error instanceof AssetSizeExceededError) {
        if (skipOversized) {
          console.warn(`Skipping oversized asset: ${error.message}`);
          continue;
        }
        throw error;
      }
      console.warn(`Failed to download asset: ${asset.url}`, error);
    }
  }

  return downloaded;
}

/**
 * Error thrown when an asset exceeds its size limit
 */
export class AssetSizeExceededError extends Error {
  constructor(
    public readonly url: string,
    public readonly size: number,
    public readonly limit: number,
    public readonly assetType: Asset['type']
  ) {
    super(
      `Asset exceeds size limit: ${url} is ${formatBytes(size)} but limit for ${assetType} is ${formatBytes(limit)}`
    );
    this.name = 'AssetSizeExceededError';
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Write file atomically to avoid race conditions on collision
 * Writes to temp file first, then renames
 */
async function atomicWriteFile(targetPath: string, data: Buffer): Promise<string> {
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);

  // Check if file exists, append UUID if collision
  let finalPath = targetPath;
  try {
    await fs.access(targetPath);
    // File exists, create unique name
    finalPath = path.join(dir, `${base}-${randomUUID().slice(0, 8)}${ext}`);
  } catch {
    // File doesn't exist, use original path
  }

  // Write to temp file first, then rename (atomic on most filesystems)
  const tempPath = path.join(dir, `.tmp-${randomUUID()}`);
  await fs.writeFile(tempPath, data);
  await fs.rename(tempPath, finalPath);

  return finalPath;
}

/**
 * Download single asset
 * @param sizeLimit Maximum allowed size in bytes (0 = no limit)
 */
async function downloadSingleAsset(
  asset: Asset,
  outputDir: string,
  sizeLimit: number = 0
): Promise<DownloadedAsset> {
  const filename = asset.filename || extractFilenameFromUrl(asset.url, asset.type);
  const targetPath = path.join(outputDir, filename);

  // Handle data URLs
  if (asset.url.startsWith('data:')) {
    // Validate mime type
    if (!validateDataUrlMimeType(asset.url)) {
      throw new Error(`Invalid data URL for ${filename}: missing or unsupported mime type`);
    }

    const base64Data = asset.url.split(',')[1];
    if (!base64Data) {
      throw new Error(`Invalid data URL for ${filename}: missing base64 data`);
    }
    const buffer = Buffer.from(base64Data, 'base64');

    // Check size limit for data URLs
    if (sizeLimit > 0 && buffer.length > sizeLimit) {
      throw new AssetSizeExceededError(
        asset.url.substring(0, 50) + '...',
        buffer.length,
        sizeLimit,
        asset.type
      );
    }

    let localPath: string;
    try {
      localPath = await atomicWriteFile(targetPath, buffer);
    } catch (writeError) {
      throw new Error(`Failed to write data URL asset ${filename}: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
    }
    return {
      originalUrl: asset.url,
      localPath,
      size: buffer.length,
    };
  }

  // Download from URL
  let response: Response;
  try {
    response = await fetch(asset.url);
  } catch (fetchError) {
    throw new Error(`Failed to fetch asset ${asset.url}: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for URL: ${asset.url}`);
  }

  // Check Content-Length header before downloading full body (when available)
  const contentLength = response.headers.get('content-length');
  if (sizeLimit > 0 && contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > sizeLimit) {
      throw new AssetSizeExceededError(asset.url, size, sizeLimit, asset.type);
    }
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Check actual size (Content-Length may be missing or inaccurate)
  if (sizeLimit > 0 && buffer.length > sizeLimit) {
    throw new AssetSizeExceededError(asset.url, buffer.length, sizeLimit, asset.type);
  }

  let localPath: string;
  try {
    localPath = await atomicWriteFile(targetPath, buffer);
  } catch (writeError) {
    throw new Error(`Failed to write asset ${filename}: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
  }

  return {
    originalUrl: asset.url,
    localPath,
    size: buffer.length,
  };
}

/**
 * Organize assets by type
 */
export async function organizeAssets(
  assets: DownloadedAsset[],
  outputDir: string
): Promise<Map<Asset['type'], string[]>> {
  // Input validation
  if (!Array.isArray(assets)) {
    throw new Error('organizeAssets: assets must be an array');
  }
  if (typeof outputDir !== 'string' || outputDir.trim() === '') {
    throw new Error('organizeAssets: outputDir must be a non-empty string');
  }

  const organized = new Map<Asset['type'], string[]>();
  const types: Asset['type'][] = ['image', 'icon', 'font', 'background'];

  for (const type of types) {
    const typeDir = path.join(outputDir, 'assets', type + 's');
    await fs.mkdir(typeDir, { recursive: true });
    organized.set(type, []);
  }

  for (const asset of assets) {
    // Validate each asset has required localPath
    if (!asset?.localPath || typeof asset.localPath !== 'string') {
      console.warn('Skipping invalid asset: missing localPath');
      continue;
    }

    const type = detectAssetType(asset.localPath);
    const typeDir = path.join(outputDir, 'assets', type + 's');
    const newPath = path.join(typeDir, path.basename(asset.localPath));

    try {
      await fs.rename(asset.localPath, newPath);
      organized.get(type)?.push(newPath);
    } catch (error) {
      console.warn(`Failed to organize asset ${asset.localPath}:`, error);
    }
  }

  return organized;
}

/**
 * Detect asset type from path/extension (uses consolidated EXTENSION_TYPE_MAP)
 */
function detectAssetType(filepath: string): Asset['type'] {
  const ext = path.extname(filepath).toLowerCase();
  return EXTENSION_TYPE_MAP[ext] || 'image';
}
