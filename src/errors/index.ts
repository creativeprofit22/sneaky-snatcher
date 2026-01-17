/**
 * Error Classes
 *
 * Custom errors for better error handling and user feedback.
 */

/**
 * Base error for Sneaky Snatcher
 */
export class SnatchError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'SnatchError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Browser-related errors
 */
export class BrowserError extends SnatchError {
  constructor(message: string, cause?: Error) {
    super(message, 'BROWSER_ERROR', cause);
    this.name = 'BrowserError';
  }
}

/**
 * Navigation errors (URL not found, timeout, etc.)
 */
export class NavigationError extends BrowserError {
  constructor(
    public url: string,
    message?: string,
    cause?: Error
  ) {
    super(message || `Failed to navigate to: ${url}`, cause);
    this.name = 'NavigationError';
    this.code = 'NAVIGATION_ERROR';
  }
}

/**
 * Element not found errors
 */
export class ElementNotFoundError extends SnatchError {
  constructor(
    public selector: string,
    message?: string
  ) {
    super(message || `Element not found: ${selector}`, 'ELEMENT_NOT_FOUND');
    this.name = 'ElementNotFoundError';
  }
}

/**
 * LLM-related errors
 */
export class LLMError extends SnatchError {
  constructor(message: string, cause?: Error) {
    super(message, 'LLM_ERROR', cause);
    this.name = 'LLMError';
  }
}

/**
 * LLM not available (CLI not installed, not authenticated)
 */
export class LLMNotAvailableError extends LLMError {
  constructor(message?: string) {
    super(message || 'Claude CLI is not available. Please install and authenticate.');
    this.name = 'LLMNotAvailableError';
    this.code = 'LLM_NOT_AVAILABLE';
  }
}

/**
 * LLM request timeout
 */
export class LLMTimeoutError extends LLMError {
  constructor(
    public timeoutMs: number,
    message?: string
  ) {
    super(message || `LLM request timed out after ${timeoutMs}ms`);
    this.name = 'LLMTimeoutError';
    this.code = 'LLM_TIMEOUT';
  }
}

/**
 * Extraction errors
 */
export class ExtractionError extends SnatchError {
  constructor(message: string, cause?: Error) {
    super(message, 'EXTRACTION_ERROR', cause);
    this.name = 'ExtractionError';
  }
}

/**
 * Transformation errors
 */
export class TransformationError extends SnatchError {
  constructor(message: string, cause?: Error) {
    super(message, 'TRANSFORMATION_ERROR', cause);
    this.name = 'TransformationError';
  }
}

/**
 * Output/file writing errors
 */
export class OutputError extends SnatchError {
  constructor(
    public path: string,
    message?: string,
    cause?: Error
  ) {
    super(message || `Failed to write output: ${path}`, 'OUTPUT_ERROR', cause);
    this.name = 'OutputError';
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends SnatchError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends SnatchError {
  constructor(
    public field: string,
    message: string
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Check if error is a SnatchError
 */
export function isSnatchError(error: unknown): error is SnatchError {
  return error instanceof SnatchError;
}

/**
 * Format error for user display
 */
export function formatError(error: unknown): string {
  if (isSnatchError(error)) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
