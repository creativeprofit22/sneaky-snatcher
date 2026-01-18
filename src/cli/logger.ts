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

// ============================================================
// Spinner Utility (separate from logging API - returns Ora instance)
// ============================================================

/**
 * Create spinner for long-running operations.
 * Note: This returns an Ora instance for control, unlike log* functions which return void.
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

// ============================================================
// Logging API (all functions return void for consistency)
// ============================================================

/**
 * Log a formatted message with icon
 */
function logFormatted(
  method: 'log' | 'error' | 'warn',
  icon: string,
  iconColor: typeof chalk.green,
  message: string,
  messageColor?: typeof chalk.green
): void {
  const formattedMessage = messageColor ? messageColor(message) : message;
  console[method](iconColor(icon) + ' ' + formattedMessage);
}

/**
 * Log success message
 */
export function logSuccess(message: string): void {
  logFormatted('log', '✓', chalk.green, message);
}

/**
 * Log error message
 */
export function logError(message: string): void {
  logFormatted('error', '✗', chalk.red, message, chalk.red);
}

/**
 * Log warning message
 */
export function logWarn(message: string): void {
  logFormatted('warn', '⚠', chalk.yellow, message, chalk.yellow);
}

/**
 * Log info message
 */
export function logInfo(message: string): void {
  logFormatted('log', 'ℹ', chalk.blue, message);
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
