/**
 * LLM Utilities
 *
 * Shared utility functions for LLM module.
 */

/**
 * Build a prompt by replacing template placeholders with values.
 *
 * @param template - The prompt template with {{PLACEHOLDER}} markers
 * @param replacements - Object mapping placeholder names to values
 * @returns The prompt with all placeholders replaced
 *
 * @example
 * buildPrompt('Hello {{NAME}}, you are {{AGE}} years old', {
 *   NAME: 'Alice',
 *   AGE: '30'
 * })
 * // Returns: 'Hello Alice, you are 30 years old'
 */
export function buildPrompt(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(`{{${key}}}`, value);
  }

  return result;
}

/**
 * Truncate a string to a maximum length with ellipsis.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default 200)
 * @returns Truncated string with ellipsis if needed
 */
export function truncateForPreview(str: string, maxLength = 200): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + '...';
}
