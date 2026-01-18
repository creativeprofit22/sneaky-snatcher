/**
 * Subclaude - Claude CLI Wrapper
 *
 * Wraps the `claude` CLI for programmatic access.
 * Uses existing Claude Code authentication.
 */

import { spawn } from 'node:child_process';

export interface AskClaudeOptions {
  systemPrompt?: string;
  model?: string;
  timeout?: number;
  fullResponse?: boolean;
}

export interface ClaudeFullResponse {
  result: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  total_cost_usd: number;
  duration_ms?: number;
  session_id?: string;
}

export interface ClaudeStatus {
  installed: boolean;
  authenticated: boolean;
}

interface ClaudeJsonResponse {
  type: string;
  subtype: string;
  is_error: boolean;
  result: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  total_cost_usd: number;
  duration_ms: number;
  session_id: string;
}

/**
 * Send a prompt to Claude CLI and get response
 */
export async function askClaude(
  prompt: string,
  options: AskClaudeOptions = {}
): Promise<string | ClaudeFullResponse> {
  const { systemPrompt, model = 'sonnet', timeout = 120000, fullResponse = false } = options;

  const args = ['-p', '--output-format', 'json', '--model', model];

  if (systemPrompt) {
    args.push('--system-prompt', systemPrompt);
  }

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Send prompt via stdin
    claude.stdin.write(prompt);
    claude.stdin.end();

    // Timeout handling
    const timeoutId = setTimeout(() => {
      claude.kill('SIGTERM');
      reject(new Error(`TIMEOUT: Claude CLI timed out after ${timeout}ms`));
    }, timeout);

    claude.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr || stdout}`));
        return;
      }

      try {
        const response = JSON.parse(stdout) as ClaudeJsonResponse;

        if (response.is_error) {
          reject(new Error(`Claude error: ${response.result}`));
          return;
        }

        if (fullResponse) {
          resolve({
            result: response.result,
            usage: response.usage
              ? {
                  input_tokens: response.usage.input_tokens +
                    (response.usage.cache_creation_input_tokens || 0) +
                    (response.usage.cache_read_input_tokens || 0),
                  output_tokens: response.usage.output_tokens,
                }
              : undefined,
            total_cost_usd: response.total_cost_usd,
            duration_ms: response.duration_ms,
            session_id: response.session_id,
          });
        } else {
          resolve(response.result);
        }
      } catch {
        // If JSON parsing fails, return raw stdout as result
        if (fullResponse) {
          resolve({ result: stdout, total_cost_usd: 0 });
        } else {
          resolve(stdout);
        }
      }
    });

    claude.on('error', (err) => {
      clearTimeout(timeoutId);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('CLI_NOT_FOUND: Claude CLI not found. Install with: npm i -g @anthropic-ai/claude-code'));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Check if Claude CLI is installed and authenticated
 */
export async function checkClaude(): Promise<ClaudeStatus> {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';

    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0 && stdout.includes('claude')) {
        // Version check passed, assume authenticated
        // (Full auth check would require an actual API call)
        resolve({ installed: true, authenticated: true });
      } else {
        resolve({ installed: false, authenticated: false });
      }
    });

    claude.on('error', () => {
      resolve({ installed: false, authenticated: false });
    });
  });
}
