/**
 * Barrel Export Generator
 *
 * Creates and updates index.ts files for component exports.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Generate new index file content
 */
export function generateIndex(components: string[]): string {
  if (components.length === 0) {
    return '// No components yet\n';
  }

  const exports = components
    .sort()
    .map((name) => `export * from './${name}/index.js';`)
    .join('\n');

  return `/**
 * Auto-generated barrel export
 * Do not edit manually - managed by Sneaky Snatcher
 */

${exports}
`;
}

/**
 * Update existing index file with new component
 */
export async function updateIndex(indexPath: string, componentName: string): Promise<void> {
  let content = '';

  try {
    content = await fs.readFile(indexPath, 'utf-8');
  } catch {
    // File doesn't exist
    content = `/**
 * Auto-generated barrel export
 * Do not edit manually - managed by Sneaky Snatcher
 */

`;
  }

  const exportLine = `export * from './${componentName}/index.js';`;

  // Check if already exported
  if (content.includes(exportLine)) {
    return;
  }

  // Find insertion point (keep alphabetical order)
  const lines = content.split('\n');
  const exportLines = lines.filter((line) => line.startsWith('export * from'));
  const otherLines = lines.filter((line) => !line.startsWith('export * from'));

  exportLines.push(exportLine);
  exportLines.sort();

  const newContent = [
    ...otherLines.filter((line) => line.trim() || otherLines.indexOf(line) < otherLines.length - 1),
    '',
    ...exportLines,
    '',
  ].join('\n');

  await fs.writeFile(indexPath, newContent, 'utf-8');
}

/**
 * Remove component from index
 */
export async function removeFromIndex(indexPath: string, componentName: string): Promise<void> {
  try {
    let content = await fs.readFile(indexPath, 'utf-8');
    const exportLine = `export * from './${componentName}/index.js';`;

    content = content
      .split('\n')
      .filter((line) => line !== exportLine)
      .join('\n');

    await fs.writeFile(indexPath, content, 'utf-8');
  } catch {
    // File doesn't exist, nothing to remove
  }
}

/**
 * List all exported components
 */
export async function listExports(indexPath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    const matches = content.matchAll(/export \* from '\.\/([^/]+)\/index\.js';/g);

    return Array.from(matches, (m) => m[1]!);
  } catch {
    return [];
  }
}
