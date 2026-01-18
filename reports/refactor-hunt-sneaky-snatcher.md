# Sneaky Snatcher Refactoring Report

**Generated:** 2026-01-17
**Total Issues Found:** 67
**Modules Analyzed:** 6 (browser, extractor, llm, output, cli, orchestrator)

---

## Executive Summary

| Severity | Count | Priority |
|----------|-------|----------|
| **HIGH** | 18 | Fix immediately |
| **MEDIUM** | 31 | Fix in next sprint |
| **LOW** | 18 | Fix as time permits |

### Top 5 Critical Issues
1. **orchestrate() is 182 lines** - Complex function needs decomposition
2. **Code duplication in asset download logic** - assetResolver.ts duplicates assets.ts
3. **Missing LLM error handling** - LLM failures not distinguished from other errors
4. **Repeated null checks in BrowserManager** - Same error message duplicated 5x
5. **No try-catch in picker event listeners** - Memory leak risk

---

## HIGH Priority Issues (18)

### Browser Module (4)

| # | File | Lines | Issue | Fix |
|---|------|-------|-------|-----|
| 1 | browser.ts | 50-116 | Repeated null check "Browser not launched" 5x | Extract `ensurePage()` helper |
| 2 | picker.ts | 105-177 | generateSelector() 73 lines, 8+ branches | Split into tryIdSelector, tryClassSelector, etc. |
| 3 | picker.ts | 230-254 | No try-catch in handleClick event listener | Wrap in try-finally for cleanup |
| 4 | picker.ts + snapshot.ts | Multiple | Duplicate selector generation logic | Extract to shared selectorUtils.ts |

### Extractor Module (5)

| # | File | Lines | Issue | Fix |
|---|------|-------|-------|-----|
| 1 | assetResolver.ts + assets.ts | 101-137, 39-72 | Duplicate download logic | Remove downloadAsset from assetResolver |
| 2 | assetResolver.ts | 15-69 | resolveAssets() high complexity | Extract collectImages/Icons/Backgrounds helpers |
| 3 | assetResolver.ts + assets.ts | 74-96, 77-98 | Duplicate filename extraction | Consolidate in assets.ts |
| 4 | extractor.ts | 29-44 | collectStyles() no recursion depth limit | Add MAX_DEPTH constant |
| 5 | assetResolver.ts | 101 | Unused downloadAsset export | Remove from index.ts |

### LLM Module (3)

| # | File | Lines | Issue | Fix |
|---|------|-------|-------|-----|
| 1 | transformer.ts | 23-33 | No validation of regex parsing results | Add code block validation |
| 2 | locator.ts | 28-32 | Missing debugging info in error | Include response preview in error |
| 3 | locator.ts + transformer.ts | 21-23, 48-54 | Duplicate prompt replacement pattern | Extract buildPrompt utility |

### Output Module (1)

| # | File | Lines | Issue | Fix |
|---|------|-------|-------|-----|
| 1 | assets.ts | 44-48 | Missing data URL validation | Validate mime type prefix |

### CLI Module (1)

| # | File | Lines | Issue | Fix |
|---|------|-------|-------|-----|
| 1 | logger.ts + index.ts | 47-104 | Dead code: logWarning, logStep, logTiming unused | Remove exports |

### Orchestrator (4)

| # | File | Lines | Issue | Fix |
|---|------|-------|-------|-----|
| 1 | orchestrator.ts | 33-214 | orchestrate() 182 lines, 5 stages | Extract browseAndLocate, extractAndValidate, etc. |
| 2 | orchestrator.ts | 103, 113, 204 | Generic Error instead of custom hierarchy | Use SnatchError, ValidationError |
| 3 | orchestrator.ts | 93-96, 149-155 | No LLM error handling | Distinguish LLMTimeoutError, LLMNotAvailableError |
| 4 | orchestrator.ts | 175-179 | No asset download error handling | Add try-catch, continue on failure |

---

## MEDIUM Priority Issues (31)

### Browser Module (5)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | utils.ts | 40-75 | 3 unused utility exports |
| 2 | picker.ts | 109-157 | 4 querySelectorAll calls per mousemove |
| 3 | snapshot.ts | 63-101 | Broken resolveRefToSelector implementation |
| 4 | picker.ts + snapshot.ts | 249, 262, 22 | Unsafe type assertions |
| 5 | utils.ts + picker.ts | 19, 34, 217 | Hardcoded magic numbers |

### Extractor Module (4)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | extractor.ts + assetResolver.ts | 15-80, 15-69 | Inconsistent page.evaluate pattern |
| 2 | extractor.ts | 85-99 | Inline regex constants |
| 3 | styleReducer.ts | 227-231 | Loose string comparison in isDefault |
| 4 | styleReducer.ts | 259-293 | Incomplete shorthand conversion |

