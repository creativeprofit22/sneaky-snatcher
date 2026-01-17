# Contributing to Sneaky Snatcher

Thank you for your interest in contributing!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Install Playwright: `npx playwright install chromium`
4. Build: `npm run build`

## Project Structure

- `src/browser/` - Playwright automation
- `src/extractor/` - HTML/CSS extraction
- `src/llm/` - Claude integration
- `src/output/` - File writing
- `src/cli/` - Command-line interface
- `src/types/` - TypeScript definitions
- `src/utils/` - Common helpers

## Coding Standards

- TypeScript strict mode
- ESLint + Prettier for formatting
- Meaningful commit messages
- Tests for new features

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm test`
4. Run lint: `npm run lint`
5. Run type check: `npm run typecheck`
6. Submit PR with clear description

## Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: restructure code
test: add tests
chore: maintenance tasks
```

## Questions?

Open an issue for discussion.
