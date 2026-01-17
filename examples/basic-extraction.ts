#!/usr/bin/env bun

/**
 * Basic Extraction Example
 *
 * Demonstrates extracting a component using a CSS selector.
 *
 * Usage:
 *   bun run examples/basic-extraction.ts
 */

import { orchestrate } from '../src/index.ts';

async function main() {
  console.log('🎯 Basic Component Extraction Example\n');

  const result = await orchestrate({
    url: 'https://example.com',
    selector: 'main',
    framework: 'react',
    styling: 'tailwind',
    outputDir: './extracted-components',
    verbose: true,
  });

  if (result.success) {
    console.log('\n✅ Extraction successful!');
    console.log('Files created:', result.output?.files.map(f => f.path).join(', '));
  } else {
    console.error('\n❌ Extraction failed:', result.error?.message);
  }
}

main().catch(console.error);
