/**
 * Config Module
 *
 * Loads and manages configuration from:
 * - .snatchrc.json
 * - Environment variables
 * - CLI arguments (highest priority)
 */

export { loadConfig, getConfig, type Config } from './loader.ts';
export { DEFAULTS, SUPPORTED_FRAMEWORKS, SUPPORTED_STYLING } from './constants.ts';
