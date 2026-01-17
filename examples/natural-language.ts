#!/usr/bin/env bun

/**
 * Natural Language Extraction Example
 *
 * Demonstrates extracting a component using natural language description.
 *
 * Usage:
 *   bun run examples/natural-language.ts
 */

import { orchestrate } from '../src/index.ts';

async function main() {
  console.log('🗣️ Natural Language Extraction Example\n');

  const result = await orchestrate({
    url: 'https://stripe.com/pricing',
    find: 'the pricing card for the Pro plan',
    framework: 'react',
    styling: 'tailwind',
    outputDir: './extracted-components',
    componentName: 'PricingCard',
    includeAssets: true,
    verbose: true,
  });

  if (result.success) {
    console.log('\n✅ Extraction successful!');
    console.log('Import path:', result.output?.importPath);
    console.log('Timing:', result.timing);
  } else {
    console.error('\n❌ Extraction failed:', result.error?.message);
  }
}

main().catch(console.error);
