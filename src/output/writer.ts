/**
 * Output Writer
 *
 * Writes generated components and styles to disk.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type { OutputConfig, OutputResult, WrittenFile, TransformResult, Framework } from '../types/index.ts';

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

    // Generate Storybook story if enabled
    if (this.config.generateStories) {
      const framework = this.detectFramework(result.filename);
      if (framework !== 'html') {
        const storyContent = this.generateStory(componentName, result.filename, framework);
        const storyFilename = this.getStoryFilename(result.filename, framework);
        const storyPath = path.join(componentDir, storyFilename);
        await fs.writeFile(storyPath, storyContent, 'utf-8');
        files.push({
          path: storyPath,
          type: 'story',
          size: Buffer.byteLength(storyContent),
        });
      }
    }

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
   * Detect framework from filename extension
   */
  private detectFramework(filename: string): Framework {
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) {
      return 'react';
    }
    if (filename.endsWith('.vue')) {
      return 'vue';
    }
    if (filename.endsWith('.svelte')) {
      return 'svelte';
    }
    return 'html';
  }

  /**
   * Get story filename based on component filename and framework
   */
  private getStoryFilename(componentFilename: string, framework: Framework): string {
    const baseName = componentFilename.replace(/\.[^.]+$/, '');
    switch (framework) {
      case 'react':
        return `${baseName}.stories.tsx`;
      case 'vue':
      case 'svelte':
        return `${baseName}.stories.ts`;
      default:
        return `${baseName}.stories.ts`;
    }
  }

  /**
   * Generate Storybook story content (CSF3 format)
   */
  private generateStory(componentName: string, componentFilename: string, framework: Framework): string {
    const safeComponentName = sanitizeIdentifier(componentName);
    const componentFileNoExt = componentFilename.replace(/\.[^.]+$/, '');

    switch (framework) {
      case 'react':
        // React: import without extension, use original filename (not sanitized)
        return this.generateReactStory(safeComponentName, componentFileNoExt);
      case 'vue':
        return this.generateVueStory(safeComponentName, componentFilename);
      case 'svelte':
        return this.generateSvelteStory(safeComponentName, componentFilename);
      default:
        return '';
    }
  }

  private generateReactStory(componentName: string, componentFile: string): string {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from './${componentFile}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
};

export default meta;
type Story = StoryObj<typeof ${componentName}>;

export const Default: Story = {};
`;
  }

  private generateVueStory(componentName: string, componentFilename: string): string {
    return `import type { Meta, StoryObj } from '@storybook/vue3';
import ${componentName} from './${componentFilename}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
};

export default meta;
type Story = StoryObj<typeof ${componentName}>;

export const Default: Story = {};
`;
  }

  private generateSvelteStory(componentName: string, componentFilename: string): string {
    return `import type { Meta, StoryObj } from '@storybook/svelte';
import ${componentName} from './${componentFilename}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
};

export default meta;
type Story = StoryObj<typeof ${componentName}>;

