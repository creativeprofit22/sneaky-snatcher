/**
 * Pipeline Orchestrator
 *
 * Coordinates the full extraction pipeline:
 * URL → Browse → Locate → Extract → Transform → Write
 */

import type {
  SnatchOptions,
  PipelineResult,
  PipelineTiming,
  PageSnapshot,
  ExtractedElement,
  TransformResult,
  OutputResult,
} from './types/index.js';
import { BrowserManager, createAccessibilitySnapshot, resolveRefToSelector } from './browser/index.js';
import { extractElement } from './extractor/index.js';
import { LLMClient, locateElement, transformToComponent } from './llm/index.js';
import { OutputWriter, downloadAssets } from './output/index.js';
import {
  createSpinner,
  logSuccess,
  logError,
  logVerbose,
  logSummary,
  setVerbose,
} from './cli/logger.js';
import { normalizeUrl } from './cli/options.js';
import { generateComponentName } from './llm/transformer.js';

/**
 * Run the full extraction pipeline
 */
export async function orchestrate(options: SnatchOptions): Promise<PipelineResult> {
  const timing: PipelineTiming = {
    browse: 0,
    locate: 0,
    extract: 0,
    transform: 0,
    write: 0,
    total: 0,
  };

  const totalStart = Date.now();

  // Set verbose mode
  setVerbose(options.verbose ?? false);

  // Initialize components
  const browser = new BrowserManager({ headless: !options.interactive });
  const llm = new LLMClient();
  const output = new OutputWriter({ baseDir: options.outputDir });

  let snapshot: PageSnapshot | undefined;
  let selector: string | undefined;
  let extracted: ExtractedElement | undefined;
  let transformed: TransformResult | undefined;
  let result: OutputResult | undefined;

  try {
    // =========================================================================
    // Step 1: Browse
    // =========================================================================
    const browseSpinner = createSpinner('Launching browser...');
    browseSpinner.start();
    const browseStart = Date.now();

    const url = normalizeUrl(options.url);
    await browser.launch();
    await browser.navigate(url);
    logVerbose(`Navigated to: ${url}`);

    timing.browse = Date.now() - browseStart;
    browseSpinner.succeed(`Navigated to ${new URL(url).hostname}`);

    // =========================================================================
    // Step 2: Locate Element
    // =========================================================================
    const locateSpinner = createSpinner('Locating element...');
    locateSpinner.start();
    const locateStart = Date.now();

    const page = browser.getPage();

    if (options.selector) {
      // Direct selector provided
      selector = options.selector;
      logVerbose(`Using selector: ${selector}`);
    } else if (options.find) {
      // Natural language - need snapshot and LLM
      snapshot = await createAccessibilitySnapshot(page);
      logVerbose(`Accessibility tree has ${snapshot.tree.length} root nodes`);

      const locateResult = await locateElement(llm, {
        snapshot,
        query: options.find,
      });

      logVerbose(`Found element: ${locateResult.ref} (confidence: ${locateResult.confidence})`);

      // Resolve ref to selector
      selector = await resolveRefToSelector(page, locateResult.ref);
      if (!selector) {
        throw new Error(`Could not resolve element reference: ${locateResult.ref}`);
      }
    } else {
      throw new Error('Either --selector or --find is required');
    }

    timing.locate = Date.now() - locateStart;
    locateSpinner.succeed(`Located element: ${selector}`);

    // =========================================================================
    // Step 3: Extract
    // =========================================================================
    const extractSpinner = createSpinner('Extracting HTML and styles...');
    extractSpinner.start();
    const extractStart = Date.now();

    extracted = await extractElement(page, selector);

    const originalSize = extracted.html.length + (extracted.css?.length || 0);
    logVerbose(`Extracted ${extracted.html.length} bytes HTML, ${extracted.css?.length || 0} bytes CSS`);
    logVerbose(`Found ${extracted.assets.length} assets`);

    timing.extract = Date.now() - extractStart;
    extractSpinner.succeed(
      `Extracted (${formatBytes(originalSize)} → ${formatBytes(extracted.html.length + extracted.css.length)})`
    );

    // =========================================================================
    // Step 4: Transform
    // =========================================================================
    const transformSpinner = createSpinner(
      `Transforming to ${options.framework} + ${options.styling}...`
    );
    transformSpinner.start();
    const transformStart = Date.now();

    const componentName =
      options.componentName || generateComponentName(options.find || options.selector || 'Component');

    transformed = await transformToComponent(llm, {
      html: extracted.html,
      css: extracted.css,
      framework: options.framework,
      styling: options.styling,
      componentName,
    });

    logVerbose(`Generated ${transformed.code.length} bytes of code`);
    if (transformed.tokens) {
      logVerbose(`Tokens used: ${transformed.tokens.total}`);
    }

    timing.transform = Date.now() - transformStart;
    transformSpinner.succeed(`Transformed to ${options.framework}`);

    // =========================================================================
    // Step 5: Write Output
    // =========================================================================
    const writeSpinner = createSpinner('Writing files...');
    writeSpinner.start();
    const writeStart = Date.now();

    result = await output.write(componentName, transformed);

    // Download assets if requested
    if (options.includeAssets && extracted.assets.length > 0) {
      const downloaded = await downloadAssets(extracted.assets, options.outputDir);
      result.assets = downloaded;
      logVerbose(`Downloaded ${downloaded.length} assets`);
    }

    timing.write = Date.now() - writeStart;
    writeSpinner.succeed(`Written ${result.files.length} files`);

    // =========================================================================
    // Summary
    // =========================================================================
    timing.total = Date.now() - totalStart;

    logSummary({
      component: componentName,
      files: result.files.length,
      assets: result.assets.length,
      path: result.importPath,
    });

    return {
      success: true,
      output: result,
      timing,
    };
  } catch (error) {
    timing.total = Date.now() - totalStart;

    logError(error instanceof Error ? error.message : String(error));

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      timing,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
