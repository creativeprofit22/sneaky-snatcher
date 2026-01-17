---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

# Project Code Quality Check

This command runs all linting and typechecking tools, collects errors, groups them by domain, and spawns parallel agents to fix them.

## Step 1: Run Linting and Typechecking

Run these commands and collect all errors:

```bash
# TypeScript type checking
bunx tsc --noEmit 2>&1

# ESLint linting
bunx eslint src/ 2>&1

# Prettier format check (optional - for format issues)
bunx prettier --check "src/**/*.ts" 2>&1
```

Capture all output from these commands.

## Step 2: Collect and Parse Errors

Parse the output from the commands. Group errors by domain:

- **Type errors**: TypeScript errors (TS2xxx codes, type mismatches, missing properties)
- **Lint errors**: ESLint errors (rule violations, unused variables, import issues)
- **Format errors**: Prettier issues (formatting inconsistencies)

Create a list of all files with issues and the specific problems in each file.

## Step 3: Spawn Parallel Agents

For each domain that has issues, spawn an agent in parallel using the Task tool.

**IMPORTANT**: Use a SINGLE response with MULTIPLE Task tool calls to run agents in parallel.

Example agent prompts:

### Type Error Agent
```
Fix TypeScript type errors in these files:
[LIST FILES AND ERRORS]

For each file:
1. Read the file
2. Fix the type error
3. Verify with: bunx tsc --noEmit

Do NOT add unnecessary type assertions. Fix the root cause.
```

### Lint Error Agent
```
Fix ESLint errors in these files:
[LIST FILES AND ERRORS]

For each file:
1. Read the file
2. Fix the lint error properly (don't just disable rules)
3. Verify with: bunx eslint [file]
```

### Format Agent
```
Fix formatting issues in these files:
[LIST FILES]

Run: bunx prettier --write "[file]"
```

## Step 4: Verify All Fixes

After all agents complete, run the full check again:

```bash
bunx eslint src/ && bunx tsc --noEmit
```

Report success or any remaining issues.
