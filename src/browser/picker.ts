/**
 * Interactive Element Picker
 *
 * Injects a visual overlay into the browser page that allows users to:
 * - See elements highlighted on hover
 * - Click to select an element
 * - Returns a unique CSS selector for the selected element
 */

import type { Page } from 'playwright';
// Note: Selector helpers are duplicated in page.evaluate() below because browser
// context cannot import Node.js modules. See selectorUtils.ts for the canonical
// implementation that can be used in Node.js code.

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
  /** Whether this is part of a multi-select batch (Phase 3) */
  multiSelect?: boolean;
  /** All selected elements when multi-select completes (Phase 3) */
  selections?: Array<{ selector: string; tagName: string; textPreview: string }>;
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
      <strong>🎯 Element Picker Active</strong> — Hover to highlight, click or Enter to select.
      <span style="opacity: 0.8; margin-left: 10px;">Ctrl+Enter multi-select | <strong>?</strong> help | ESC cancel</span>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
    document.body.appendChild(banner);

    // Phase 2: Search input overlay
    const searchOverlay = document.createElement('div');
    searchOverlay.id = '__sneaky-picker-search';
    searchOverlay.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      display: none;
    `;
    searchOverlay.innerHTML = `
      <div style="color: #9ca3af; font-family: system-ui, sans-serif; font-size: 12px; margin-bottom: 8px;">
        Search elements by text content (Enter to select, ESC to cancel)
      </div>
      <input type="text" id="__sneaky-search-input" style="
        width: 300px;
        padding: 8px 12px;
        background: #374151;
        border: 1px solid #4b5563;
        border-radius: 4px;
        color: #f9fafb;
        font-family: ui-monospace, monospace;
        font-size: 14px;
        outline: none;
      " placeholder="Type to filter..." />
      <div id="__sneaky-search-count" style="
        color: #9ca3af;
        font-family: system-ui, sans-serif;
        font-size: 11px;
        margin-top: 6px;
      "></div>
    `;
    document.body.appendChild(searchOverlay);

    // Phase 2: Help overlay
    const helpOverlay = document.createElement('div');
    helpOverlay.id = '__sneaky-picker-help';
    helpOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: none;
      align-items: center;
      justify-content: center;
    `;
    helpOverlay.innerHTML = `
      <div style="
        background: #1f2937;
        padding: 24px 32px;
        border-radius: 12px;
        max-width: 600px;
        font-family: system-ui, sans-serif;
        color: #f9fafb;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      ">
        <h2 style="margin: 0 0 16px 0; color: #60a5fa; font-size: 18px;">Keyboard Shortcuts</h2>
        <div style="display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 8px 16px; font-size: 14px;">
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">Enter</kbd>
          <span>Select current element</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">Ctrl+Enter</kbd>
          <span>Multi-select (add to batch)</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">Escape</kbd>
          <span>Cancel selection</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">Tab</kbd>
          <span>Cycle focusable elements</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">↑ ↓</kbd>
          <span>Navigate siblings</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">← →</kbd>
          <span>Navigate parent / child</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">H J K L</kbd>
          <span>Vim navigation (←↓↑→)</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">[ ]</kbd>
          <span>Cycle matching elements</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">1-9</kbd>
          <span>Select numbered match</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">/ or G</kbd>
          <span>Search by text content</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">M</kbd>
          <span>Mark current element</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">'</kbd>
          <span>Jump to marked element</span>
          <kbd style="background: #374151; padding: 2px 8px; border-radius: 4px; font-family: ui-monospace, monospace;">?</kbd>
          <span>Toggle this help</span>
        </div>
        <div style="margin-top: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
          Press <kbd style="background: #374151; padding: 2px 6px; border-radius: 3px; font-family: ui-monospace, monospace;">?</kbd> or <kbd style="background: #374151; padding: 2px 6px; border-radius: 3px; font-family: ui-monospace, monospace;">Escape</kbd> to close
        </div>
      </div>
    `;
    document.body.appendChild(helpOverlay);

    let currentElement: Element | null = null;
    let mouseMoveTimeout: ReturnType<typeof setTimeout> | null = null;
    const MOUSEMOVE_DEBOUNCE_MS = 16; // ~60fps debounce for selector generation
    const MAX_SELECTOR_PATH_DEPTH = 5; // Maximum ancestor levels to traverse for path selector
    const MAX_CLASS_NAME_LENGTH = 30; // Skip overly long class names (likely generated/hashed)

    // Phase 2: State variables
    let matchingElements: Element[] = []; // Elements matching current selector pattern
    let currentMatchIndex = 0; // Current index in matchingElements for bracket navigation
    let isSearchMode = false; // Whether search mode is active
    let isHelpVisible = false; // Whether help overlay is visible
    const matchIndicators: HTMLElement[] = []; // Number badges on matching elements

    // Phase 3: State variables
    let markedElement: Element | null = null; // Element marked with M key
    let markIndicator: HTMLElement | null = null; // Visual indicator for marked element
    const multiSelectBatch: Array<{ selector: string; tagName: string; textPreview: string }> = []; // Ctrl+Enter selections
    const multiSelectIndicators: HTMLElement[] = []; // Visual indicators for multi-selected elements

    /**
     * Check if an ID/class is from the picker UI (should be ignored)
     */
    function isPickerElement(name: string): boolean {
      return name.startsWith('__sneaky');
    }

    /**
     * Try to generate a selector using the element's ID
     */
    function tryIdSelector(el: Element): string | null {
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
     */
    function tryClassSelector(el: Element): string | null {
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
     */
    function tryDataAttributes(el: Element): string | null {
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
     */
    function tryAriaLabel(el: Element): string | null {
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
     */
    function buildPathSelector(el: Element): string {
      const path: string[] = [];
      let current: Element | null = el;

      while (current && current !== document.body && path.length < MAX_SELECTOR_PATH_DEPTH) {
        let selector = current.tagName.toLowerCase();

        // Add distinguishing class if available
        if (current.classList.length > 0) {
          const mainClass = Array.from(current.classList).find(
            (c) => !isPickerElement(c) && c.length < MAX_CLASS_NAME_LENGTH
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
     * Orchestrates the various selector strategies
     */
    function generateSelector(el: Element): string {
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
     * Handle mouse movement - highlight element under cursor
     * Overlay positioning is immediate, selector generation is debounced
     */
    function handleMouseMove(e: MouseEvent) {
      const target = e.target;

      // Type guard: ensure target is an Element
      if (!(target instanceof Element)) {
        return;
      }

      // Ignore picker UI elements
      if (target.id?.startsWith('__sneaky')) {
        return;
      }

      if (target !== currentElement) {
        currentElement = target;
        const rect = target.getBoundingClientRect();

        // Position overlay immediately (visual feedback)
        overlay.style.display = 'block';
        overlay.style.top = `${rect.top}px`;
        overlay.style.left = `${rect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        // Position tooltip immediately with basic info
        const tagName = target.tagName.toLowerCase();
        const classPreview =
          target.classList.length > 0
            ? `.${Array.from(target.classList).slice(0, 2).join('.')}`
            : '';

        tooltip.innerHTML = `
          <div style="color: #60a5fa; font-weight: bold;">&lt;${tagName}${classPreview}&gt;</div>
          <div style="margin-top: 4px; opacity: 0.8; font-size: 11px; word-break: break-all;">...</div>
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

        // Debounce the expensive selector generation (4 querySelectorAll calls)
        if (mouseMoveTimeout) {
          clearTimeout(mouseMoveTimeout);
        }
        mouseMoveTimeout = setTimeout(() => {
          if (currentElement === target) {
            const selector = generateSelector(target);
            tooltip.innerHTML = `
              <div style="color: #60a5fa; font-weight: bold;">&lt;${tagName}${classPreview}&gt;</div>
              <div style="margin-top: 4px; opacity: 0.8; font-size: 11px; word-break: break-all;">${selector}</div>
            `;
            // Phase 2: Update matching elements and show indicators
            updateMatchingElements();
          }
        }, MOUSEMOVE_DEBOUNCE_MS);
      }
    }

    /**
     * Handle click - select element and return selector
     */
    function handleClick(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target;

      // Type guard: ensure target is an Element
      if (!(target instanceof Element)) {
        return;
      }

      if (target.id?.startsWith('__sneaky')) {
        return;
      }

      try {
        const selector = generateSelector(target);
        const tagName = target.tagName.toLowerCase();
        const textContent = target.textContent || '';
        const textPreview =
          textContent.trim().slice(0, 50) + (textContent.length > 50 ? '...' : '');

        // Send result back
        (window as unknown as { __sneakySnatcherSelect: (r: unknown) => void }).__sneakySnatcherSelect({
          selector,
          tagName,
          textPreview,
        });
      } finally {
        // Cleanup picker UI even on error
        cleanup();
      }
    }

    /**
     * Update highlight to show a new element (used by keyboard navigation)
     */
    function highlightElement(el: Element) {
      currentElement = el;
      const rect = el.getBoundingClientRect();

      // Position overlay
      overlay.style.display = 'block';
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;

      // Update tooltip
      const tagName = el.tagName.toLowerCase();
      const classPreview =
        el.classList.length > 0
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
      const selector = generateSelector(el);

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

      // Scroll element into view if needed
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /**
     * Get all focusable elements in tab order
     */
    function getFocusableElements(): Element[] {
      const selector =
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return Array.from(document.querySelectorAll(selector)).filter((el) => {
        // Filter out picker UI elements and hidden elements
        if ((el as HTMLElement).id?.startsWith('__sneaky')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    }

    /**
     * Select the current element (shared by Enter key and click)
     */
    function selectCurrentElement() {
      if (!currentElement) return;
      if ((currentElement as HTMLElement).id?.startsWith('__sneaky')) return;

      try {
        const selector = generateSelector(currentElement);
        const tagName = currentElement.tagName.toLowerCase();
        const textContent = currentElement.textContent || '';
        const textPreview =
          textContent.trim().slice(0, 50) + (textContent.length > 50 ? '...' : '');

        (window as unknown as { __sneakySnatcherSelect: (r: unknown) => void }).__sneakySnatcherSelect({
          selector,
          tagName,
          textPreview,
        });
      } finally {
        cleanup();
      }
    }

    // ==================== Phase 2: Match Indicators ====================

    /**
     * Clear all match indicator badges from the page
     */
    function clearMatchIndicators() {
      matchIndicators.forEach((indicator) => indicator.remove());
      matchIndicators.length = 0;
    }

    /**
     * Update matching elements based on current selector pattern and show numbered badges
     */
    function updateMatchingElements() {
      clearMatchIndicators();

      if (!currentElement) {
        matchingElements = [];
        return;
      }

      // Get the current selector for the element
      const selector = generateSelector(currentElement);

      // Find all matching elements
      try {
        const matches = Array.from(document.querySelectorAll(selector)).filter(
          (el) => !(el as HTMLElement).id?.startsWith('__sneaky')
        );

        matchingElements = matches;
        currentMatchIndex = matches.indexOf(currentElement);
        if (currentMatchIndex === -1) currentMatchIndex = 0;

        // Only show indicators if there are 2+ matches (and max 9)
        if (matches.length >= 2 && matches.length <= 9) {
          matches.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            const indicator = document.createElement('div');
            indicator.id = `__sneaky-match-${index}`;
            indicator.style.cssText = `
              position: fixed;
              top: ${rect.top}px;
              left: ${rect.left}px;
              width: 20px;
              height: 20px;
              background: ${el === currentElement ? '#3b82f6' : '#6b7280'};
              color: white;
              font-family: ui-monospace, monospace;
              font-size: 12px;
              font-weight: bold;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
              z-index: 999999;
              pointer-events: none;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            `;
            indicator.textContent = String(index + 1);
            document.body.appendChild(indicator);
            matchIndicators.push(indicator);
          });
        }
      } catch {
        // Invalid selector, reset matches
        matchingElements = [];
      }
    }

    // ==================== Phase 3: Mark Element ====================

    /**
     * Update or create the mark indicator badge
     */
    function updateMarkIndicator() {
      // Remove existing indicator
      if (markIndicator) {
        markIndicator.remove();
        markIndicator = null;
      }

      if (!markedElement) return;

      // Create new indicator at marked element position
      const rect = markedElement.getBoundingClientRect();
      markIndicator = document.createElement('div');
      markIndicator.id = '__sneaky-mark-indicator';
      markIndicator.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        right: ${window.innerWidth - rect.right}px;
        width: 20px;
        height: 20px;
        background: #f59e0b;
        color: white;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      `;
      markIndicator.textContent = 'M';
      document.body.appendChild(markIndicator);
    }

    /**
     * Mark the current element for later navigation
     */
    function markCurrentElement() {
      if (!currentElement) return;
      if ((currentElement as HTMLElement).id?.startsWith('__sneaky')) return;

      markedElement = currentElement;
      updateMarkIndicator();
    }

    /**
     * Jump to the previously marked element
     */
    function jumpToMarkedElement() {
      if (!markedElement) return;

      // Verify element is still in DOM
      if (!document.body.contains(markedElement)) {
        markedElement = null;
        updateMarkIndicator();
        return;
      }

      highlightElement(markedElement);
      updateMatchingElements();
    }

    // ==================== Phase 3: Multi-Select Mode ====================

    /**
     * Update visual indicators for multi-selected elements
     */
    function updateMultiSelectIndicators() {
      // Clear existing indicators
      multiSelectIndicators.forEach((indicator) => indicator.remove());
      multiSelectIndicators.length = 0;

      // Create indicators for each selected element
      multiSelectBatch.forEach((selection, index) => {
        try {
          const el = document.querySelector(selection.selector);
          if (!el) return;

          const rect = el.getBoundingClientRect();
          const indicator = document.createElement('div');
          indicator.id = `__sneaky-multiselect-${index}`;
          indicator.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 2px dashed #10b981;
            background: rgba(16, 185, 129, 0.1);
            z-index: 999998;
            pointer-events: none;
            border-radius: 4px;
          `;
          document.body.appendChild(indicator);
          multiSelectIndicators.push(indicator);

          // Add number badge
          const badge = document.createElement('div');
          badge.id = `__sneaky-multiselect-badge-${index}`;
          badge.style.cssText = `
            position: fixed;
            top: ${rect.top - 12}px;
            left: ${rect.left - 4}px;
            width: 18px;
            height: 18px;
            background: #10b981;
            color: white;
            font-family: ui-monospace, monospace;
            font-size: 11px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            z-index: 999999;
            pointer-events: none;
          `;
          badge.textContent = String(index + 1);
          document.body.appendChild(badge);
          multiSelectIndicators.push(badge);
        } catch {
          // Invalid selector, skip
        }
      });

      // Update banner to show multi-select count
      if (multiSelectBatch.length > 0) {
        banner.innerHTML = `
          <strong>🎯 Multi-Select Mode</strong> — ${multiSelectBatch.length} element${multiSelectBatch.length !== 1 ? 's' : ''} selected.
          <span style="opacity: 0.8; margin-left: 10px;">Ctrl+Enter add more | Enter finish | ESC cancel</span>
        `;
      } else {
        banner.innerHTML = `
          <strong>🎯 Element Picker Active</strong> — Hover to highlight, click or Enter to select.
          <span style="opacity: 0.8; margin-left: 10px;">Ctrl+Enter multi-select | <strong>?</strong> help | ESC cancel</span>
        `;
      }
    }

    /**
     * Add current element to multi-select batch
     */
    function addToMultiSelect() {
      if (!currentElement) return;
      if ((currentElement as HTMLElement).id?.startsWith('__sneaky')) return;

      const selector = generateSelector(currentElement);
      const tagName = currentElement.tagName.toLowerCase();
      const textContent = currentElement.textContent || '';
      const textPreview =
        textContent.trim().slice(0, 50) + (textContent.length > 50 ? '...' : '');

      // Check if already selected (by selector)
      const alreadySelected = multiSelectBatch.some((s) => s.selector === selector);
      if (alreadySelected) return;

      multiSelectBatch.push({ selector, tagName, textPreview });
      updateMultiSelectIndicators();
    }

    /**
     * Complete multi-select and return all selections
     */
    function completeMultiSelect() {
      if (multiSelectBatch.length === 0) {
        // No multi-selections, just do normal select
        selectCurrentElement();
        return;
      }

      // If there's a current element not yet in batch, add it
      if (currentElement && !(currentElement as HTMLElement).id?.startsWith('__sneaky')) {
        const selector = generateSelector(currentElement);
        const alreadySelected = multiSelectBatch.some((s) => s.selector === selector);
        if (!alreadySelected) {
          const tagName = currentElement.tagName.toLowerCase();
          const textContent = currentElement.textContent || '';
          const textPreview =
            textContent.trim().slice(0, 50) + (textContent.length > 50 ? '...' : '');
          multiSelectBatch.push({ selector, tagName, textPreview });
        }
      }

      try {
        // Return all selections
        const firstSelection = multiSelectBatch[0]!;
        (window as unknown as { __sneakySnatcherSelect: (r: unknown) => void }).__sneakySnatcherSelect({
          selector: firstSelection.selector,
          tagName: firstSelection.tagName,
          textPreview: firstSelection.textPreview,
          multiSelect: true,
          selections: multiSelectBatch,
        });
      } finally {
        cleanup();
      }
    }

    // ==================== Phase 2: Search Mode ====================

    let searchHighlightedElements: Element[] = [];

    /**
     * Enter search mode - show search input and handle filtering
     */
    function enterSearchMode() {
      isSearchMode = true;
      searchOverlay.style.display = 'block';
      const searchInput = document.getElementById('__sneaky-search-input') as HTMLInputElement;
      const searchCount = document.getElementById('__sneaky-search-count')!;
      searchInput.value = '';
      searchCount.textContent = '';
      searchHighlightedElements = [];
      searchInput.focus();

      // Handle input changes
      searchInput.oninput = () => {
        const query = searchInput.value.trim().toLowerCase();
        clearSearchHighlights();

        if (!query) {
          searchCount.textContent = '';
          searchHighlightedElements = [];
          return;
        }

        // Find elements containing the search text
        const allElements = document.querySelectorAll('*');
        searchHighlightedElements = Array.from(allElements).filter((el) => {
          if ((el as HTMLElement).id?.startsWith('__sneaky')) return false;
          // Only check direct text content, not nested children
          const directText = Array.from(el.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent || '')
            .join('')
            .trim()
            .toLowerCase();
          return directText.includes(query);
        });

        searchCount.textContent = `${searchHighlightedElements.length} match${searchHighlightedElements.length !== 1 ? 'es' : ''} found`;

        // Highlight first match
        if (searchHighlightedElements.length > 0) {
          highlightElement(searchHighlightedElements[0]!);
        }
      };

      // Handle Enter key in search input
      searchInput.onkeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (searchHighlightedElements.length > 0) {
            exitSearchMode();
            selectCurrentElement();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          exitSearchMode();
        }
      };
    }

    /**
     * Clear visual highlights from search results
     */
    function clearSearchHighlights() {
      // No persistent highlights to clear - we just use the main overlay
    }

    /**
     * Exit search mode
     */
    function exitSearchMode() {
      isSearchMode = false;
      searchOverlay.style.display = 'none';
      clearSearchHighlights();
      searchHighlightedElements = [];
      const searchInput = document.getElementById('__sneaky-search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.oninput = null;
        searchInput.onkeydown = null;
      }
    }

    // ==================== Phase 2: Help Overlay ====================

    /**
     * Toggle help overlay visibility
     */
    function toggleHelp() {
      isHelpVisible = !isHelpVisible;
      helpOverlay.style.display = isHelpVisible ? 'flex' : 'none';
    }

    /**
     * Close help overlay
     */
    function closeHelp() {
      isHelpVisible = false;
      helpOverlay.style.display = 'none';
    }

    /**
     * Handle keyboard navigation and selection
     */
    function handleKeyDown(e: KeyboardEvent) {
      // If search mode is active, let the search input handle keys
      if (isSearchMode) {
        return;
      }

      // Escape: Close help, or cancel selection
      if (e.key === 'Escape') {
        if (isHelpVisible) {
          e.preventDefault();
          closeHelp();
          return;
        }
        cleanup();
        (window as unknown as { __sneakySnatcherSelect: (r: unknown) => void }).__sneakySnatcherSelect({
          selector: '',
          tagName: '',
          textPreview: '',
        });
        return;
      }

      // ?: Toggle help overlay
      if (e.key === '?') {
        e.preventDefault();
        toggleHelp();
        return;
      }

      // Don't process other keys if help is visible
      if (isHelpVisible) {
        return;
      }

      // / or G: Enter search mode (G is "go to" alias)
      if (e.key === '/' || e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        enterSearchMode();
        return;
      }

      // Ctrl+Enter: Add to multi-select batch
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        addToMultiSelect();
        return;
      }

      // Enter: Confirm selection (or complete multi-select if batch exists)
      if (e.key === 'Enter') {
        e.preventDefault();
        if (multiSelectBatch.length > 0) {
          completeMultiSelect();
        } else {
          selectCurrentElement();
        }
        return;
      }

      // M: Mark current element
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        markCurrentElement();
        return;
      }

      // ' (apostrophe): Jump to marked element
      if (e.key === "'") {
        e.preventDefault();
        jumpToMarkedElement();
        return;
      }

      // Number keys 1-9: Select numbered match
      if (e.key >= '1' && e.key <= '9') {
        const matchIndex = parseInt(e.key, 10) - 1;
        if (matchIndex < matchingElements.length) {
          e.preventDefault();
          currentMatchIndex = matchIndex;
          highlightElement(matchingElements[matchIndex]!);
          updateMatchingElements();
        }
        return;
      }

      // Arrow and Tab navigation require a current element
      if (!currentElement) return;

      // [: Previous matching element
      if (e.key === '[') {
        e.preventDefault();
        if (matchingElements.length > 1) {
          currentMatchIndex = currentMatchIndex <= 0 ? matchingElements.length - 1 : currentMatchIndex - 1;
          highlightElement(matchingElements[currentMatchIndex]!);
          updateMatchingElements();
        }
        return;
      }

      // ]: Next matching element
      if (e.key === ']') {
        e.preventDefault();
        if (matchingElements.length > 1) {
          currentMatchIndex = currentMatchIndex >= matchingElements.length - 1 ? 0 : currentMatchIndex + 1;
          highlightElement(matchingElements[currentMatchIndex]!);
          updateMatchingElements();
        }
        return;
      }

      // Arrow Up or K (Vim): Previous sibling
      if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const prev = currentElement.previousElementSibling;
        if (prev && !(prev as HTMLElement).id?.startsWith('__sneaky')) {
          highlightElement(prev);
          updateMatchingElements();
        }
        return;
      }

      // Arrow Down or J (Vim): Next sibling
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        const next = currentElement.nextElementSibling;
        if (next && !(next as HTMLElement).id?.startsWith('__sneaky')) {
          highlightElement(next);
          updateMatchingElements();
        }
        return;
      }

      // Arrow Left or H (Vim): Parent element
      if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        const parent = currentElement.parentElement;
        if (parent && parent !== document.body && !(parent as HTMLElement).id?.startsWith('__sneaky')) {
          highlightElement(parent);
          updateMatchingElements();
        }
        return;
      }

      // Arrow Right or L (Vim): First child element
      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        const firstChild = currentElement.firstElementChild;
        if (firstChild && !(firstChild as HTMLElement).id?.startsWith('__sneaky')) {
          highlightElement(firstChild);
          updateMatchingElements();
        }
        return;
      }

      // Tab: Cycle through focusable elements
      if (e.key === 'Tab') {
        e.preventDefault();
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const currentIndex = focusable.indexOf(currentElement);
        let nextIndex: number;

        if (e.shiftKey) {
          // Shift+Tab: Previous focusable element
          nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
        } else {
          // Tab: Next focusable element
          nextIndex = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
        }

        highlightElement(focusable[nextIndex]!);
        updateMatchingElements();
        return;
      }
    }

    /**
     * Track cleanup state to prevent double-cleanup
     */
    let isCleanedUp = false;

    /**
     * Remove picker UI and event listeners
     */
    function cleanup() {
      if (isCleanedUp) return;
      isCleanedUp = true;

      if (mouseMoveTimeout) {
        clearTimeout(mouseMoveTimeout);
        mouseMoveTimeout = null;
      }

      // Phase 1 UI elements
      overlay.remove();
      tooltip.remove();
      banner.remove();

      // Phase 2 UI elements
      searchOverlay.remove();
      helpOverlay.remove();
      clearMatchIndicators();

      // Phase 3 UI elements
      if (markIndicator) {
        markIndicator.remove();
        markIndicator = null;
      }
      multiSelectIndicators.forEach((indicator) => indicator.remove());
      multiSelectIndicators.length = 0;

      // Exit search mode if active
      if (isSearchMode) {
        exitSearchMode();
      }

      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }

    /**
     * Handle page unload - cleanup and cancel selection
     */
    function handleBeforeUnload() {
      cleanup();
    }

    // Attach event listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  // Wait for user selection
  const result = await selectionPromise;

  if (!result.selector) {
    throw new Error('Element selection cancelled');
  }

  return result;
}
