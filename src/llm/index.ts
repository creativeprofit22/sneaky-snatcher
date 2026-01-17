/**
 * LLM Module
 *
 * Handles Claude integration via subclaude:
 * - Element location from natural language
 * - HTML to component transformation
 */

export { LLMClient } from './client.ts';
export { locateElement } from './locator.ts';
export { transformToComponent, generateComponentName } from './transformer.ts';
export { PROMPTS } from './prompts.ts';
