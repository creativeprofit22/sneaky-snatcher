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
  BatchConfig,
  BatchResult,
  BatchComponentResult,
} from './types/index.ts';
import { BrowserManager, createAccessibilitySnapshot, resolveRefToSelector } from './browser/index.ts';
import { extractElement } from './extractor/index.ts';
import { LLMClient, locateElement, transformToComponent, generateComponentName } from './llm/index.ts';
import { OutputWriter, downloadAssets } from './output/index.ts';
import {
  createSpinner,
  logError,
  logInfo,
  logVerbose,
  logWarn,
  logSummary,
  setVerbose,
  normalizeUrl,
} from './cli/index.ts';
import {
  ValidationError,
  ElementNotFoundError,
  LLMError,
  LLMNotAvailableError,
  LLMTimeoutError,
  isSnatchError,
  formatError,
} from './errors/index.ts';
import { formatBytes } from './utils/format.ts';
import type { Page } from 'playwright';
import type { Ora } from 'ora';

// ============================================================================
// Types
// ============================================================================

interface StageContext {
  options: SnatchOptions;
  browser: BrowserManager;
  llm: LLMClient;
  output: OutputWriter;
  timing: PipelineTiming;
  /** If true, browser is shared and should not be closed by this orchestration */
  sharedBrowser?: boolean;
  /** If true, LLM client is shared (for symmetry with browser pattern) */
  sharedLLM?: boolean;
  /** If true, output writer is shared (for symmetry with browser/LLM pattern) */
  sharedOutput?: boolean;
}

interface BrowseResult {
  url: string;
  page: Page;
}

interface LocateStageResult {
  selector: string;
  snapshot?: PageSnapshot;
}

/** Internal options for orchestrate with browser/LLM/output sharing support */
interface OrchestrateInternalOptions {
  /** Shared browser manager - if provided, will be reused and not closed */
  sharedBrowser?: BrowserManager;
  /** Shared LLM client - if provided, will be reused */
  sharedLLM?: LLMClient;
  /** Shared output writer - if provided, will be reused */
  sharedOutput?: OutputWriter;
}

// ============================================================================
// Stage Functions
// ============================================================================

/**
 * Stage 1: Browse - Launch browser and navigate to URL
 * If browser is already launched (shared context), creates new page instead
 */
async function browseAndNavigate(ctx: StageContext): Promise<BrowseResult> {
  const spinner = createSpinner('Launching browser...');
  spinner.start();
  const start = Date.now();

  try {
    const url = normalizeUrl(ctx.options.url);

    // Reuse browser if already launched, otherwise launch new
    if (ctx.browser.isLaunched()) {
      spinner.text = 'Creating new page...';
      await ctx.browser.newPage();
    } else {
      await ctx.browser.launch();
    }

    await ctx.browser.navigate(url);
    logVerbose(`Navigated to: ${url}`);

    ctx.timing.browse = Date.now() - start;
    spinner.succeed(`Navigated to ${new URL(url).hostname}`);

    // getPage() is guaranteed non-null after successful launch/newPage and navigate
    const page = ctx.browser.getPage();
    return { url, page };
  } catch (error) {
    spinner.fail('Failed to navigate');
    throw error;
  }
}

/**
 * Stage 2: Locate - Find the target element
 */
async function locateTargetElement(
  ctx: StageContext,
  page: Page
): Promise<LocateStageResult> {
  const spinner = createSpinner('Locating element...');
  spinner.start();
  const start = Date.now();

  try {
    const result = await resolveElementSelector(ctx, page, spinner);

    ctx.timing.locate = Date.now() - start;
    spinner.succeed(`Located element: ${result.selector}`);

    return result;
  } catch (error) {
    spinner.fail('Failed to locate element');
    throw wrapLLMError(error);
  }
}

/**
 * Resolve element selector from options (direct, NLP, or interactive)
 */
async function resolveElementSelector(
  ctx: StageContext,
  page: Page,
  spinner: Ora
): Promise<LocateStageResult> {
  const { options, llm } = ctx;

  // Direct selector provided
  if (options.selector) {
    logVerbose(`Using selector: ${options.selector}`);
    return { selector: options.selector };
  }

  // Natural language - need snapshot and LLM
  if (options.find) {
    const snapshot = await createAccessibilitySnapshot(page);
    // Snapshot tree is guaranteed to be an array (may be empty for blank pages)
    if (!snapshot.tree || snapshot.tree.length === 0) {
      throw new ElementNotFoundError(
        options.find,
        'Page accessibility tree is empty - no elements to search'
      );
    }
    logVerbose(`Accessibility tree has ${snapshot.tree.length} root nodes`);

    const locateResult = await locateElement(llm, {
      snapshot,
      query: options.find,
    });

    if (!locateResult.ref) {
      throw new ElementNotFoundError(
        options.find,
        'LLM did not return an element reference'
      );
    }
    logVerbose(`Found element: ${locateResult.ref} (confidence: ${locateResult.confidence})`);

    // Resolve ref to selector - resolveRefToSelector returns string | null
    const resolvedSelector = await resolveRefToSelector(page, locateResult.ref);
    if (!resolvedSelector) {
      throw new ElementNotFoundError(
        locateResult.ref,
        `Could not resolve element reference: ${locateResult.ref}`
      );
    }

    return { selector: resolvedSelector, snapshot };
  }

  // Interactive mode - launch visual picker
  if (options.interactive) {
    spinner.text = 'Waiting for element selection...';
    const pickerResult = await ctx.browser.launchInteractivePicker();
    logVerbose(`User selected: <${pickerResult.tagName}> "${pickerResult.textPreview}"`);
    logVerbose(`Selector: ${pickerResult.selector}`);
    return { selector: pickerResult.selector };
  }

  throw new ValidationError('selector', 'Either --selector, --find, or --interactive is required');
}

