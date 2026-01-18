/**
 * Element Locator
 *
 * Uses Claude to find elements from natural language descriptions.
 */

import type { PageSnapshot, LocateRequest, LocateResult } from '../types/index.ts';
import { LLMClient } from './client.ts';
import { PROMPTS } from './prompts.ts';
import { formatTreeForLLM } from '../browser/snapshot.ts';
import { buildPrompt, truncateForPreview } from './utils.ts';

/** Default confidence score when LLM response doesn't include one */
const DEFAULT_CONFIDENCE = 0.8;

/**
 * Locate element using natural language query
 */
export async function locateElement(
  client: LLMClient,
  request: LocateRequest
): Promise<LocateResult> {
  const treeString = formatTreeForLLM(request.snapshot.tree);

  const prompt = buildPrompt(PROMPTS.LOCATE_ELEMENT, {
    TREE: treeString,
    QUERY: request.query,
  });

  const response = await client.ask(prompt, PROMPTS.LOCATE_SYSTEM);

  // Parse response to extract ref
  const refMatch = response.content.match(/@e[\d.]+/);

  if (!refMatch) {
    const preview = truncateForPreview(response.content);
    throw new Error(
      `Could not locate element matching: "${request.query}". ` +
      `LLM response preview: ${preview}`
    );
  }

  // Extract confidence if provided
  const confidenceMatch = response.content.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]!) : DEFAULT_CONFIDENCE;

  if (!confidenceMatch) {
    console.warn(`[locator] No confidence score in LLM response for query "${request.query}", using default: ${DEFAULT_CONFIDENCE}`);
  }

  return {
    ref: refMatch[0],
    confidence,
    reasoning: response.content,
  };
}

/**
 * Batch locate multiple elements (parallel processing)
 */
export async function locateElements(
  client: LLMClient,
  snapshot: PageSnapshot,
  queries: string[]
): Promise<LocateResult[]> {
  const promises = queries.map((query) => locateElement(client, { snapshot, query }));
  return Promise.all(promises);
}
