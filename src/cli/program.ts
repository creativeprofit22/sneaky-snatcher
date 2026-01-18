/**
 * CLI Program
 *
 * Main CLI entry point using Commander.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline/promises';
import type { SnatchOptions } from '../types/index.ts';
import { validateOptions, parseOptions, loadBatchConfig } from './options.ts';
import { logError, logInfo, logWarn, logSuccess } from './logger.ts';
import { orchestrate, orchestrateBatch } from '../orchestrator.ts';
import { loadConfig } from '../config/loader.ts';
import { OutputWriter } from '../output/writer.ts';

const version = '0.1.0';

/**
 * Create CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('snatch')
    .description('AI-powered component extraction and transformation CLI')
    .version(version)
    .argument('[url]', 'URL to extract component from')
    .option('-s, --selector <selector>', 'CSS selector to target element')
    .option('-f, --find <query>', 'Natural language description to find element')
    .option('--framework <framework>', 'Output framework (react|vue|svelte|html)', 'react')
    .option('--styling <styling>', 'Styling approach (tailwind|css-modules|vanilla|inline)', 'tailwind')
    .option('-o, --output <dir>', 'Output directory', './components')
    .option('-n, --name <name>', 'Component name')
    .option('-i, --interactive', 'Run in interactive mode with visible browser')
    .option('-a, --assets', 'Include assets (images, fonts)')
    .option('-v, --verbose', 'Verbose output')
    .option('-b, --batch <file>', 'Extract multiple components from a JSON config file')
    .action(async (url, options) => {
      try {
        // Batch mode: --batch takes precedence
        if (options.batch) {
          await runBatch(options.batch, options);
          return;
        }

        // Single extraction: URL is required
        if (!url) {
          logError('URL is required. Use: snatch <url> --find "query" or snatch --batch <file>');
          process.exit(1);
        }

        await runSnatch(url, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        if (options.verbose && error instanceof Error && error.stack) {
          console.error('\n' + error.stack);
        }
        process.exit(1);
      }
    });

  // List command - show extracted components
  program
    .command('list')
    .description('List extracted components')
    .option('-d, --dir <dir>', 'Components directory', './components')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await runList(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });

  // Clean command - remove component
  program
    .command('clean <name>')
    .description('Remove an extracted component')
    .option('-d, --dir <dir>', 'Components directory', './components')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (name, options) => {
      try {
        await runClean(name, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        process.exit(1);
      }
    });

  return program;
}

/**
 * Run the snatch command
 */
async function runSnatch(url: string, rawOptions: Record<string, unknown>): Promise<void> {
  // Parse CLI options first
  const parsed = parseOptions({ ...rawOptions, url });

  // Load config file and merge with CLI options (CLI takes precedence)
  const baseConfig = await loadConfig(parsed);

  // Build final options: CLI explicit values override config file values
  const options: SnatchOptions = {
    url: parsed.url || url,
    selector: parsed.selector,
    find: parsed.find,
    // Use CLI value if explicitly provided, otherwise use merged config
    framework: parsed.framework || baseConfig.framework,
    styling: parsed.styling || baseConfig.styling,
    // For outputDir, check if CLI provided a non-default value
    outputDir: parsed.outputDir && parsed.outputDir !== './components' ? parsed.outputDir : baseConfig.outputDir,
    componentName: parsed.componentName,
    // interactive is the inverse of headless in config
    interactive: parsed.interactive || !baseConfig.headless,
    includeAssets: parsed.includeAssets || baseConfig.includeAssets,
    verbose: parsed.verbose || baseConfig.verbose,
  };

  // Validate options
  const validation = validateOptions(options);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  // Run orchestrator
  await orchestrate(options);
}

/**
 * Run batch extraction
 */