/**
 * Stage 3: Extract - Get HTML and styles from element
 */
async function extractFromElement(
  ctx: StageContext,
  page: Page,
  selector: string
): Promise<ExtractedElement> {
  const spinner = createSpinner('Extracting HTML and styles...');
  spinner.start();
  const start = Date.now();

  try {
    const extracted = await extractElement(page, selector);

    const originalSize = extracted.html.length + extracted.css.length;
    logVerbose(`Extracted ${extracted.html.length} bytes HTML, ${extracted.css.length} bytes CSS`);
    logVerbose(`Found ${extracted.assets.length} assets`);

    ctx.timing.extract = Date.now() - start;
    spinner.succeed(
      `Extracted (${formatBytes(originalSize)} → ${formatBytes(extracted.html.length + extracted.css.length)})`
    );

    return extracted;
  } catch (error) {
    spinner.fail('Failed to extract element');
    throw error;
  }
}

/**
 * Stage 4: Transform - Convert to framework component
 */
async function transformToFramework(
  ctx: StageContext,
  extracted: ExtractedElement,
  componentName: string
): Promise<TransformResult> {
  const { options, llm } = ctx;
  const spinner = createSpinner(
    `Transforming to ${options.framework} + ${options.styling}...`
  );
  spinner.start();
  const start = Date.now();

  try {
    const transformed = await transformToComponent(llm, {
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

    ctx.timing.transform = Date.now() - start;
    spinner.succeed(`Transformed to ${options.framework}`);

    return transformed;
  } catch (error) {
    spinner.fail('Failed to transform component');
    throw wrapLLMError(error);
  }
}

/**
 * Stage 5: Write - Output files and download assets
 */
async function writeOutput(
  ctx: StageContext,
  componentName: string,
  transformed: TransformResult,
  extracted: ExtractedElement
): Promise<OutputResult> {
  const { options, output } = ctx;
  const spinner = createSpinner('Writing files...');
  spinner.start();
  const start = Date.now();

  try {
    const result = await output.write(componentName, transformed);

    // Download assets with graceful degradation
    if (options.includeAssets && extracted.assets.length > 0) {
      const downloaded = await downloadAssetsWithLogging(extracted.assets, options.outputDir);
      result.assets = downloaded;
    }

    ctx.timing.write = Date.now() - start;
    spinner.succeed(`Written ${result.files.length} files`);

    return result;
  } catch (error) {
    spinner.fail('Failed to write output');
    throw error;
  }
}

/**
 * Download assets with logging for failures (graceful degradation)
 */
async function downloadAssetsWithLogging(
  assets: ExtractedElement['assets'],
  outputDir: string
): Promise<OutputResult['assets']> {
  try {
    const downloaded = await downloadAssets(assets, outputDir);
    const successCount = downloaded.length;
    const failCount = assets.length - successCount;

    if (failCount > 0) {
      logWarn(`Downloaded ${successCount}/${assets.length} assets (${failCount} failed)`);
    } else {
      logVerbose(`Downloaded ${downloaded.length} assets`);
    }

    return downloaded;
  } catch (error) {
    // Catch any unexpected errors from the download process
    logWarn(`Asset download failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// ============================================================================
// Error Helpers
// ============================================================================

/**
 * Wrap errors from LLM operations with specific error types
 */
function wrapLLMError(error: unknown): Error {
  // Already a SnatchError, preserve it
  if (isSnatchError(error)) {
    return error;
  }

  // Generic Error - wrap based on message content
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return new LLMTimeoutError(120000, error.message);
    }
    if (message.includes('not available') || message.includes('not installed') || message.includes('not authenticated')) {
      return new LLMNotAvailableError(error.message);
    }

    return new LLMError(error.message, error);
  }

  return new LLMError(String(error));
}

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Run the full extraction pipeline
 * @param options - Snatch options for extraction
 * @param internalOpts - Internal options for browser sharing (used by orchestrateBatch)
 */
export async function orchestrate(
  options: SnatchOptions,
  internalOpts: OrchestrateInternalOptions = {}
): Promise<PipelineResult> {
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

  // Use shared browser/LLM/output if provided, otherwise create new
  const isBrowserShared = !!internalOpts.sharedBrowser;
  const isLLMShared = !!internalOpts.sharedLLM;
  const isOutputShared = !!internalOpts.sharedOutput;
  const browser = internalOpts.sharedBrowser ?? new BrowserManager({ headless: !options.interactive });

  // Initialize context - use shared resources if provided, otherwise create new
  // Note: when using shared output, we update its config to use this component's outputDir
  // IMPORTANT: Batch processing is sequential - setConfig() is safe because components are processed one at a time
  const output = internalOpts.sharedOutput ?? new OutputWriter({ baseDir: options.outputDir });
  if (internalOpts.sharedOutput) {
    output.setConfig({ baseDir: options.outputDir });
  }

  const ctx: StageContext = {
    options,
    browser,
    llm: internalOpts.sharedLLM ?? new LLMClient(),
    output,
    timing,
    sharedBrowser: isBrowserShared,
    sharedLLM: isLLMShared,
    sharedOutput: isOutputShared,
  };

  try {
    // Stage 1: Browse
    const { page } = await browseAndNavigate(ctx);

    // Stage 2: Locate
    const { selector } = await locateTargetElement(ctx, page);

    // Stage 3: Extract
    const extracted = await extractFromElement(ctx, page, selector);

    // Stage 4: Transform
    const componentName =
      options.componentName || generateComponentName(options.find || options.selector || 'Component');
    const transformed = await transformToFramework(ctx, extracted, componentName);

    // Stage 5: Write
    const result = await writeOutput(ctx, componentName, transformed, extracted);

    // Summary
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

    // Use formatError for better error display
    logError(isSnatchError(error) ? formatError(error) : (error instanceof Error ? error.message : String(error)));

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      timing,
    };
  } finally {
    // Only close browser if we own it (not shared)
    if (!ctx.sharedBrowser) {
      try {
        await ctx.browser.close();
      } catch (closeError) {
        // Log but don't rethrow - primary error (if any) takes precedence
        logWarn(`Browser cleanup failed: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
      }
    }
  }
}

// ============================================================================
// Batch Orchestration
// ============================================================================

interface BatchOptions {
  verbose?: boolean;
}

/**
 * Run batch extraction for multiple components
 * Reuses a single browser instance across all components for efficiency
 * Continues on error - collects all results
 */
export async function orchestrateBatch(
  config: BatchConfig,
  options: BatchOptions = {}
): Promise<BatchResult> {
  const totalStart = Date.now();
  const results: BatchComponentResult[] = [];
  const { defaults } = config;

  setVerbose(options.verbose ?? false);

  // Handle empty batch early - don't launch browser for nothing
  if (config.components.length === 0) {
    logWarn('No components to extract');
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      totalTime: Date.now() - totalStart,
    };
  }

  logVerbose(`Starting batch extraction of ${config.components.length} components`);

  // Create shared browser, LLM client, and output writer for all components
  const sharedBrowser = new BrowserManager({ headless: true });
  const sharedLLM = new LLMClient();
  const sharedOutput = new OutputWriter();

  // Launch browser - handle failure gracefully
  try {
    await sharedBrowser.launch();
    logVerbose('Launched shared browser for batch processing');
  } catch (launchError) {
    const message = launchError instanceof Error ? launchError.message : String(launchError);
    logError(`Failed to launch browser: ${message}`);

    // Return failed result for all components
    return {
      total: config.components.length,
      succeeded: 0,
      failed: config.components.length,
      results: config.components.map(comp => ({
        name: comp.name,
        success: false,
        error: `Browser launch failed: ${message}`,
      })),
      totalTime: Date.now() - totalStart,
    };
  }

  try {
    for (const [i, comp] of config.components.entries()) {
      const progress = `[${i + 1}/${config.components.length}]`;

      logInfo(`${progress} Extracting: ${comp.name}`);

      // Merge component options with defaults
      const snatchOptions: SnatchOptions = {
        url: comp.url,
        selector: comp.selector,
        find: comp.find,
        framework: comp.framework ?? defaults?.framework ?? 'react',
        styling: comp.styling ?? defaults?.styling ?? 'tailwind',
        outputDir: comp.outputDir ?? defaults?.outputDir ?? './components',
        componentName: comp.name,
        interactive: false, // Batch mode never interactive
        includeAssets: comp.includeAssets ?? defaults?.includeAssets ?? false,
        verbose: options.verbose,
      };

      try {
        const result = await orchestrate(snatchOptions, { sharedBrowser, sharedLLM, sharedOutput });

        if (result.success) {
          results.push({
            name: comp.name,
            success: true,
            result,
          });
        } else {
          results.push({
            name: comp.name,
            success: false,
            result,
            error: result.error?.message ?? 'Unknown error',
          });
        }
      } catch (error) {
        // Catch any uncaught errors from orchestrate
        const message = error instanceof Error ? error.message : String(error);
        logError(`${comp.name} failed: ${message}`);

        results.push({
          name: comp.name,
          success: false,
          error: message,
        });
      }
    }
  } finally {
    // Always close shared browser when done
    try {
      await sharedBrowser.close();
      logVerbose('Closed shared browser');
    } catch (closeError) {
      logWarn(`Shared browser cleanup failed: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: config.components.length,
    succeeded,
    failed,
    results,
    totalTime: Date.now() - totalStart,
  };
}
