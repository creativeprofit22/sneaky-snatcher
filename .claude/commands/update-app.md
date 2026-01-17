---
name: update-app
description: Update dependencies, fix deprecations and warnings
---

# Dependency Update & Deprecation Fix

## Step 1: Check for Updates

```bash
bun outdated
```

Review the output. Note which packages have major version updates (breaking changes).

## Step 2: Update Dependencies

```bash
bun update
```

For major updates that require manual intervention:
```bash
bun add <package>@latest
```

## Step 3: Check for Deprecations & Warnings

Run a clean install and capture ALL output:

```bash
rm -rf node_modules bun.lockb
bun install 2>&1
```

Read the output carefully. Look for:
- Deprecation warnings
- Peer dependency warnings
- Resolution warnings
- Package compatibility issues

## Step 4: Fix Issues

For each warning/deprecation:
1. Research the recommended replacement or fix
2. Update code/dependencies accordingly
3. Re-run `bun install`
4. Verify no warnings remain

Common fixes:
- Replace deprecated packages with recommended alternatives
- Update peer dependencies to compatible versions
- Fix version conflicts by pinning specific versions

## Step 5: Run Quality Checks

```bash
bunx eslint src/ && bunx tsc --noEmit && bun test
```

Fix ALL errors before completing.

## Step 6: Verify Clean Install

Ensure a fresh install works with zero warnings:

```bash
rm -rf node_modules bun.lockb
bun install
```

Verify:
- ZERO warnings in output
- All dependencies resolve correctly
- No deprecation notices
- `bun run typecheck` passes
- `bun run lint` passes
