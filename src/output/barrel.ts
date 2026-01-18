/**
 * Barrel Export Generator
 *
 * Creates and updates index.ts files for component exports.
 */

import * as fs from 'fs/promises';

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

  // Simplified: split into header (comments/blank lines) and exports
  const lines = content.split('\n');
  const exportLines: string[] = [];
  const headerLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('export * from')) {
      exportLines.push(line);
    } else if (line.trim().startsWith('/*') || line.trim().startsWith('*') || line.trim().startsWith('//') || line.trim() === '') {
      // Only keep header lines before any exports
      if (exportLines.length === 0) {
        headerLines.push(line);
      }
    }
  }

  // Add new export and sort
  exportLines.push(exportLine);
  exportLines.sort();

  // Rebuild: header + blank line + sorted exports + trailing newline
  const header = headerLines.join('\n').trimEnd();
  const exports = exportLines.join('\n');
  const newContent = header + (header ? '\n\n' : '') + exports + '\n';

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
