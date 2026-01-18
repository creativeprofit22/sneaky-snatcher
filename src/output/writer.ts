/**
 * Output Writer
 *
 * Writes generated components and styles to disk.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type { OutputConfig, OutputResult, WrittenFile, TransformResult } from '../types/index.ts';

const DEFAULT_CONFIG: OutputConfig = {
  baseDir: './components',
  createIndex: true,
  generateStories: false,
  assetDir: 'assets',
};

/** Characters not allowed in component names (filesystem-safe) */
const INVALID_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

/**
 * Validate component name is safe for filesystem and code generation
 */
function validateComponentName(name: string): void {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Component name must be a non-empty string');
  }
  if (INVALID_NAME_CHARS.test(name)) {
    throw new Error(`Component name contains invalid characters: ${name}`);
  }
  if (name.startsWith('.') || name.startsWith('-')) {
    throw new Error(`Component name cannot start with '.' or '-': ${name}`);
  }
}

/**
 * Sanitize identifier for safe use in generated code
 */
function sanitizeIdentifier(name: string): string {
  // Remove characters unsafe for JS identifiers, keep only alphanumeric and underscore
  return name.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^(\d)/, '_$1');
}

export class OutputWriter {
  private config: OutputConfig;

  constructor(config: Partial<OutputConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Write component and related files to disk
   */
  async write(componentName: string, result: TransformResult): Promise<OutputResult> {
    // Input validation
    validateComponentName(componentName);
    if (!result || typeof result.code !== 'string' || typeof result.filename !== 'string') {
      throw new Error('Invalid TransformResult: must have code and filename');
    }

    const files: WrittenFile[] = [];
    const componentDir = path.join(this.config.baseDir, componentName);

    // Ensure directory exists
    await fs.mkdir(componentDir, { recursive: true });

    // Write main component file
    const componentPath = path.join(componentDir, result.filename);
    await fs.writeFile(componentPath, result.code, 'utf-8');
    files.push({
      path: componentPath,
      type: 'component',
      size: Buffer.byteLength(result.code),
    });

    // Write styles file if separate
    if (result.styles) {
      const stylesFilename = result.filename.replace(/\.(tsx?|jsx?|vue|svelte)$/, '.module.css');
      const stylesPath = path.join(componentDir, stylesFilename);
      await fs.writeFile(stylesPath, result.styles, 'utf-8');
      files.push({
        path: stylesPath,
        type: 'styles',
        size: Buffer.byteLength(result.styles),
      });
    }

    // Write types file if we have props interface
    if (result.propsInterface) {
      const typesPath = path.join(componentDir, 'types.ts');
      await fs.writeFile(typesPath, result.propsInterface, 'utf-8');
      files.push({
        path: typesPath,
        type: 'types',
        size: Buffer.byteLength(result.propsInterface),
      });
    }

    // Create component index
    const indexContent = this.generateComponentIndex(componentName, result);
    const indexPath = path.join(componentDir, 'index.ts');
    await fs.writeFile(indexPath, indexContent, 'utf-8');
    files.push({
      path: indexPath,
      type: 'index',
      size: Buffer.byteLength(indexContent),
    });

    // Update parent index if enabled
    if (this.config.createIndex) {
      await this.updateParentIndex(componentName);
    }

    return {
      files,
      assets: [],
      importPath: `./${path.relative(process.cwd(), componentDir)}`,
    };
  }

  /**
   * Generate component index file
   */
  private generateComponentIndex(componentName: string, result: TransformResult): string {
    const lines: string[] = [];

    // Sanitize identifiers for safe code generation
    const safeComponentName = sanitizeIdentifier(componentName);
    const componentFile = result.filename.replace(/\.[^.]+$/, '');
    const safeComponentFile = sanitizeIdentifier(componentFile);

    lines.push(`export { ${safeComponentName} } from './${safeComponentFile}.js';`);

    // Export types if available
    if (result.propsInterface) {
      const propsName = sanitizeIdentifier(`${componentName}Props`);
      lines.push(`export type { ${propsName} } from './types.js';`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Update parent directory index
   */
  private async updateParentIndex(componentName: string): Promise<void> {
    // Input validation (componentName already validated in write(), but guard for direct calls)
    validateComponentName(componentName);

    const indexPath = path.join(this.config.baseDir, 'index.ts');

    let content = '';
    try {
      content = await fs.readFile(indexPath, 'utf-8');
    } catch {
      // File doesn't exist, will create
    }

    const exportLine = `export * from './${componentName}/index.js';`;

    if (!content.includes(exportLine)) {
      content = content.trim() + (content ? '\n' : '') + exportLine + '\n';
      await fs.writeFile(indexPath, content, 'utf-8');
    }
  }

  /**
   * Set output configuration
   */
  setConfig(config: Partial<OutputConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
