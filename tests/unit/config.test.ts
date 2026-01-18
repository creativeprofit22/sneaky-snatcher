/**
 * Config Module Unit Tests
 *
 * Tests for:
 * - Config file loading from cwd and home dir
 * - Schema validation with helpful errors
 * - Config merging (CLI > ENV > File > Defaults)
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

import { DEFAULTS, SUPPORTED_FRAMEWORKS, SUPPORTED_STYLING } from '../../src/config/constants.ts';
import { loadConfig, validateFileConfig, type Config } from '../../src/config/loader.ts';

// ============================================================================
// Constants Tests
// ============================================================================

describe('Config Constants', () => {
  describe('DEFAULTS', () => {
    test('has valid default framework', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain(DEFAULTS.framework);
    });

    test('has valid default styling', () => {
      expect(SUPPORTED_STYLING).toContain(DEFAULTS.styling);
    });

    test('has reasonable timeout values', () => {
      expect(DEFAULTS.timeout).toBeGreaterThan(1000);
      expect(DEFAULTS.llmTimeout).toBeGreaterThan(DEFAULTS.timeout);
    });

    test('has valid viewport dimensions', () => {
      expect(DEFAULTS.viewport.width).toBeGreaterThan(0);
      expect(DEFAULTS.viewport.height).toBeGreaterThan(0);
    });

    test('headless defaults to true', () => {
      expect(DEFAULTS.headless).toBe(true);
    });

    test('verbose defaults to false', () => {
      expect(DEFAULTS.verbose).toBe(false);
    });

    test('includeAssets defaults to false', () => {
      expect(DEFAULTS.includeAssets).toBe(false);
    });
  });

  describe('SUPPORTED_FRAMEWORKS', () => {
    test('includes react', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('react');
    });

    test('includes vue', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('vue');
    });

    test('includes svelte', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('svelte');
    });

    test('includes html', () => {
      expect(SUPPORTED_FRAMEWORKS).toContain('html');
    });

    test('has exactly 4 frameworks', () => {
      expect(SUPPORTED_FRAMEWORKS).toHaveLength(4);
    });
  });

  describe('SUPPORTED_STYLING', () => {
    test('includes tailwind', () => {
      expect(SUPPORTED_STYLING).toContain('tailwind');
    });

    test('includes css-modules', () => {
      expect(SUPPORTED_STYLING).toContain('css-modules');
    });

    test('includes vanilla', () => {
      expect(SUPPORTED_STYLING).toContain('vanilla');
    });

    test('includes inline', () => {
      expect(SUPPORTED_STYLING).toContain('inline');
    });

    test('has exactly 4 styling options', () => {
      expect(SUPPORTED_STYLING).toHaveLength(4);
    });
  });
});

// ============================================================================
// Config File Loading Tests
// ============================================================================

describe('Config File Loading', () => {
  const testDir = join(tmpdir(), 'snatch-test-' + Date.now());
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    // Clear any SNATCH_ env vars
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SNATCH_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore cwd
    process.chdir(originalCwd);
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    // Restore env
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SNATCH_')) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  describe('loadConfig() with file', () => {
    test('loads .snatchrc.json from cwd', async () => {
      const configContent = {
        framework: 'vue',
        styling: 'css-modules',
        outputDir: './custom-output',
      };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.framework).toBe('vue');
      expect(config.styling).toBe('css-modules');
      expect(config.outputDir).toBe('./custom-output');
    });

    test('loads .snatchrc from cwd (JSON without extension)', async () => {
      const configContent = {
        framework: 'svelte',
        styling: 'vanilla',
      };
      writeFileSync(join(testDir, '.snatchrc'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.framework).toBe('svelte');
      expect(config.styling).toBe('vanilla');
    });

    test('loads snatch.config.json from cwd', async () => {
      const configContent = {
        framework: 'html',
        styling: 'inline',
      };
      writeFileSync(join(testDir, 'snatch.config.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.framework).toBe('html');
      expect(config.styling).toBe('inline');
    });

    test('prefers .snatchrc.json over .snatchrc', async () => {
      // .snatchrc.json should take priority
      writeFileSync(
        join(testDir, '.snatchrc.json'),
        JSON.stringify({ framework: 'react' })
      );
      writeFileSync(
        join(testDir, '.snatchrc'),
        JSON.stringify({ framework: 'vue' })
      );
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.framework).toBe('react');
    });

    test('returns defaults when no config file found', async () => {
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.framework).toBe(DEFAULTS.framework);
      expect(config.styling).toBe(DEFAULTS.styling);
      expect(config.outputDir).toBe(DEFAULTS.outputDir);
      expect(config.headless).toBe(DEFAULTS.headless);
    });

    test('throws error for invalid JSON', async () => {
      writeFileSync(join(testDir, '.snatchrc.json'), 'not valid json {{{');
      process.chdir(testDir);

      // Should throw with helpful error message
      await expect(loadConfig()).rejects.toThrow('Invalid JSON');
    });

    test('throws error for invalid config values', async () => {
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify({
        framework: 'angular', // not supported
      }));
      process.chdir(testDir);

      await expect(loadConfig()).rejects.toThrow('framework');
    });

    test('loads nested llm config', async () => {
      const configContent = {
        llm: {
          model: 'opus',
          timeout: 180000,
        },
      };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.llm.model).toBe('opus');
      expect(config.llm.timeout).toBe(180000);
    });

    test('loads nested browser config', async () => {
      const configContent = {
        browser: {
          viewport: { width: 1280, height: 720 },
          timeout: 60000,
        },
      };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.browser.viewport.width).toBe(1280);
      expect(config.browser.viewport.height).toBe(720);
      expect(config.browser.timeout).toBe(60000);
    });

    test('deep merges nested config with defaults', async () => {
      const configContent = {
        browser: {
          viewport: { width: 1280 },
          // height not specified, should use default
        },
      };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.browser.viewport.width).toBe(1280);
      expect(config.browser.viewport.height).toBe(DEFAULTS.viewport.height);
    });

    test('loads boolean fields correctly', async () => {
      const configContent = {
        headless: false,
        verbose: true,
        includeAssets: true,
      };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig();

      expect(config.headless).toBe(false);
      expect(config.verbose).toBe(true);
      expect(config.includeAssets).toBe(true);
    });
  });

  describe('loadConfig() with environment variables', () => {
    test('reads SNATCH_FRAMEWORK from env', async () => {
      process.chdir(testDir);
      process.env.SNATCH_FRAMEWORK = 'vue';

      const config = await loadConfig();

      expect(config.framework).toBe('vue');
    });

    test('reads SNATCH_STYLING from env', async () => {
      process.chdir(testDir);
      process.env.SNATCH_STYLING = 'css-modules';

      const config = await loadConfig();

      expect(config.styling).toBe('css-modules');
    });

    test('reads SNATCH_OUTPUT_DIR from env', async () => {
      process.chdir(testDir);
      process.env.SNATCH_OUTPUT_DIR = './env-output';

      const config = await loadConfig();

      expect(config.outputDir).toBe('./env-output');
    });

    test('reads SNATCH_VERBOSE=true from env', async () => {
      process.chdir(testDir);
      process.env.SNATCH_VERBOSE = 'true';

      const config = await loadConfig();

      expect(config.verbose).toBe(true);
    });

    test('reads SNATCH_VERBOSE=1 from env', async () => {
      process.chdir(testDir);
      process.env.SNATCH_VERBOSE = '1';

      const config = await loadConfig();

      expect(config.verbose).toBe(true);
    });

    test('ignores invalid SNATCH_FRAMEWORK value', async () => {
      process.chdir(testDir);
      process.env.SNATCH_FRAMEWORK = 'angular'; // not supported

      const config = await loadConfig();

      expect(config.framework).toBe(DEFAULTS.framework);
    });

    test('ignores invalid SNATCH_STYLING value', async () => {
      process.chdir(testDir);
      process.env.SNATCH_STYLING = 'sass'; // not supported

      const config = await loadConfig();

      expect(config.styling).toBe(DEFAULTS.styling);
    });

    test('env overrides file config', async () => {
      const configContent = { framework: 'vue' };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);
      process.env.SNATCH_FRAMEWORK = 'svelte';

      const config = await loadConfig();

      expect(config.framework).toBe('svelte');
    });
  });

  describe('loadConfig() with CLI options', () => {
    test('CLI framework overrides file and env', async () => {
      const configContent = { framework: 'vue' };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);
      process.env.SNATCH_FRAMEWORK = 'svelte';

      const config = await loadConfig({ framework: 'html' });

      expect(config.framework).toBe('html');
    });

    test('CLI styling overrides file', async () => {
      const configContent = { styling: 'css-modules' };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig({ styling: 'tailwind' });

      expect(config.styling).toBe('tailwind');
    });

    test('CLI outputDir overrides file', async () => {
      const configContent = { outputDir: './file-output' };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig({ outputDir: './cli-output' });

      expect(config.outputDir).toBe('./cli-output');
    });

    test('CLI verbose overrides file', async () => {
      const configContent = { verbose: false };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig({ verbose: true });

      expect(config.verbose).toBe(true);
    });

    test('CLI interactive sets headless to false', async () => {
      const configContent = { headless: true };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig({ interactive: true });

      expect(config.headless).toBe(false);
    });

    test('CLI includeAssets overrides file', async () => {
      const configContent = { includeAssets: false };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      const config = await loadConfig({ includeAssets: true });

      expect(config.includeAssets).toBe(true);
    });

    test('partial CLI options preserve file values', async () => {
      const configContent = {
        framework: 'vue',
        styling: 'css-modules',
        outputDir: './file-output',
      };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);

      // Only override framework via CLI
      const config = await loadConfig({ framework: 'react' });

      expect(config.framework).toBe('react');
      expect(config.styling).toBe('css-modules'); // preserved from file
      expect(config.outputDir).toBe('./file-output'); // preserved from file
    });
  });

  describe('config priority chain', () => {
    test('priority: CLI > ENV > File > Defaults', async () => {
      // Set up all layers
      const configContent = {
        framework: 'vue',
        styling: 'css-modules',
        outputDir: './file-output',
        verbose: false,
      };
      writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
      process.chdir(testDir);
      process.env.SNATCH_FRAMEWORK = 'svelte';
      process.env.SNATCH_STYLING = 'vanilla';

      const config = await loadConfig({
        framework: 'html',
        // styling not in CLI, should use env
        // outputDir not in CLI or env, should use file
        // verbose not in CLI or env, should use file
      });

      expect(config.framework).toBe('html'); // CLI wins
      expect(config.styling).toBe('vanilla'); // ENV wins over file
      expect(config.outputDir).toBe('./file-output'); // File wins over defaults
      expect(config.verbose).toBe(false); // File value
    });
  });
});

// ============================================================================
// validateFileConfig Tests
// ============================================================================

describe('validateFileConfig', () => {
  describe('valid configs', () => {
    test('validates valid config with all fields', () => {
      const result = validateFileConfig({
        framework: 'react',
        styling: 'tailwind',
        outputDir: './out',
        headless: true,
        verbose: false,
        includeAssets: true,
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(0);
      expect(result.config.framework).toBe('react');
      expect(result.config.styling).toBe('tailwind');
      expect(result.config.outputDir).toBe('./out');
    });

    test('validates empty object (all optional)', () => {
      const result = validateFileConfig({}, '.snatchrc.json');

      expect(result.errors).toHaveLength(0);
    });

    test('validates nested llm config', () => {
      const result = validateFileConfig({
        llm: {
          model: 'opus',
          timeout: 60000,
        },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(0);
      expect(result.config.llm?.model).toBe('opus');
      expect(result.config.llm?.timeout).toBe(60000);
    });

    test('validates browser viewport', () => {
      const result = validateFileConfig({
        browser: {
          viewport: { width: 1920, height: 1080 },
          timeout: 30000,
        },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(0);
      expect(result.config.browser?.viewport?.width).toBe(1920);
      expect(result.config.browser?.viewport?.height).toBe(1080);
    });

    test('validates haiku model', () => {
      const result = validateFileConfig({
        llm: { model: 'haiku' },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(0);
      expect(result.config.llm?.model).toBe('haiku');
    });

    test('validates sonnet model', () => {
      const result = validateFileConfig({
        llm: { model: 'sonnet' },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(0);
      expect(result.config.llm?.model).toBe('sonnet');
    });
  });

  describe('invalid top-level config', () => {
    test('rejects non-object config', () => {
      const result = validateFileConfig('not an object', '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an object');
    });

    test('rejects null config', () => {
      const result = validateFileConfig(null, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an object');
    });

    test('handles array config (passes validation but ignores array)', () => {
      // Note: Arrays are technically objects in JS, so typeof check passes
      // The current implementation doesn't reject arrays - it just ignores all elements
      // This is a known limitation; could be improved with Array.isArray() check
      const result = validateFileConfig(['not', 'valid'], '.snatchrc.json');

      // Array passes but no valid config properties are extracted
      expect(result.config.framework).toBeUndefined();
      expect(result.config.styling).toBeUndefined();
    });
  });

  describe('invalid framework', () => {
    test('rejects invalid framework string', () => {
      const result = validateFileConfig({
        framework: 'angular',
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('framework');
      expect(result.errors[0].message).toContain('Invalid framework');
      expect(result.errors[0].received).toBe('angular');
    });

    test('rejects non-string framework', () => {
      const result = validateFileConfig({
        framework: 123,
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('framework');
      expect(result.errors[0].received).toBe(123);
    });

    test('error message lists valid frameworks', () => {
      const result = validateFileConfig({
        framework: 'angular',
      }, '.snatchrc.json');

      expect(result.errors[0].message).toContain('react');
      expect(result.errors[0].message).toContain('vue');
      expect(result.errors[0].message).toContain('svelte');
      expect(result.errors[0].message).toContain('html');
    });
  });

  describe('invalid styling', () => {
    test('rejects invalid styling string', () => {
      const result = validateFileConfig({
        styling: 'sass',
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('styling');
      expect(result.errors[0].message).toContain('Invalid styling');
      expect(result.errors[0].received).toBe('sass');
    });

    test('rejects non-string styling', () => {
      const result = validateFileConfig({
        styling: null,
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('styling');
    });
  });

  describe('invalid llm config', () => {
    test('rejects invalid llm.model', () => {
      const result = validateFileConfig({
        llm: {
          model: 'gpt-4',
        },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('llm.model');
      expect(result.errors[0].received).toBe('gpt-4');
    });

    test('rejects negative llm.timeout', () => {
      const result = validateFileConfig({
        llm: { timeout: -1000 },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('llm.timeout');
      expect(result.errors[0].message).toContain('positive');
    });

    test('rejects zero llm.timeout', () => {
      const result = validateFileConfig({
        llm: { timeout: 0 },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('llm.timeout');
    });

    test('rejects non-number llm.timeout', () => {
      const result = validateFileConfig({
        llm: { timeout: '60000' },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('llm.timeout');
    });

    test('rejects non-object llm', () => {
      const result = validateFileConfig({
        llm: 'string',
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('llm');
      expect(result.errors[0].message).toContain('must be an object');
    });
  });

  describe('invalid browser config', () => {
    test('rejects non-object browser', () => {
      const result = validateFileConfig({
        browser: 'string',
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('browser');
    });

    test('rejects negative browser.timeout', () => {
      const result = validateFileConfig({
        browser: { timeout: -1 },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('browser.timeout');
    });

    test('rejects non-object viewport', () => {
      const result = validateFileConfig({
        browser: { viewport: 'string' },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('browser.viewport');
    });

    test('rejects negative viewport.width', () => {
      const result = validateFileConfig({
        browser: { viewport: { width: -100 } },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('browser.viewport.width');
    });

    test('rejects negative viewport.height', () => {
      const result = validateFileConfig({
        browser: { viewport: { height: -100 } },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('browser.viewport.height');
    });

    test('rejects string viewport dimensions', () => {
      const result = validateFileConfig({
        browser: { viewport: { width: '1920', height: '1080' } },
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].path).toBe('browser.viewport.width');
      expect(result.errors[1].path).toBe('browser.viewport.height');
    });
  });

  describe('invalid boolean fields', () => {
    test('rejects string headless', () => {
      const result = validateFileConfig({
        headless: 'true',
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('headless');
      expect(result.errors[0].message).toContain('must be a boolean');
    });

    test('rejects number verbose', () => {
      const result = validateFileConfig({
        verbose: 1,
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('verbose');
    });

    test('rejects string includeAssets', () => {
      const result = validateFileConfig({
        includeAssets: 'yes',
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('includeAssets');
    });
  });

  describe('invalid outputDir', () => {
    test('rejects non-string outputDir', () => {
      const result = validateFileConfig({
        outputDir: 123,
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('outputDir');
      expect(result.errors[0].message).toContain('must be a string');
    });
  });

  describe('multiple errors', () => {
    test('collects all validation errors', () => {
      const result = validateFileConfig({
        framework: 'invalid',
        styling: 'also-invalid',
        llm: { model: 'bad', timeout: -100 },
        headless: 'wrong',
      }, '.snatchrc.json');

      expect(result.errors.length).toBeGreaterThanOrEqual(5);

      const paths = result.errors.map(e => e.path);
      expect(paths).toContain('framework');
      expect(paths).toContain('styling');
      expect(paths).toContain('llm.model');
      expect(paths).toContain('llm.timeout');
      expect(paths).toContain('headless');
    });
  });

  describe('partial valid config', () => {
    test('returns valid fields even when some are invalid', () => {
      const result = validateFileConfig({
        framework: 'react', // valid
        styling: 'invalid', // invalid
        outputDir: './out', // valid
      }, '.snatchrc.json');

      expect(result.errors).toHaveLength(1);
      expect(result.config.framework).toBe('react');
      expect(result.config.outputDir).toBe('./out');
      expect(result.config.styling).toBeUndefined(); // invalid field not included
    });
  });

  describe('unknown properties', () => {
    test('ignores unknown top-level properties', () => {
      const result = validateFileConfig({
        framework: 'react',
        unknownProp: 'value',
        anotherUnknown: { nested: true },
      }, '.snatchrc.json');

      // No errors for unknown properties
      expect(result.errors).toHaveLength(0);
      expect(result.config.framework).toBe('react');
      // Unknown props are not copied to config
      expect((result.config as any).unknownProp).toBeUndefined();
    });
  });
});

// ============================================================================
// Config Structure Tests
// ============================================================================

describe('Config Structure', () => {
  test('loadConfig returns complete Config object', async () => {
    const config = await loadConfig();

    // Top-level properties
    expect(config).toHaveProperty('framework');
    expect(config).toHaveProperty('styling');
    expect(config).toHaveProperty('outputDir');
    expect(config).toHaveProperty('headless');
    expect(config).toHaveProperty('includeAssets');
    expect(config).toHaveProperty('verbose');

    // Nested llm config
    expect(config).toHaveProperty('llm');
    expect(config.llm).toHaveProperty('model');
    expect(config.llm).toHaveProperty('timeout');

    // Nested browser config
    expect(config).toHaveProperty('browser');
    expect(config.browser).toHaveProperty('viewport');
    expect(config.browser).toHaveProperty('timeout');
    expect(config.browser.viewport).toHaveProperty('width');
    expect(config.browser.viewport).toHaveProperty('height');
  });

  test('Config types are correct', async () => {
    const config = await loadConfig();

    expect(typeof config.framework).toBe('string');
    expect(typeof config.styling).toBe('string');
    expect(typeof config.outputDir).toBe('string');
    expect(typeof config.headless).toBe('boolean');
    expect(typeof config.includeAssets).toBe('boolean');
    expect(typeof config.verbose).toBe('boolean');
    expect(typeof config.llm.model).toBe('string');
    expect(typeof config.llm.timeout).toBe('number');
    expect(typeof config.browser.timeout).toBe('number');
    expect(typeof config.browser.viewport.width).toBe('number');
    expect(typeof config.browser.viewport.height).toBe('number');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  const testDir = join(tmpdir(), 'snatch-edge-' + Date.now());
  const originalCwd = process.cwd();

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SNATCH_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('handles empty object config', async () => {
    writeFileSync(join(testDir, '.snatchrc.json'), '{}');
    process.chdir(testDir);

    const config = await loadConfig();

    expect(config.framework).toBe(DEFAULTS.framework);
    expect(config.styling).toBe(DEFAULTS.styling);
  });

  test('handles partial nested config', async () => {
    const configContent = {
      llm: {
        model: 'haiku',
        // timeout not specified
      },
    };
    writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
    process.chdir(testDir);

    const config = await loadConfig();

    expect(config.llm.model).toBe('haiku');
    expect(config.llm.timeout).toBe(DEFAULTS.llmTimeout);
  });

  test('handles empty nested objects', async () => {
    const configContent = {
      llm: {},
      browser: {},
    };
    writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
    process.chdir(testDir);

    const config = await loadConfig();

    expect(config.llm.model).toBe(DEFAULTS.llmModel);
    expect(config.llm.timeout).toBe(DEFAULTS.llmTimeout);
    expect(config.browser.timeout).toBe(DEFAULTS.timeout);
    expect(config.browser.viewport.width).toBe(DEFAULTS.viewport.width);
  });

  test('handles config with only viewport width', async () => {
    const configContent = {
      browser: {
        viewport: { width: 1280 },
      },
    };
    writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
    process.chdir(testDir);

    const config = await loadConfig();

    expect(config.browser.viewport.width).toBe(1280);
    expect(config.browser.viewport.height).toBe(DEFAULTS.viewport.height);
  });

  test('handles config with only viewport height', async () => {
    const configContent = {
      browser: {
        viewport: { height: 720 },
      },
    };
    writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
    process.chdir(testDir);

    const config = await loadConfig();

    expect(config.browser.viewport.width).toBe(DEFAULTS.viewport.width);
    expect(config.browser.viewport.height).toBe(720);
  });

  test('whitespace-only JSON throws error', async () => {
    writeFileSync(join(testDir, '.snatchrc.json'), '   \n\t  ');
    process.chdir(testDir);

    await expect(loadConfig()).rejects.toThrow('Invalid JSON');
  });

  test('handles large timeout values', async () => {
    const configContent = {
      llm: { timeout: 600000 }, // 10 minutes
      browser: { timeout: 120000 }, // 2 minutes
    };
    writeFileSync(join(testDir, '.snatchrc.json'), JSON.stringify(configContent));
    process.chdir(testDir);

    const config = await loadConfig();

    expect(config.llm.timeout).toBe(600000);
    expect(config.browser.timeout).toBe(120000);
  });

  test('handles config with comments stripped', async () => {
    // JSON doesn't allow comments, but minified JSON should work
    const configContent = JSON.stringify({
      framework: 'vue',
      styling: 'tailwind',
    });
    writeFileSync(join(testDir, '.snatchrc.json'), configContent);
    process.chdir(testDir);

    const config = await loadConfig();

    expect(config.framework).toBe('vue');
    expect(config.styling).toBe('tailwind');
  });
});

// ============================================================================
// Home Directory Fallback Tests
// ============================================================================

describe('Home Directory Fallback', () => {
  // Note: These tests verify that the home directory is searched as a fallback.
  // Testing the actual home directory behavior requires mocking os.homedir(),
  // which is complex in Bun. Instead, we verify the behavior through integration.

  test('cwd config takes priority (integration test)', async () => {
    const testDir = join(tmpdir(), 'snatch-priority-' + Date.now());
    mkdirSync(testDir, { recursive: true });

    try {
      // Write config to test dir (simulating cwd)
      writeFileSync(
        join(testDir, '.snatchrc.json'),
        JSON.stringify({ framework: 'vue' })
      );
      process.chdir(testDir);

      const config = await loadConfig();

      // cwd config should be loaded
      expect(config.framework).toBe('vue');
    } finally {
      process.chdir('/');
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('falls back when cwd has no config', async () => {
    const testDir = join(tmpdir(), 'snatch-fallback-' + Date.now());
    mkdirSync(testDir, { recursive: true });

    try {
      process.chdir(testDir);
      // No config in cwd - will try home dir, then use defaults

      const config = await loadConfig();

      // Should get defaults (or home config if user has one)
      expect(SUPPORTED_FRAMEWORKS).toContain(config.framework);
      expect(SUPPORTED_STYLING).toContain(config.styling);
    } finally {
      process.chdir('/');
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
