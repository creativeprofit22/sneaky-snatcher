/**
 * Core type definitions for Sneaky Snatcher
 */

// ============================================================================
// CLI Options
// ============================================================================

export interface SnatchOptions {
  /** Target URL to extract from */
  url: string;
  /** CSS selector to target element */
  selector?: string;
  /** Natural language description to find element */
  find?: string;
  /** Output framework */
  framework: Framework;
  /** Styling approach */
  styling: Styling;
  /** Output directory */
  outputDir: string;
  /** Component name (auto-generated if not provided) */
  componentName?: string;
  /** Run in interactive mode with visible browser */
  interactive?: boolean;
  /** Include assets (images, fonts) */
  includeAssets?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

export type Framework = 'react' | 'vue' | 'svelte' | 'html';
export type Styling = 'tailwind' | 'css-modules' | 'vanilla' | 'inline';

// ============================================================================
// Browser Module
// ============================================================================

export interface BrowserConfig {
  /** Run in headless mode */
  headless: boolean;
  /** Browser viewport */
  viewport: Viewport;
  /** Navigation timeout in ms */
  timeout: number;
  /** User agent string */
  userAgent?: string;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface AccessibilityNode {
  /** Semantic reference (e.g., @e1, @e2) */
  ref: string;
  /** ARIA role */
  role: string;
  /** Node name/label */
  name: string;
  /** Child nodes */
  children?: AccessibilityNode[];
  /** Associated DOM selector */
  selector?: string;
}

export interface PageSnapshot {
  /** URL of the page */
  url: string;
  /** Page title */
  title: string;
  /** Accessibility tree */
  tree: AccessibilityNode[];
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Extractor Module
// ============================================================================

export interface ExtractedElement {
  /** Raw HTML of the element */
  html: string;
  /** Reduced CSS styles */
  css: string;
  /** Original computed styles (before reduction) */
  originalCss?: string;
  /** Tag name */
  tagName: string;
  /** Class names */
  classNames: string[];
  /** Assets referenced by this element */
  assets: Asset[];
  /** Bounding box */
  boundingBox?: BoundingBox;
}

export interface Asset {
  /** Asset type */
  type: 'image' | 'font' | 'icon' | 'background';
  /** Original URL */
  url: string;
  /** Local filename after download */
  filename?: string;
  /** MIME type */
  mimeType?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StyleReducerOptions {
  /** Remove inherited styles */
  removeInherited?: boolean;
  /** Remove vendor prefixes */
  removeVendorPrefixes?: boolean;
  /** Convert to shorthand properties */
  useShorthand?: boolean;
  /** Remove default browser values */
  removeDefaults?: boolean;
}

// ============================================================================
// LLM Module
// ============================================================================

export interface LLMConfig {
  /** Claude model to use */
  model: 'sonnet' | 'opus' | 'haiku';
  /** Request timeout in ms */
  timeout: number;
  /** System prompt override */
  systemPrompt?: string;
}

export interface TransformRequest {
  /** Extracted HTML */
  html: string;
  /** Reduced CSS */
  css: string;
  /** Target framework */
  framework: Framework;
  /** Styling approach */
  styling: Styling;
  /** Component name */
  componentName: string;
  /** Additional instructions */
  instructions?: string;
}

export interface TransformResult {
  /** Generated component code */
  code: string;
  /** Separate styles file content (if applicable) */
  styles?: string;
  /** Suggested filename */
  filename: string;
  /** Props interface (for TypeScript) */
  propsInterface?: string;
  /** Token usage */
  tokens?: TokenUsage;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface LocateRequest {
  /** Accessibility snapshot */
  snapshot: PageSnapshot;
  /** Natural language query */
  query: string;
}

export interface LocateResult {
  /** Matched element reference */
  ref: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Explanation */
  reasoning?: string;
}

// ============================================================================
// Output Module
// ============================================================================

export interface OutputConfig {
  /** Base output directory */
  baseDir: string;
  /** Create index barrel export */
  createIndex?: boolean;
  /** Generate Storybook stories */
  generateStories?: boolean;
  /** Asset subdirectory name */
  assetDir?: string;
}

export interface OutputResult {
  /** Written files */
  files: WrittenFile[];
  /** Downloaded assets */
  assets: DownloadedAsset[];
  /** Component import path */
  importPath: string;
}

export interface WrittenFile {
  path: string;
  type: 'component' | 'styles' | 'types' | 'story' | 'index';
  size: number;
}

export interface DownloadedAsset {
  originalUrl: string;
  localPath: string;
  size: number;
}

// ============================================================================
// Pipeline
// ============================================================================

export interface PipelineResult {
  /** Success status */
  success: boolean;
  /** Output details */
  output?: OutputResult;
  /** Error if failed */
  error?: Error;
  /** Timing metrics */
  timing: PipelineTiming;
}

export interface PipelineTiming {
  browse: number;
  locate: number;
  extract: number;
  transform: number;
  write: number;
  total: number;
}

// ============================================================================
// Batch Extraction
// ============================================================================

/** Configuration for a single component in a batch */
export interface BatchComponent {
  /** Target URL to extract from */
  url: string;
  /** CSS selector to target element */
  selector?: string;
  /** Natural language description to find element */
  find?: string;
  /** Component name (required for batch) */
  name: string;
  /** Override framework for this component */
  framework?: Framework;
  /** Override styling for this component */
  styling?: Styling;
  /** Override output directory for this component */
  outputDir?: string;
  /** Include assets for this component */
  includeAssets?: boolean;
}

/** Default options applied to all batch components */
export interface BatchDefaults {
  /** Default framework */
  framework?: Framework;
  /** Default styling */
  styling?: Styling;
  /** Default output directory */
  outputDir?: string;
  /** Default include assets */
  includeAssets?: boolean;
}

/** Batch configuration file structure */
export interface BatchConfig {
  /** List of components to extract */
  components: BatchComponent[];
  /** Default options for all components */
  defaults?: BatchDefaults;
}

/** Result of a single component extraction in a batch */
export interface BatchComponentResult {
  /** Component name */
  name: string;
  /** Whether extraction succeeded */
  success: boolean;
  /** Pipeline result if successful */
  result?: PipelineResult;
  /** Error message if failed */
  error?: string;
}

/** Result of a batch extraction */
export interface BatchResult {
  /** Total components processed */
  total: number;
  /** Number of successful extractions */
  succeeded: number;
  /** Number of failed extractions */
  failed: number;
  /** Individual component results */
  results: BatchComponentResult[];
  /** Total time in ms */
  totalTime: number;
}

// ============================================================================
// Config File
// ============================================================================

/** Config file (.snatchrc) structure */
export interface FileConfig {
  /** Output framework */
  framework?: Framework;
  /** Styling approach */
  styling?: Styling;
  /** Output directory */
  outputDir?: string;
  /** Run in headless mode */
  headless?: boolean;
  /** Include assets by default */
  includeAssets?: boolean;
  /** Verbose logging */
  verbose?: boolean;
  /** LLM configuration */
  llm?: {
    model?: 'sonnet' | 'opus' | 'haiku';
    timeout?: number;
  };
  /** Browser configuration */
  browser?: {
    viewport?: { width?: number; height?: number };
    timeout?: number;
  };
}

/** Config validation error */
export interface ConfigValidationError {
  /** Property path (e.g., "llm.model") */
  path: string;
  /** Error message */
  message: string;
  /** Received value */
  received?: unknown;
}
