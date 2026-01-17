/**
 * Output Writer
 *
 * Writes generated components and styles to disk.
 */

import type { OutputConfig, OutputResult, WrittenFile, TransformResult } from '../types/index.ts';

const DEFAULT_CONFIG: OutputConfig = {
  baseDir: './components',
  createIndex: true,
  generateStories: false,
  assetDir: 'assets',
};

export class OutputWriter {
  private config: OutputConfig;

  constructor(config: Partial<OutputConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Write component and related files to disk
   */
  async write(componentName: string, result: TransformResult): Promise<OutputResult> {
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

    // Export component
    const componentFile = result.filename.replace(/\.[^.]+$/, '');
    lines.push(`export { ${componentName} } from './${componentFile}.js';`);

    // Export types if available
    if (result.propsInterface) {
      const propsName = `${componentName}Props`;
      lines.push(`export type { ${propsName} } from './types.js';`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Update parent directory index
   */
  private async updateParentIndex(componentName: string): Promise<void> {
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
