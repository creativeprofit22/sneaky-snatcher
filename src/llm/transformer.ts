/**
 * Component Transformer
 *
 * Transforms extracted HTML+CSS into framework components.
 */

import type { TransformRequest, TransformResult, Framework, Styling } from '../types/index.ts';
import { LLMClient } from './client.ts';
import { PROMPTS } from './prompts.ts';

/**
 * Transform HTML+CSS to component
 */
export async function transformToComponent(
  client: LLMClient,
  request: TransformRequest
): Promise<TransformResult> {
  const prompt = buildTransformPrompt(request);
  const systemPrompt = getSystemPrompt(request.framework, request.styling);

  const response = await client.ask(prompt, systemPrompt);

  // Parse response to extract code
  const codeMatch = response.content.match(/```(?:tsx?|jsx?|vue|svelte|html)?\n([\s\S]*?)```/);
  const code = codeMatch?.[1] || response.content;

  // Extract styles if separate
  const stylesMatch = response.content.match(/```css\n([\s\S]*?)```/);
  const styles = stylesMatch?.[1];

  // Extract props interface
  const propsMatch = response.content.match(/interface\s+\w+Props\s*\{[\s\S]*?\}/);
  const propsInterface = propsMatch?.[0];

  return {
    code: code.trim(),
    styles: styles?.trim(),
    filename: generateFilename(request.componentName, request.framework),
    propsInterface,
    tokens: response.tokens,
  };
}

/**
 * Build transformation prompt
 */
function buildTransformPrompt(request: TransformRequest): string {
  return PROMPTS.TRANSFORM_COMPONENT
    .replace('{{HTML}}', request.html)
    .replace('{{CSS}}', request.css)
    .replace('{{COMPONENT_NAME}}', request.componentName)
    .replace('{{FRAMEWORK}}', request.framework)
    .replace('{{STYLING}}', request.styling)
    .replace('{{INSTRUCTIONS}}', request.instructions || 'None');
}

/**
 * Get system prompt for framework/styling combo
 */
function getSystemPrompt(framework: Framework, styling: Styling): string {
  const basePrompt = PROMPTS.TRANSFORM_SYSTEM;

  const frameworkGuide = PROMPTS.FRAMEWORK_GUIDES[framework] || '';
  const stylingGuide = PROMPTS.STYLING_GUIDES[styling] || '';

  return `${basePrompt}\n\n${frameworkGuide}\n\n${stylingGuide}`;
}

/**
 * Generate filename based on framework
 */
function generateFilename(componentName: string, framework: Framework): string {
  switch (framework) {
    case 'react':
      return `${componentName}.tsx`;
    case 'vue':
      return `${componentName}.vue`;
    case 'svelte':
      return `${componentName}.svelte`;
    case 'html':
      return `${componentName}.html`;
    default:
      return `${componentName}.tsx`;
  }
}

/**
 * Validate component name
 */
export function validateComponentName(name: string): boolean {
  // PascalCase validation
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

/**
 * Generate component name from selector or description
 */
export function generateComponentName(source: string): string {
  // Clean up source string
  const cleaned = source
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/[-_\s]+/g, ' ')
    .trim();

  // Convert to PascalCase
  const pascalCase = cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  return pascalCase || 'ExtractedComponent';
}
