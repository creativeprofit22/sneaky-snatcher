#!/usr/bin/env node

/**
 * Sneaky Snatcher CLI
 *
 * Usage:
 *   snatch <url> [options]
 *
 * Examples:
 *   snatch "stripe.com/pricing" --find "pricing card" --framework react
 *   snatch "vercel.com" --selector ".hero-section" --styling tailwind
 */

import { runCli } from '../dist/cli/index.js';

runCli().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
