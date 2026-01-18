/**
 * Component Transformer
 *
 * Transforms extracted HTML+CSS into framework components.
 */

import type { TransformRequest, TransformResult, Framework, Styling } from '../types/index.ts';
import { LLMClient } from './client.ts';
import { PROMPTS } from './prompts.ts';
import { buildPrompt } from './utils.ts';

// Regex patterns for parsing LLM response
const CODE_BLOCK_PATTERN = /```(?:tsx?|jsx?|vue|svelte|html)?\n([\s\S]*?)```/;
const CSS_BLOCK_PATTERN = /```css\n([\s\S]*?)```/;
const PROPS_INTERFACE_PATTERN = /interface\s+\w+Props\s*\{[\s\S]*?\}/;
const VALID_CODE_PATTERN = /(?:function|const|export|class|<\w+|interface|type\s+\w+)/;

// Valid framework and styling options
const VALID_FRAMEWORKS: readonly Framework[] = ['react', 'vue', 'svelte', 'html'];
const VALID_STYLING: readonly Styling[] = ['tailwind', 'css-modules', 'vanilla', 'inline'];

/**
 * Extract and validate a code block from LLM response
 */
function extractCodeBlock(content: string, fallback: string): string {
  const match = content.match(CODE_BLOCK_PATTERN);
  const rawCode = match?.[1];

  if (rawCode && rawCode.trim().length > 0 && VALID_CODE_PATTERN.test(rawCode)) {
    return rawCode;
  }
  return fallback;
}

/**
 * Extract optional content from a regex match
 */
function extractOptionalMatch(content: string, pattern: RegExp, captureGroup = 0): string | undefined {
  const match = content.match(pattern);
  const value = match?.[captureGroup];
  return value && value.trim().length > 0 ? value : undefined;
}

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

  const code = extractCodeBlock(response.content, response.content);
  const styles = extractOptionalMatch(response.content, CSS_BLOCK_PATTERN, 1);
  const propsInterface = extractOptionalMatch(response.content, PROPS_INTERFACE_PATTERN);

  return {
    code: code.trim(),
    styles: styles?.trim(),
    filename: generateFilename(request.componentName, request.framework),
    propsInterface,
    tokens: response.tokens,
  };
}

/**
 * Build transformation prompt with parameter validation
 */
function buildTransformPrompt(request: TransformRequest): string {
  // Validate framework parameter
  if (!VALID_FRAMEWORKS.includes(request.framework)) {
    console.warn(
      `[transformer] Invalid framework "${request.framework}", defaulting to "react". Valid options: ${VALID_FRAMEWORKS.join(', ')}`
    );
  }

  // Validate styling parameter
  if (!VALID_STYLING.includes(request.styling)) {
    console.warn(
      `[transformer] Invalid styling "${request.styling}", defaulting to "tailwind". Valid options: ${VALID_STYLING.join(', ')}`
    );
  }

  const framework = VALID_FRAMEWORKS.includes(request.framework) ? request.framework : 'react';
  const styling = VALID_STYLING.includes(request.styling) ? request.styling : 'tailwind';

  return buildPrompt(PROMPTS.TRANSFORM_COMPONENT, {
    HTML: request.html,
    CSS: request.css,
    COMPONENT_NAME: request.componentName,
    FRAMEWORK: framework,
    STYLING: styling,
    INSTRUCTIONS: request.instructions || 'None',
  });
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

// Reserved JavaScript/TypeScript keywords that cannot be used as component names
const RESERVED_KEYWORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield', 'let', 'static', 'implements', 'interface', 'package', 'private',
  'protected', 'public', 'await', 'abstract', 'boolean', 'byte', 'char', 'double',
  'final', 'float', 'goto', 'int', 'long', 'native', 'short', 'synchronized',
  'throws', 'transient', 'volatile',
]);

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
  let pascalCase = cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  // Fallback for empty result
  if (!pascalCase) {
    return 'ExtractedComponent';
  }

  // Ensure starts with uppercase letter (not a number)
  if (/^\d/.test(pascalCase)) {
    pascalCase = 'Component' + pascalCase;
  }

  // Check for reserved keywords (case-insensitive for safety)
  if (RESERVED_KEYWORDS.has(pascalCase.toLowerCase())) {
    pascalCase = pascalCase + 'Component';
  }

  return pascalCase;
}
