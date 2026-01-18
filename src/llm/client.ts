/**
 * LLM Client
 *
 * Wrapper around subclaude for Claude API calls.
 */

import type { LLMConfig, TokenUsage } from '../types/index.ts';
import { askClaude, checkClaude } from 'subclaude';
import { LLMError, LLMNotAvailableError, LLMTimeoutError } from '../errors/index.ts';

// Type declarations for subclaude (untyped library)
interface SubclaudeFullResponse {
  result: string;
  usage?: { input_tokens: number; output_tokens: number };
  total_cost_usd: number;
}

function isSubclaudeFullResponse(value: unknown): value is SubclaudeFullResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    typeof (value as SubclaudeFullResponse).result === 'string'
  );
}

// Error code patterns for subclaude errors (more robust than string matching)
const ERROR_PATTERNS = {
  notAvailable: [/CLI_NOT_FOUND/i, /NOT_AUTHENTICATED/i, /ENOENT.*claude/i],
  timeout: [/TIMEOUT/i, /ETIMEDOUT/i, /timed?\s*out/i],
} as const;

function matchesErrorPattern(message: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

const DEFAULT_CONFIG: LLMConfig = {
  model: 'sonnet',
  timeout: 120000,
};

export interface LLMResponse {
  content: string;
  tokens?: TokenUsage;
}

export class LLMClient {
  private config: LLMConfig;

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Send prompt to Claude and get response
   */
  async ask(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    try {
      const response = await askClaude(prompt, {
        systemPrompt: systemPrompt || this.config.systemPrompt,
        model: this.config.model,
        timeout: this.config.timeout,
        fullResponse: true,
      });

      // fullResponse: true returns object with result and usage
      if (!isSubclaudeFullResponse(response)) {
        throw new LLMError('Unexpected response format from Claude API');
      }

      return {
        content: response.result,
        tokens: response.usage
          ? {
              input: response.usage.input_tokens,
              output: response.usage.output_tokens,
              total: response.usage.input_tokens + response.usage.output_tokens,
            }
          : undefined,
      };
    } catch (error) {
      // Re-throw our own errors as-is
      if (error instanceof LLMError) {
        throw error;
      }

      // Handle subclaude errors using pattern matching
      if (error instanceof Error) {
        const message = error.message;

        if (matchesErrorPattern(message, ERROR_PATTERNS.notAvailable)) {
          throw new LLMNotAvailableError(message);
        }
        if (matchesErrorPattern(message, ERROR_PATTERNS.timeout)) {
          throw new LLMTimeoutError(this.config.timeout, message);
        }
        throw new LLMError(message, error);
      }
      throw new LLMError(String(error));
    }
  }

  /**
   * Check if Claude CLI is available and authenticated
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const status = await checkClaude();
      return status.installed && status.authenticated;
    } catch {
      return false;
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.config.model;
  }
}
