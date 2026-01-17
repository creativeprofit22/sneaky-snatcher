#!/usr/bin/env bun

/**
 * Programmatic API Example
 *
 * Demonstrates using individual modules directly.
 *
 * Usage:
 *   bun run examples/programmatic-api.ts
 */

import { BrowserManager, createAccessibilitySnapshot } from '../src/browser/index.ts';
import { extractElement, StyleReducer } from '../src/extractor/index.ts';

async function main() {
  console.log('🔧 Programmatic API Example\n');

  // Initialize browser
  const browser = new BrowserManager({ headless: true });

  try {
    // Launch and navigate
    console.log('Launching browser...');
    await browser.launch();
    await browser.navigate('https://example.com');
    console.log('✓ Navigation complete\n');

    // Get accessibility snapshot
    const page = browser.getPage();
    const snapshot = await createAccessibilitySnapshot(page);
    console.log('Accessibility tree root nodes:', snapshot.tree.length);
    console.log('Page title:', snapshot.title);
    console.log('');

    // Extract an element
    console.log('Extracting <main> element...');
    const extracted = await extractElement(page, 'main');
    console.log('✓ Extracted HTML:', extracted.html.length, 'bytes');
    console.log('✓ Extracted CSS:', extracted.css.length, 'bytes');
    console.log('✓ Assets found:', extracted.assets.length);
    console.log('');

    // Show style reduction stats
    const reducer = new StyleReducer();
    console.log('StyleReducer options available:');
    console.log('  - removeInherited: Filter inherited styles');
    console.log('  - removeVendorPrefixes: Strip -webkit-, -moz-, etc.');
    console.log('  - useShorthand: Convert to margin/padding shorthand');
    console.log('  - removeDefaults: Remove browser default values');

  } finally {
    await browser.close();
    console.log('\n✓ Browser closed');
  }
}

main().catch(console.error);
