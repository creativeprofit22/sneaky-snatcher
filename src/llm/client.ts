/**
 * LLM Client
 *
 * Wrapper around subclaude for Claude API calls.
 */

import type { LLMConfig, TokenUsage } from '../types/index.ts';
import { askClaude, checkClaude, ClaudeError } from 'subclaude';
import { LLMError, LLMNotAvailableError, LLMTimeoutError } from '../errors/index.ts';

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
      const fullResponse = response as {
        result: string;
        usage?: { input_tokens: number; output_tokens: number };
        total_cost_usd: number;
      };

      return {
        content: fullResponse.result,
        tokens: fullResponse.usage
          ? {
              input: fullResponse.usage.input_tokens,
              output: fullResponse.usage.output_tokens,
              total: fullResponse.usage.input_tokens + fullResponse.usage.output_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof ClaudeError) {
        // Map subclaude errors to our error classes
        if (error.message.includes('CLI_NOT_FOUND') || error.message.includes('NOT_AUTHENTICATED')) {
          throw new LLMNotAvailableError(error.message);
        }
        if (error.message.includes('TIMEOUT')) {
          throw new LLMTimeoutError(this.config.timeout, error.message);
        }
        throw new LLMError(error.message, error);
      }
      throw new LLMError(error instanceof Error ? error.message : String(error));
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
