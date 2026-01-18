/**
 * Accessibility Snapshot
 *
 * Generates AI-friendly accessibility tree with semantic references.
 * Inspired by agent-browser's approach.
 */

import type { Page } from 'playwright';
import type { AccessibilityNode, PageSnapshot } from '../types/index.ts';
// Note: generateSimpleSelector logic is duplicated in page.evaluate() below
// because browser context cannot import Node.js modules. See selectorUtils.ts
// for the canonical implementation.

/** Playwright accessibility snapshot node structure */
interface AccessibilitySnapshotNode {
  role?: string;
  name?: string;
  children?: AccessibilitySnapshotNode[];
}

/** Type guard for page with accessibility API */
function hasAccessibilityAPI(
  page: Page
): page is Page & { accessibility: { snapshot(): Promise<AccessibilitySnapshotNode | null> } } {
  return (
    'accessibility' in page &&
    typeof page.accessibility === 'object' &&
    page.accessibility !== null &&
    'snapshot' in page.accessibility &&
    typeof page.accessibility.snapshot === 'function'
  );
}

/**
 * Create accessibility snapshot of the page
 */
export async function createAccessibilitySnapshot(page: Page): Promise<PageSnapshot> {
  if (!hasAccessibilityAPI(page)) {
    throw new Error('Page does not support accessibility API');
  }

  const snapshot = await page.accessibility.snapshot();
  const tree = processNode(snapshot, 0);

  return {
    url: page.url(),
    title: await page.title(),
    tree: tree ? [tree] : [],
    timestamp: Date.now(),
  };
}

/**
 * Process accessibility node recursively, adding semantic references
 */
function processNode(
  node: AccessibilitySnapshotNode | null,
  index: number,
  parentRef = ''
): AccessibilityNode | null {
  if (!node) return null;

  const ref = parentRef ? `${parentRef}.${index}` : `@e${index}`;

  const processed: AccessibilityNode = {
    ref,
    role: node.role || 'unknown',
    name: node.name || '',
  };

  if (node.children && node.children.length > 0) {
    processed.children = node.children
      .map((child: AccessibilitySnapshotNode, i: number) => processNode(child, i, ref))
      .filter((n: AccessibilityNode | null): n is AccessibilityNode => n !== null);
  }

  return processed;
}

/**
 * Resolve semantic reference to CSS selector
 */
export async function resolveRefToSelector(page: Page, ref: string): Promise<string | null> {
  // Validate ref format
  if (!ref.startsWith('@e')) {
    return null;
  }

  // Parse the reference path (e.g., "@e0.1.2" -> [0, 1, 2])
  const pathStr = ref.slice(2); // Remove '@e' prefix
  if (!pathStr) {
    return null;
  }

  const path = pathStr.split('.').map((n) => parseInt(n, 10));

  // Validate parsed path
  if (path.some((n) => isNaN(n) || n < 0)) {
    return null;
  }

  // Use page.evaluate to find the element by traversing the DOM tree
  const selector = await page.evaluate((refPath: number[]) => {
    // Simple selector generator (mirrors selectorUtils.generateSimpleSelector)
    function generateSimpleSelector(el: Element): string {
      if (el.id) {
        return `#${CSS.escape(el.id)}`;
      }
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(Boolean);
        if (classes.length > 0) {
          return `.${classes.map((c) => CSS.escape(c)).join('.')}`;
        }
      }
      return el.tagName.toLowerCase();
    }

    // Traverse the DOM tree following the path indices
    // Each index refers to the nth element child at that level
    let current: Element | null = document.body;

    for (const index of refPath) {
      if (!current) {
        return null;
      }

      // Get element children only (skip text nodes, comments, etc.)
      const children = Array.from(current.children);

      if (index >= children.length) {
        return null;
      }

      current = children[index] ?? null;
    }

    if (!current) {
      return null;
    }

    return generateSimpleSelector(current);
  }, path);

  return selector;
}

/**
 * Format accessibility tree as string for LLM consumption
 */
export function formatTreeForLLM(tree: AccessibilityNode[], indent = 0): string {
  const spaces = '  '.repeat(indent);
  let output = '';

  for (const node of tree) {
    output += `${spaces}${node.ref} [${node.role}] "${node.name}"\n`;
    if (node.children) {
      output += formatTreeForLLM(node.children, indent + 1);
    }
  }

  return output;
}