### LLM Module (7)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | client.ts | 8-9, 42-46 | Unsafe @ts-ignore with no type guard |
| 2 | locator.ts | 35-36 | Silent confidence default with no warning |
| 3 | locator.ts | 48-61 | Sequential processing instead of parallel |
| 4 | transformer.ts | 14-42 | High complexity with multiple regex steps |
| 5 | transformer.ts | 90-112 | No validation of generated names |
| 6 | client.ts | 58-71 | Fragile string-based error mapping |
| 7 | transformer.ts | 60-67 | No validation of framework/styling params |

### Output Module (8)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | assets.ts | 78-153 | Duplicated extension mappings |
| 2 | assets.ts | 14-34 | Unhandled asset failures |
| 3 | assets.ts | 113-136 | Missing input validation in organizeAssets |
| 4 | barrel.ts | 56-69 | Complex/buggy index update logic |
| 5 | writer.ts | 96, 102 | Missing filename validation |
| 6 | assets.ts | 39-72 | Race condition on file collision |
| 7 | assets.ts | 59-62 | Insufficient HTTP error context |
| 8 | writer.ts | 28, 111 | Missing input validation |

### CLI Module (3)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | logger.ts | 33-56 | Logging pattern repeated 5x |
| 2 | options.ts | 18-71 | High cyclomatic complexity (11 branches) |
| 3 | program.ts | 71-82 | Unsafe type assertions |

### Orchestrator (4)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | orchestrator.ts | 53-57, 134 | Incomplete null checks on pipeline variables |
| 2 | orchestrator.ts | 84-117 | Selector null safety not guaranteed to compiler |
| 3 | orchestrator.ts | 212 | Potential resource leak in browser context |
| 4 | assets.ts + extractor.ts | 110, 70 | Missing error context in async operations |

---

## LOW Priority Issues (18)

### Browser Module (6)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | utils.ts | 69-74 | Inconsistent error handling in waitForElement |
| 2 | snapshot.ts | 80 | Non-null assertion without array length check |
| 3 | index.ts | 13 | Inconsistent export pattern |
| 4 | picker.ts | 283-285 | Event listener cleanup edge cases |
| 5 | browser.ts | 49-54 | Missing URL validation |
| 6 | browser.ts | 18-20 | Null property initialization pattern |

### Extractor Module (2)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | assetResolver.ts | 49 | Fragile regex for background URLs |
| 2 | index.ts | 10 | Unused export + inconsistent naming |

### LLM Module (4)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | transformer.ts | 90-93 | Unused validateComponentName export |
| 2 | client.ts | 32-72 | No per-request timeout override |
| 3 | locator.ts | 36 | Hard-coded confidence default |
| 4 | prompts.ts | 7-145 | Missing explicit TypeScript interface |

### Output Module (4)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | barrel.ts | 49, 80, 99 | Duplicated export line patterns |
| 2 | barrel.ts | 39-104 | Silent error handling |
| 3 | assets.ts | 49-65 | No asset size limits |
| 4 | barrel.ts | 12-29 | Missing component name validation |

### CLI Module (4)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | program.ts | 44-62 | Unimplemented commands (list, clean) |
| 2 | program.ts | 36-41 | Missing stack trace in error handling |
| 3 | options.ts | 25-34 | URL validation lacks specificity |
| 4 | logger.ts | 22-28 | Inconsistent API: spinner vs void |

### Orchestrator (2)

| # | File | Lines | Issue |
|---|------|-------|-------|
| 1 | orchestrator.ts | 219-223 | formatBytes should be shared utility |
| 2 | orchestrator.ts | 128-134 | Inconsistent optional chaining patterns |

---

## Recommended Refactoring Order

### Phase 1: Critical Fixes (1-2 days)
1. Extract `ensurePage()` helper in BrowserManager
2. Add try-catch to picker event listeners
3. Remove unused downloadAsset export
4. Remove dead logger exports
5. Add LLM error handling in orchestrator

### Phase 2: Decomposition (2-3 days)
1. Split orchestrate() into stage functions
2. Split generateSelector() into focused functions
3. Consolidate filename generation utilities
4. Extract buildPrompt utility for LLM module

### Phase 3: Consolidation (1-2 days)
1. Remove duplicate asset download code
2. Create shared selectorUtils module
3. Consolidate extension mappings
4. Extract regex constants

### Phase 4: Polish (1 day)
1. Fix type safety issues
2. Add input validation
3. Improve error messages
4. Add missing timing logs

---

## Code Metrics

| Module | Files | Lines | Issues |
|--------|-------|-------|--------|
| browser | 5 | ~700 | 15 |
| extractor | 4 | ~500 | 12 |
| llm | 5 | ~400 | 14 |
| output | 4 | ~406 | 13 |
| cli | 4 | ~328 | 11 |
| orchestrator | 1 | ~224 | 12 |
| **Total** | **23** | **~2558** | **67** |

---

## Next Steps

Run `/refactor-checkpoint` to execute these refactors tier by tier:
- Tier 1: HIGH priority (18 issues)
- Tier 2: MEDIUM priority (31 issues)
- Tier 3: LOW priority (18 issues)
