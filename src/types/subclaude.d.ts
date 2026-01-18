/**
 * Type declarations for subclaude (untyped library)
 */

declare module 'subclaude' {
  export interface AskClaudeOptions {
    systemPrompt?: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    timeout?: number;
    fullResponse?: boolean;
  }

  export interface AskClaudeFullResponse {
    result: string;
    usage?: { input_tokens: number; output_tokens: number };
    total_cost_usd: number;
  }

  export interface CheckClaudeResult {
    installed: boolean;
    authenticated: boolean;
  }

  export function askClaude(
    prompt: string,
    options?: AskClaudeOptions
  ): Promise<string | AskClaudeFullResponse>;

  export function checkClaude(): Promise<CheckClaudeResult>;
}
