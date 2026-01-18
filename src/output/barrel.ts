/**
 * Barrel Export Generator
 *
 * Creates and updates index.ts files for component exports.
 */

import * as fs from 'fs/promises';

/**
 * Validate component name follows conventions:
 * - Starts with a letter (uppercase or lowercase)
 * - Contains only alphanumeric characters, hyphens, and underscores
 * - Not empty
 */
export function validateComponentName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Component name must be a non-empty string' };
  }

  if (!/^[a-zA-Z]/.test(name)) {
    return { valid: false, error: `Component name must start with a letter: "${name}"` };
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return { valid: false, error: `Component name contains invalid characters: "${name}". Only alphanumeric, hyphens, and underscores allowed.` };
  }

  return { valid: true };
}

/**
 * Generate an export line for a component
 */
function generateExportLine(componentName: string): string {
  return `export * from './${componentName}/index.js';`;
}

/**
 * Generate new index file content
 */
export function generateIndex(components: string[]): string {
  if (components.length === 0) {
    return '// No components yet\n';
  }

  // Validate all component names
  for (const name of components) {
    const validation = validateComponentName(name);
    if (!validation.valid) {
      throw new Error(`Invalid component name in generateIndex: ${validation.error}`);
    }
  }

  const exports = components
    .sort()
    .map((name) => generateExportLine(name))
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
  // Validate component name
  const validation = validateComponentName(componentName);
  if (!validation.valid) {
    throw new Error(`Cannot update index: ${validation.error}`);
  }

  let content = '';

  try {
    content = await fs.readFile(indexPath, 'utf-8');
  } catch (error) {
    // File doesn't exist - this is expected for new projects
    if ((error as { code?: string }).code !== 'ENOENT') {
      console.error(`Error reading index file at ${indexPath}:`, error);
      throw error;
    }
    content = `/**
 * Auto-generated barrel export
 * Do not edit manually - managed by Sneaky Snatcher
 */

`;
  }

  const exportLine = generateExportLine(componentName);

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

  try {
    await fs.writeFile(indexPath, newContent, 'utf-8');
  } catch (error) {
    console.error(`Error writing index file at ${indexPath}:`, error);
    throw error;
  }
}

/**
 * Remove component from index
 */
export async function removeFromIndex(indexPath: string, componentName: string): Promise<void> {
  // Validate component name
  const validation = validateComponentName(componentName);
  if (!validation.valid) {
    throw new Error(`Cannot remove from index: ${validation.error}`);
  }

  try {
    let content = await fs.readFile(indexPath, 'utf-8');
    const exportLine = generateExportLine(componentName);

    content = content
      .split('\n')
      .filter((line) => line !== exportLine)
      .join('\n');

    await fs.writeFile(indexPath, content, 'utf-8');
  } catch (error) {
    // File doesn't exist is expected - nothing to remove
    if ((error as { code?: string }).code === 'ENOENT') {
      return;
    }
    // Log and rethrow unexpected errors
    console.error(`Error removing component "${componentName}" from index at ${indexPath}:`, error);
    throw error;
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
  } catch (error) {
    // File doesn't exist is expected for new projects
    if ((error as { code?: string }).code === 'ENOENT') {
      return [];
    }
    // Log unexpected errors but return empty array to maintain backward compatibility
    console.error(`Error listing exports from ${indexPath}:`, error);
    return [];
  }
}
