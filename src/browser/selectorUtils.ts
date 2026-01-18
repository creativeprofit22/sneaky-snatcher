/**
 * Selector Utilities
 *
 * Shared selector generation logic used by picker and snapshot modules.
 * Provides helper functions for generating unique CSS selectors.
 */

/**
 * Check if an ID/class is from the picker UI (should be ignored)
 */
export function isPickerElement(name: string): boolean {
  return name.startsWith('__sneaky');
}

/**
 * Try to generate a selector using the element's ID
 * Returns null if no unique ID selector is available
 */
export function tryIdSelector(el: Element): string | null {
  if (!el.id || isPickerElement(el.id)) {
    return null;
  }

  const idSelector = `#${CSS.escape(el.id)}`;
  if (document.querySelectorAll(idSelector).length === 1) {
    return idSelector;
  }

  return null;
}

/**
 * Try to generate a selector using the element's class combination
 * Returns null if no unique class selector is available
 */
export function tryClassSelector(el: Element): string | null {
  if (el.classList.length === 0) {
    return null;
  }

  const classes = Array.from(el.classList)
    .filter((c) => !isPickerElement(c))
    .map((c) => `.${CSS.escape(c)}`)
    .join('');

  if (!classes) {
    return null;
  }

  const classSelector = `${el.tagName.toLowerCase()}${classes}`;
  if (document.querySelectorAll(classSelector).length === 1) {
    return classSelector;
  }

  return null;
}

/**
 * Try to generate a selector using data attributes
 * Returns null if no unique data attribute selector is available
 */
export function tryDataAttributes(el: Element): string | null {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-') && attr.value) {
      const dataSelector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
      if (document.querySelectorAll(dataSelector).length === 1) {
        return dataSelector;
      }
    }
  }
  return null;
}

/**
 * Try to generate a selector using aria-label
 * Returns null if no unique aria-label selector is available
 */
export function tryAriaLabel(el: Element): string | null {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    const ariaSelector = `[aria-label="${CSS.escape(ariaLabel)}"]`;
    if (document.querySelectorAll(ariaSelector).length === 1) {
      return ariaSelector;
    }
  }
  return null;
}

/**
 * Build a path selector with nth-of-type for disambiguation
 * Used as fallback when simpler selectors aren't unique
 */
export function buildPathSelector(el: Element, maxDepth = 5): string {
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && path.length < maxDepth) {
    let selector = current.tagName.toLowerCase();

    // Add distinguishing class if available
    if (current.classList.length > 0) {
      const mainClass = Array.from(current.classList).find(
        (c) => !isPickerElement(c) && c.length < 30
      );
      if (mainClass) {
        selector += `.${CSS.escape(mainClass)}`;
      }
    }

    // Check if unique at this point
    const partialPath = [selector, ...path].join(' > ');
    if (document.querySelectorAll(partialPath).length === 1) {
      return partialPath;
    }

    // Add nth-of-type for disambiguation
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Generate a unique CSS selector for an element
 * Tries multiple strategies in order of preference:
 * 1. ID selector
 * 2. Class selector
 * 3. Data attributes
 * 4. Aria label
 * 5. Path with nth-of-type
 */
export function generateSelector(el: Element): string {
  // Try ID first (most specific)
  const idSel = tryIdSelector(el);
  if (idSel) return idSel;

  // Try unique class combination
  const classSel = tryClassSelector(el);
  if (classSel) return classSel;

  // Try data attributes
  const dataSel = tryDataAttributes(el);
  if (dataSel) return dataSel;

  // Try aria-label
  const ariaSel = tryAriaLabel(el);
  if (ariaSel) return ariaSel;

  // Fall back to path selector
  return buildPathSelector(el);
}

/**
 * Generate a simple selector for snapshot (less robust, used in accessibility tree)
 * This is a simpler version that doesn't need to be as unique
 */
export function generateSimpleSelector(el: Element): string | null {
  if (el.id) {
    return `#${el.id}`;
  }
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(' ').filter(Boolean).join('.');
    if (classes) {
      return `.${classes}`;
    }
  }
  return el.tagName.toLowerCase();
}
