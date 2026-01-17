/**
 * CLI Program
 *
 * Main CLI entry point using Commander.
 */

import { Command } from 'commander';
import type { SnatchOptions, Framework, Styling } from '../types/index.ts';
import { validateOptions } from './options.ts';
import { logError, logInfo } from './logger.ts';
import { orchestrate } from '../orchestrator.ts';

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
        logError(error instanceof Error ? error.message : String(error));
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
      // TODO: Implement listing
    });

  // Clean command - remove component
  program
    .command('clean <name>')
    .description('Remove an extracted component')
    .option('-d, --dir <dir>', 'Components directory', './components')
    .action(async (name, options) => {
      logInfo(`Removing component: ${name} from ${options.dir}`);
      // TODO: Implement cleanup
    });

  return program;
}

/**
 * Run the snatch command
 */
async function runSnatch(url: string, rawOptions: Record<string, unknown>): Promise<void> {
  const options: SnatchOptions = {
    url,
    selector: rawOptions.selector as string | undefined,
    find: rawOptions.find as string | undefined,
    framework: (rawOptions.framework as Framework) || 'react',
    styling: (rawOptions.styling as Styling) || 'tailwind',
    outputDir: (rawOptions.output as string) || './components',
    componentName: rawOptions.name as string | undefined,
    interactive: Boolean(rawOptions.interactive),
    includeAssets: Boolean(rawOptions.assets),
    verbose: Boolean(rawOptions.verbose),
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
 * Run CLI
 */
export async function runCli(args: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(args);
}
