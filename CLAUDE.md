# Sneaky Snatcher

AI-powered CLI that extracts UI components from websites using natural language or CSS selectors, reduces CSS bloat 70-90%, and transforms to React/Vue/Svelte/HTML.

## Project Structure

```
src/
├── browser/        # Playwright automation (picker, snapshot, navigation)
├── cli/            # Commander.js CLI (program, options, logger)
├── config/         # Constants, .snatchrc loader
├── errors/         # Custom error classes
├── extractor/      # HTML/CSS extraction, style reduction, assets
├── llm/            # Claude integration (client, locator, transformer)
├── output/         # File writer, asset downloader, barrel generator
├── types/          # TypeScript type definitions
├── utils/          # Async helpers, string utilities
├── orchestrator.ts # Pipeline: Browse → Locate → Extract → Transform → Write
└── index.ts        # Public API exports
bin/
└── snatch.ts       # CLI entry point
tests/
├── unit/           # Module tests (browser/, *.test.ts)
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
bunx eslint src/ && bunx tsc --noEmit && bun test
```

Fix ALL errors/warnings before continuing.

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
Feature: LLM Client Reuse
Files-Validated: src/orchestrator.ts
Validation-Report: reports/validation-llm-client-reuse.md

## Last Session (2026-01-17)
**Feature**: LLM Client Reuse - Validated

### Changes Made
- Added `sharedLLM?: LLMClient` to OrchestrateInternalOptions
- Added `sharedLLM?: boolean` to StageContext for pattern symmetry
- Modified `orchestrate()` to use shared LLM if provided
- Modified `orchestrateBatch()` to create one LLMClient and share across components

### Bugs Fixed During Validation
1. [MEDIUM] Added sharedLLM tracking flag for symmetry with browser pattern

### Test Status
- 517 tests pass
- No new tests needed (LLMClient is stateless, covered by existing integration tests)