async function runBatch(file: string, rawOptions: Record<string, unknown>): Promise<void> {
  const verbose = Boolean(rawOptions.verbose);

  // Load and validate batch config
  const validation = loadBatchConfig(file);
  if (!validation.valid || !validation.config) {
    throw new Error(validation.errors.join('\n'));
  }

  logInfo(`Loaded batch config with ${validation.config.components.length} components`);

  // Run batch extraction
  const result = await orchestrateBatch(validation.config, { verbose });

  // Print summary
  if (result.failed === 0) {
    logSuccess(`Batch complete: ${result.succeeded}/${result.total} components extracted`);
  } else {
    logWarn(`Batch complete: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`);

    // List failed components
    for (const r of result.results) {
      if (!r.success) {
        logError(`  ${r.name}: ${r.error}`);
      }
    }

    process.exit(1);
  }
}

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Run list command to show extracted components
 */
async function runList(options: { dir: string; json?: boolean }): Promise<void> {
  const writer = new OutputWriter({ baseDir: options.dir });
  const components = await writer.listComponents();

  // JSON output mode
  if (options.json) {
    process.stdout.write(JSON.stringify(components, null, 2) + '\n');
    return;
  }

  // Handle empty directory
  if (components.length === 0) {
    logInfo(`No components found in ${options.dir}`);
    return;
  }

  // Calculate column widths for table
  const nameWidth = Math.max(4, ...components.map((c) => c.name.length));
  const filesWidth = 5; // "Files" header
  const sizeWidth = 8; // Enough for "12.4 KB"

  // Print header
  process.stdout.write('\n');
  process.stdout.write(chalk.cyan(`Components in ${options.dir}:`) + '\n');
  process.stdout.write('\n');

  // Table header
  const header =
    '  ' +
    chalk.bold('Name'.padEnd(nameWidth)) +
    '  ' +
    chalk.bold('Files'.padStart(filesWidth)) +
    '  ' +
    chalk.bold('Size'.padStart(sizeWidth));
  process.stdout.write(header + '\n');

  // Separator line
  const separatorLength = nameWidth + filesWidth + sizeWidth + 6;
  process.stdout.write('  ' + chalk.dim('\u2500'.repeat(separatorLength)) + '\n');

  // Table rows
  for (const component of components) {
    const name = component.name.padEnd(nameWidth);
    const files = String(component.fileCount).padStart(filesWidth);
    const size = formatSize(component.totalSize).padStart(sizeWidth);

    process.stdout.write('  ' + chalk.green(name) + '  ' + files + '  ' + size + '\n');
  }

  process.stdout.write('\n');
  logSuccess(`Total: ${components.length} component${components.length !== 1 ? 's' : ''}`);
}

/**
 * Run clean command to remove a component
 */
async function runClean(name: string, options: { dir: string; force?: boolean }): Promise<void> {
  const writer = new OutputWriter({ baseDir: options.dir });

  // First, check if component exists and list files (dry run)
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const componentDir = path.join(options.dir, name);

  // Check if component exists
  let files: string[];
  try {
    const stat = await fs.stat(componentDir);
    if (!stat.isDirectory()) {
      logError(`'${name}' exists but is not a directory`);
      process.exit(1);
    }
    // List files in the component directory
    files = await listFiles(componentDir);
  } catch {
    logError(`Component '${name}' not found in ${options.dir}`);
    process.exit(1);
  }

  // Show what will be deleted
  if (!options.force) {
    process.stdout.write(`Component '${name}' contains:\n`);
    for (const file of files) {
      process.stdout.write(`  - ${file}\n`);
    }
    process.stdout.write('\n');

    // Prompt for confirmation
    const confirmed = await confirm(`Remove component '${name}'?`);
    if (!confirmed) {
      logInfo('Cancelled');
      return;
    }
  }

  // Perform the removal
  const result = await writer.removeComponent(name);

  if (result.success) {
    logSuccess(`Removed component '${name}'`);
  } else {
    logError(result.error || 'Failed to remove component');
    process.exit(1);
  }
}

/**
 * List files in a directory recursively (relative paths)
 */
async function listFiles(dir: string): Promise<string[]> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
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
 * Prompt user for y/n confirmation
 */
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`${question} (y/n): `);
    return answer.toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

/**
 * Run CLI
 */
export async function runCli(args: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(args);
}