export const Default: Story = {};
`;
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

  /**
   * Simulate writing component files without actually writing to disk
   * Returns the same OutputResult as write() would produce
   */
  simulateWrite(componentName: string, result: TransformResult): OutputResult {
    // Input validation
    validateComponentName(componentName);
    if (!result || typeof result.code !== 'string' || typeof result.filename !== 'string') {
      throw new Error('Invalid TransformResult: must have code and filename');
    }

    const files: WrittenFile[] = [];
    const componentDir = path.join(this.config.baseDir, componentName);

    // Simulate main component file
    const componentPath = path.join(componentDir, result.filename);
    files.push({
      path: componentPath,
      type: 'component',
      size: Buffer.byteLength(result.code),
    });

    // Simulate styles file if separate
    if (result.styles) {
      const stylesFilename = result.filename.replace(/\.(tsx?|jsx?|vue|svelte)$/, '.module.css');
      const stylesPath = path.join(componentDir, stylesFilename);
      files.push({
        path: stylesPath,
        type: 'styles',
        size: Buffer.byteLength(result.styles),
      });
    }

    // Simulate types file if we have props interface
    if (result.propsInterface) {
      const typesPath = path.join(componentDir, 'types.ts');
      files.push({
        path: typesPath,
        type: 'types',
        size: Buffer.byteLength(result.propsInterface),
      });
    }

    // Simulate component index
    const indexContent = this.generateComponentIndex(componentName, result);
    const indexPath = path.join(componentDir, 'index.ts');
    files.push({
      path: indexPath,
      type: 'index',
      size: Buffer.byteLength(indexContent),
    });

    // Simulate Storybook story if enabled
    if (this.config.generateStories) {
      const framework = this.detectFramework(result.filename);
      if (framework !== 'html') {
        const storyContent = this.generateStory(componentName, result.filename, framework);
        const storyFilename = this.getStoryFilename(result.filename, framework);
        const storyPath = path.join(componentDir, storyFilename);
        files.push({
          path: storyPath,
          type: 'story',
          size: Buffer.byteLength(storyContent),
        });
      }
    }

    return {
      files,
      assets: [],
      importPath: `./${path.relative(process.cwd(), componentDir)}`,
    };
  }

  /**
   * Remove a component and its directory
   * @returns Object with success status, removed files, and any error message
   */
  async removeComponent(name: string): Promise<{
    success: boolean;
    files: string[];
    error?: string;
  }> {
    try {
      validateComponentName(name);
    } catch (err) {
      return {
        success: false,
        files: [],
        error: err instanceof Error ? err.message : 'Invalid component name',
      };
    }

    const componentDir = path.join(this.config.baseDir, name);

    // Check if component directory exists
    try {
      const stat = await fs.stat(componentDir);
      if (!stat.isDirectory()) {
        return {
          success: false,
          files: [],
          error: `'${name}' exists but is not a directory`,
        };
      }
    } catch {
      return {
        success: false,
        files: [],
        error: `Component '${name}' not found in ${this.config.baseDir}`,
      };
    }

    // List files before deletion
    const files = await this.listComponentFiles(componentDir);

    // Remove the component directory
    await fs.rm(componentDir, { recursive: true, force: true });

    // Update parent index to remove the export
    await this.removeFromParentIndex(name);

    return {
      success: true,
      files,
    };
  }

  /**
   * List files in a component directory (relative paths)
   */
  private async listComponentFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    async function walk(currentDir: string, relativePath: string = ''): Promise<void> {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(path.join(currentDir, entry.name), entryRelative);
        } else {
          files.push(entryRelative);
        }
      }
    }

    await walk(dir);
    return files;
  }

  /**
   * Remove component export from parent index.ts
   */
  private async removeFromParentIndex(name: string): Promise<void> {
    const indexPath = path.join(this.config.baseDir, 'index.ts');

    let content: string;
    try {
      content = await fs.readFile(indexPath, 'utf-8');
    } catch {
      // No parent index exists, nothing to update
      return;
    }

    const exportLine = `export * from './${name}/index.js';`;
    const lines = content.split('\n');
    const filteredLines = lines.filter((line) => line.trim() !== exportLine);

    // Check if anything changed
    if (filteredLines.length === lines.length) {
      // Export line wasn't found, nothing to update
      return;
    }

    const newContent = filteredLines.join('\n').trim();

    if (newContent === '') {
      // Index is now empty, remove it
      await fs.rm(indexPath, { force: true });
    } else {
      await fs.writeFile(indexPath, newContent + '\n', 'utf-8');
    }
  }

  /**
   * List all components in the base directory
   * Returns component info: name, file count, total size in bytes
   */
  async listComponents(): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];

    // Check if directory exists
    try {
      await fs.access(this.config.baseDir);
    } catch {
      // Directory doesn't exist, return empty array
      return components;
    }

    // Read all entries in the base directory
    const entries = await fs.readdir(this.config.baseDir, { withFileTypes: true });

    // Process each subdirectory (each is a component)
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const componentDir = path.join(this.config.baseDir, entry.name);
      const info = await this.getComponentInfo(entry.name, componentDir);
      if (info) {
        components.push(info);
      }
    }

    // Sort alphabetically by name
    components.sort((a, b) => a.name.localeCompare(b.name));

    return components;
  }

  /**
   * Get info for a single component directory
   */
  private async getComponentInfo(name: string, dirPath: string): Promise<ComponentInfo | null> {
    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          fileCount++;
          totalSize += stat.size;
        }
      }

      return {
        name,
        fileCount,
        totalSize,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Component info returned by listComponents
 */
export interface ComponentInfo {
  name: string;
  fileCount: number;
  totalSize: number;
}
