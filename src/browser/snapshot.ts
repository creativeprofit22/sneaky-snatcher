/**
 * Accessibility Snapshot
 *
 * Generates AI-friendly accessibility tree with semantic references.
 * Inspired by agent-browser's approach.
 */

import type { Page } from 'playwright';
import type { AccessibilityNode, PageSnapshot } from '../types/index.ts';

/** Playwright accessibility snapshot node structure */
interface AccessibilitySnapshotNode {
  role?: string;
  name?: string;
  children?: AccessibilitySnapshotNode[];
}

/**
 * Create accessibility snapshot of the page
 */
export async function createAccessibilitySnapshot(page: Page): Promise<PageSnapshot> {
  const snapshot = await (page as Page & { accessibility: { snapshot(): Promise<AccessibilitySnapshotNode | null> } }).accessibility.snapshot();
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
  // Parse the reference path (e.g., "@e0.1.2" -> [0, 1, 2])
  const path = ref
    .replace('@e', '')
    .split('.')
    .map((n) => parseInt(n, 10));

  // Use page.evaluate to find the element by traversing accessibility tree
  const selector = await page.evaluate((refPath: number[]) => {
    // This is a simplified approach - in production, we'd use a more robust method
    // that maps accessibility nodes to actual DOM elements
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);

    let count = 0;
    let current: Node | null = walker.currentNode;

    // Simplified: just count through elements (real impl would follow tree structure)
    while (current && count < refPath[0]!) {
      current = walker.nextNode();
      count++;
    }

    if (current instanceof Element) {
      // Generate a unique selector for the element
      if (current.id) {
        return `#${current.id}`;
      }
      if (current.className) {
        const classes = current.className.split(' ').filter(Boolean).join('.');
        return `.${classes}`;
      }
      return current.tagName.toLowerCase();
    }

    return null;
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
