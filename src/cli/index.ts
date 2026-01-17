/**
 * CLI Module
 *
 * Command-line interface for Sneaky Snatcher.
 */

export { createProgram, runCli } from './program.js';
export { parseOptions, validateOptions } from './options.js';
export { createSpinner, logSuccess, logError, logInfo, logVerbose } from './logger.js';
