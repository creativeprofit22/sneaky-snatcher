/**
 * Interactive Element Picker
 *
 * Injects a visual overlay into the browser page that allows users to:
 * - See elements highlighted on hover
 * - Click to select an element
 * - Returns a unique CSS selector for the selected element
 */

import type { Page } from 'playwright';

/**
 * Result from the interactive picker
 */
export interface PickerResult {
  /** CSS selector for the selected element */
  selector: string;
  /** Element tag name */
  tagName: string;
  /** Element's text preview */
  textPreview: string;
}

/**
 * Launch the interactive element picker overlay
 *
 * Injects a picker UI into the page that highlights elements on hover.
 * Returns the CSS selector when user clicks an element.
 */
export async function launchPicker(page: Page): Promise<PickerResult> {
  // Expose a function to receive the selection result
  let resolveSelection: (result: PickerResult) => void;
  const selectionPromise = new Promise<PickerResult>((resolve) => {
    resolveSelection = resolve;
  });

  await page.exposeFunction('__sneakySnatcherSelect', (result: PickerResult) => {
    resolveSelection(result);
  });

  // Inject the picker overlay
  await page.evaluate(() => {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = '__sneaky-picker-overlay';
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      z-index: 999999;
      transition: all 0.1s ease;
      display: none;
    `;

    // Create info tooltip
    const tooltip = document.createElement('div');
    tooltip.id = '__sneaky-picker-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: #1f2937;
      color: #f9fafb;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      z-index: 999999;
      pointer-events: none;
      max-width: 400px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      display: none;
    `;

    // Create instructions banner
    const banner = document.createElement('div');
    banner.id = '__sneaky-picker-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 12px 20px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 999999;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;
    banner.innerHTML = `
      <strong>🎯 Element Picker Active</strong> — Hover to highlight, click to select.
      <span style="opacity: 0.8; margin-left: 10px;">Press ESC to cancel</span>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
    document.body.appendChild(banner);

    let currentElement: Element | null = null;

    /**
     * Generate a unique CSS selector for an element
     */
    function generateSelector(el: Element): string {
      // Try ID first (most specific)
      if (el.id && !el.id.startsWith('__sneaky')) {
        const idSelector = `#${CSS.escape(el.id)}`;
        if (document.querySelectorAll(idSelector).length === 1) {
          return idSelector;
        }
      }

      // Try unique class combination
      if (el.classList.length > 0) {
        const classes = Array.from(el.classList)
          .filter((c) => !c.startsWith('__sneaky'))
          .map((c) => `.${CSS.escape(c)}`)
          .join('');
        if (classes) {
          const classSelector = `${el.tagName.toLowerCase()}${classes}`;
          if (document.querySelectorAll(classSelector).length === 1) {
            return classSelector;
          }
        }
      }

      // Try data attributes
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-') && attr.value) {
          const dataSelector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
          if (document.querySelectorAll(dataSelector).length === 1) {
            return dataSelector;
          }
        }
      }

      // Build path from root with nth-child
      const path: string[] = [];
      let current: Element | null = el;

      while (current && current !== document.body && path.length < 5) {
        let selector = current.tagName.toLowerCase();

        // Add distinguishing class if available
        if (current.classList.length > 0) {
          const mainClass = Array.from(current.classList).find(
            (c) => !c.startsWith('__sneaky') && c.length < 30
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

        // Add nth-child for disambiguation
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
     * Handle mouse movement - highlight element under cursor
     */
    function handleMouseMove(e: MouseEvent) {
      const target = e.target as Element;

      // Ignore picker UI elements
      if (target.id?.startsWith('__sneaky')) {
        return;
      }

      if (target !== currentElement) {
        currentElement = target;
        const rect = target.getBoundingClientRect();

        // Position overlay
        overlay.style.display = 'block';
        overlay.style.top = `${rect.top}px`;
        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        // Generate and display selector preview
        const selector = generateSelector(target);
        const tagName = target.tagName.toLowerCase();
        const classPreview =
          target.classList.length > 0
            ? `.${Array.from(target.classList).slice(0, 2).join('.')}`
            : '';

        tooltip.innerHTML = `
          <div style="color: #60a5fa; font-weight: bold;">&lt;${tagName}${classPreview}&gt;</div>
          <div style="margin-top: 4px; opacity: 0.8; font-size: 11px; word-break: break-all;">${selector}</div>
        `;
        tooltip.style.display = 'block';

        // Position tooltip above or below element
        const tooltipHeight = 60;
        if (rect.top > tooltipHeight + 10) {
          tooltip.style.top = `${rect.top - tooltipHeight - 8}px`;
        } else {
          tooltip.style.top = `${rect.bottom + 8}px`;
        }
        tooltip.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 420))}px`;
      }
    }

    /**
     * Handle click - select element and return selector
     */
    function handleClick(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as Element;
      if (target.id?.startsWith('__sneaky')) {
        return;
      }

      const selector = generateSelector(target);
      const tagName = target.tagName.toLowerCase();
      const textContent = target.textContent || '';
      const textPreview =
        textContent.trim().slice(0, 50) + (textContent.length > 50 ? '...' : '');

      // Cleanup picker UI
      cleanup();

      // Send result back
      (window as unknown as { __sneakySnatcherSelect: (r: unknown) => void }).__sneakySnatcherSelect({
        selector,
        tagName,
        textPreview,
      });
    }

    /**
     * Handle ESC key to cancel
     */
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cleanup();
        (window as unknown as { __sneakySnatcherSelect: (r: unknown) => void }).__sneakySnatcherSelect({
          selector: '',
          tagName: '',
          textPreview: '',
        });
      }
    }

    /**
     * Remove picker UI and event listeners
     */
    function cleanup() {
      overlay.remove();
      tooltip.remove();
      banner.remove();
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    }

    // Attach event listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
  });

  // Wait for user selection
  const result = await selectionPromise;

  if (!result.selector) {
    throw new Error('Element selection cancelled');
  }

  return result;
}
