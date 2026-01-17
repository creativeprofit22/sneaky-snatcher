/**
 * Element Locator
 *
 * Uses Claude to find elements from natural language descriptions.
 */

import type { PageSnapshot, LocateRequest, LocateResult } from '../types/index.ts';
import { LLMClient } from './client.ts';
import { PROMPTS } from './prompts.ts';
import { formatTreeForLLM } from '../browser/snapshot.ts';

/**
 * Locate element using natural language query
 */
export async function locateElement(
  client: LLMClient,
  request: LocateRequest
): Promise<LocateResult> {
  const treeString = formatTreeForLLM(request.snapshot.tree);

  const prompt = PROMPTS.LOCATE_ELEMENT
    .replace('{{TREE}}', treeString)
    .replace('{{QUERY}}', request.query);

  const response = await client.ask(prompt, PROMPTS.LOCATE_SYSTEM);

  // Parse response to extract ref
  const refMatch = response.content.match(/@e[\d.]+/);

  if (!refMatch) {
    throw new Error(`Could not locate element matching: "${request.query}"`);
  }

  // Extract confidence if provided
  const confidenceMatch = response.content.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]!) : 0.8;

  return {
    ref: refMatch[0],
    confidence,
    reasoning: response.content,
  };
}

/**
 * Batch locate multiple elements
 */
export async function locateElements(
  client: LLMClient,
  snapshot: PageSnapshot,
  queries: string[]
): Promise<LocateResult[]> {
  const results: LocateResult[] = [];

  for (const query of queries) {
    const result = await locateElement(client, { snapshot, query });
    results.push(result);
  }

  return results;
}
