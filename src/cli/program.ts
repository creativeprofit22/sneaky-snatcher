/**
 * CLI Program
 *
 * Main CLI entry point using Commander.
 */

import { Command } from 'commander';
import type { SnatchOptions } from '../types/index.ts';
import { validateOptions, parseOptions, loadBatchConfig } from './options.ts';
import { logError, logInfo, logWarn, logSuccess } from './logger.ts';
import { orchestrate, orchestrateBatch } from '../orchestrator.ts';
import { loadConfig } from '../config/loader.ts';

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
    .argument('<url>', 'URL to extract component from')
    .option('-s, --selector <selector>', 'CSS selector to target element')
    .option('-f, --find <query>', 'Natural language description to find element')
    .option('--framework <framework>', 'Output framework (react|vue|svelte|html)', 'react')
    .option('--styling <styling>', 'Styling approach (tailwind|css-modules|vanilla|inline)', 'tailwind')
    .option('-o, --output <dir>', 'Output directory', './components')
    .option('-n, --name <name>', 'Component name')
    .option('-i, --interactive', 'Run in interactive mode with visible browser')
    .option('-a, --assets', 'Include assets (images, fonts)')
    .option('-v, --verbose', 'Verbose output')
    .action(async (url, options) => {
      try {
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
    .action(async (options) => {
      logInfo('Listing components in: ' + options.dir);
      logWarn('The list command is not implemented yet');
    });

  // Clean command - remove component
  program
    .command('clean <name>')
    .description('Remove an extracted component')
    .option('-d, --dir <dir>', 'Components directory', './components')
    .action(async (name, options) => {
      logInfo(`Removing component: ${name} from ${options.dir}`);
      logWarn('The clean command is not implemented yet');
    });

  // Batch command - extract multiple components
  program
    .command('batch <file>')
    .description('Extract multiple components from a JSON config file')
    .option('-v, --verbose', 'Verbose output')
    .action(async (file, options) => {
      try {
        await runBatch(file, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(message);
        if (options.verbose && error instanceof Error && error.stack) {
          console.error('\n' + error.stack);
        }
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
 * Run CLI
 */
export async function runCli(args: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(args);
}
