/**
 * LLM Client
 *
 * Wrapper around subclaude for Claude API calls.
 */

import type { LLMConfig, TokenUsage } from '../types/index.js';

// Note: subclaude types would be imported here
// import { askClaude, checkClaude } from 'subclaude';

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
    // TODO: Replace with actual subclaude implementation
    // const response = await askClaude(prompt, {
    //   systemPrompt: systemPrompt || this.config.systemPrompt,
    //   model: this.config.model,
    //   timeout: this.config.timeout,
    //   fullResponse: true,
    // });

    // Placeholder for development
    console.warn('[LLM] subclaude integration pending - returning mock response');

    return {
      content: `// Mock response for: ${prompt.slice(0, 50)}...`,
      tokens: {
        input: 0,
        output: 0,
        total: 0,
      },
    };
  }

  /**
   * Check if Claude CLI is available and authenticated
   */
  async checkAvailability(): Promise<boolean> {
    // TODO: Replace with actual subclaude check
    // return await checkClaude();

    console.warn('[LLM] subclaude availability check pending');
    return true;
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
