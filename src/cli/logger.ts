/**
 * CLI Logger
 *
 * Styled console output for the CLI.
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';

let verboseMode = false;

/**
 * Enable/disable verbose mode
 */
export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

/**
 * Create spinner
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

/**
 * Log success message
 */
export function logSuccess(message: string): void {
  console.log(chalk.green('✓') + ' ' + message);
}

/**
 * Log error message
 */
export function logError(message: string): void {
  console.error(chalk.red('✗') + ' ' + chalk.red(message));
}

/**
 * Log warning message
 */
export function logWarning(message: string): void {
  console.warn(chalk.yellow('⚠') + ' ' + chalk.yellow(message));
}

/**
 * Log info message
 */
export function logInfo(message: string): void {
  console.log(chalk.blue('ℹ') + ' ' + message);
}

/**
 * Log verbose message (only if verbose mode enabled)
 */
export function logVerbose(message: string): void {
  if (verboseMode) {
    console.log(chalk.gray('  ' + message));
  }
}

/**
 * Log step in progress
 */
export function logStep(step: number, total: number, message: string): void {
  const prefix = chalk.dim(`[${step}/${total}]`);
  console.log(`${prefix} ${message}`);
}

/**
 * Log final summary
 */
export function logSummary(results: {
  component: string;
  files: number;
  assets: number;
  path: string;
}): void {
  console.log('');
  console.log(chalk.bold('Component ready:'));
  console.log('');
  console.log(chalk.cyan(`  import { ${results.component} } from '${results.path}'`));
  console.log('');
  console.log(chalk.dim(`  Files: ${results.files} | Assets: ${results.assets}`));
  console.log('');
}

/**
 * Log timing information
 */
export function logTiming(timing: Record<string, number>): void {
  if (!verboseMode) return;

  console.log('');
  console.log(chalk.dim('Timing:'));
  for (const [step, ms] of Object.entries(timing)) {
    console.log(chalk.dim(`  ${step}: ${ms}ms`));
  }
}
