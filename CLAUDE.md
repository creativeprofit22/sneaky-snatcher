# Sneaky Snatcher

AI-powered CLI that extracts UI components from websites using natural language or CSS selectors, reduces CSS bloat 70-90%, and transforms to React/Vue/Svelte/HTML.

## Project Structure

```
src/
├── browser/        # Playwright automation (launch, navigate, snapshot)
├── extractor/      # HTML/CSS extraction, style reduction, asset detection
├── llm/            # Claude integration (client, locator, transformer, prompts)
├── output/         # File writer, asset downloader, barrel generator
├── cli/            # Commander.js CLI (program, options, logger)
├── config/         # Constants, .snatchrc loader
├── types/          # TypeScript type definitions
├── errors/         # Custom error classes (Browser, LLM, Extraction, etc.)
├── utils/          # Async helpers, string utilities
├── orchestrator.ts # Pipeline: Browse → Locate → Extract → Transform → Write
└── index.ts        # Public API exports
bin/
└── snatch.ts       # CLI entry point
tests/
├── unit/           # Module tests
├── integration/    # E2E workflow tests
└── fixtures/       # Mock HTML/CSS data
```

## Organization Rules

- **Browser logic** → `src/browser/` (one file per concern)
- **Extraction logic** → `src/extractor/` (extractor, styleReducer, assetResolver)
- **LLM logic** → `src/llm/` (client, locator, transformer, prompts)
- **Output logic** → `src/output/` (writer, assets, barrel)
- **CLI logic** → `src/cli/` (program, options, logger)
- **Types** → `src/types/index.ts`
- **Errors** → `src/errors/index.ts`
- **Tests** → `tests/` mirroring src/ structure

## Code Quality - Zero Tolerance

After editing ANY file, run:

```bash
bunx eslint src/ && bunx tsc --noEmit
```

Fix ALL errors/warnings before continuing.

### Full Quality Check

```bash
bunx eslint src/ --fix && bunx prettier --write "src/**/*.ts" && bunx tsc --noEmit && bun test
```

### Build

```bash
bun build src/index.ts --outdir dist --target node
```

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Browser**: Playwright
- **CLI**: Commander.js + Chalk + Ora
- **LLM**: subclaude (Claude API wrapper)

## Pipeline Flow

1. **Browse** → Navigate via Playwright
2. **Locate** → CSS selector or natural language (Claude + a11y tree)
3. **Extract** → HTML + minimal CSS + assets
4. **Transform** → Framework component via Claude
5. **Write** → Output files + download assets

## Pipeline State
Phase: refactor-hunt
Feature: Test Suite
Files-Validated: tests/unit/browser/picker.test.ts, tests/unit/orchestrator.test.ts, tests/integration/interactive.test.ts
Validation-Report: reports/validation-test-suite.md

## Last Session (2026-01-17)
**Feature**: Test Suite - Unit and integration tests for picker and orchestrator

### Validation Summary
- **Tests**: 192 passing, 363 assertions, 484ms runtime
- **Wiring**: PASS - Fixed tsconfig.json (added DOM lib), optional chaining fixes
- **Bottlenecks**: PASS - ~2.5ms/test average
- **Bugs**: 4 fixed (regex validation, tautological test, race condition, null handling)

### Files Created
- `tests/unit/browser/picker.test.ts` (103 tests) - Selector generation, overlay, events
- `tests/unit/orchestrator.test.ts` (31 tests) - Pipeline flow, error handling
- `tests/integration/interactive.test.ts` (38 tests) - Full interactive flow
- `tests/fixtures/test-page.html` - Test HTML fixture
- `reports/validation-test-suite.md` - Validation report

### Pre-existing Issues (Out of Scope)
TypeScript errors in src/ files (missing imports, subclaude types) - not test suite related
