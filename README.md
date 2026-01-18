# Sneaky Snatcher

AI-powered component extraction and transformation CLI. Browse, extract, transform, ship.

```
┌─────────────────────────────────────────────────────────────────┐
│  $ snatch "stripe.com" --find "pricing card" --framework react  │
│                                                                  │
│  ✓ Navigated to stripe.com                                       │
│  ✓ Located element: .pricing-card                                │
│  ✓ Extracted (4.2KB → 487B)                                      │
│  ✓ Transformed to react                                          │
│  ✓ Written 3 files                                               │
│                                                                  │
│  Component ready:                                                │
│    import { PricingCard } from './components/PricingCard'        │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **AI-Powered Element Location** - Find elements using natural language ("the pricing card", "navigation menu")
- **Smart Style Reduction** - Extracts only essential CSS, reducing 70-90% of bloat
- **Multi-Framework Output** - Generate React, Vue, Svelte, or vanilla HTML components
- **Flexible Styling** - Tailwind, CSS Modules, vanilla CSS, or inline styles
- **Asset Extraction** - Optionally download images, fonts, and icons
- **Interactive Mode** - Visual browser for element selection

## Installation

```bash
# Clone the repository
git clone https://github.com/creativeprofit22/sneaky-snatcher.git
cd sneaky-snatcher

# Install dependencies (using Bun)
bun install

# Install Playwright browsers
bunx playwright install chromium

# Run directly (no build step needed!)
bun run snatch

# Or link globally
bun link
```

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Claude CLI installed and authenticated (`bun add -g @anthropic-ai/claude-code`)
- Claude Pro or Max subscription

## Usage

### Basic Usage

```bash
# Using CSS selector
snatch "stripe.com/pricing" --selector ".pricing-card" --framework react

# Using natural language
snatch "vercel.com" --find "the hero section" --framework vue

# With Tailwind styling
snatch "linear.app" --find "feature grid" --framework react --styling tailwind

# Include assets
snatch "dribbble.com/shots/123" --selector ".shot-content" --assets
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--selector` | `-s` | CSS selector to target element | - |
| `--find` | `-f` | Natural language description | - |
| `--framework` | - | Output framework (`react`, `vue`, `svelte`, `html`) | `react` |
| `--styling` | - | Styling approach (`tailwind`, `css-modules`, `vanilla`, `inline`) | `tailwind` |
| `--output` | `-o` | Output directory | `./components` |
| `--name` | `-n` | Component name (PascalCase) | Auto-generated |
| `--interactive` | `-i` | Run with visible browser | `false` |
| `--assets` | `-a` | Download assets (images, fonts) | `false` |
| `--stories` | - | Generate Storybook story files | `false` |
| `--dry-run` | - | Simulate extraction without writing files | `false` |
| `--watch` | - | Watch mode - poll for element changes and notify | `false` |
| `--watch-interval` | - | Watch polling interval in milliseconds | `5000` |
| `--verbose` | `-v` | Verbose output | `false` |

### Interactive Mode

For visual element selection:

```bash
snatch "example.com" --interactive
```

This opens a browser window where you can browse and select elements visually.

## Architecture

```
sneaky-snatcher/
├── src/
│   ├── browser/          # Playwright automation
│   │   ├── browser.ts    # Browser lifecycle management
│   │   ├── snapshot.ts   # Accessibility tree generation
│   │   └── utils.ts      # Navigation helpers
│   │
│   ├── extractor/        # HTML/CSS extraction (from sneaky-rat)
│   │   ├── extractor.ts  # Element extraction
│   │   ├── styleReducer.ts # CSS minimization
│   │   └── assetResolver.ts # Asset detection
│   │
│   ├── llm/              # Claude integration (via subclaude)
│   │   ├── client.ts     # Claude API wrapper
│   │   ├── locator.ts    # Natural language → element
│   │   ├── transformer.ts # HTML → component
│   │   └── prompts.ts    # System prompts
│   │
│   ├── output/           # File writing
│   │   ├── writer.ts     # Component output
│   │   ├── assets.ts     # Asset downloading
│   │   └── barrel.ts     # Index generation
│   │
│   ├── cli/              # Command-line interface
│   │   ├── program.ts    # Commander setup
│   │   ├── options.ts    # Validation
│   │   └── logger.ts     # Styled output
│   │
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Common helpers
│   ├── orchestrator.ts   # Pipeline coordination
│   └── index.ts          # Public API
│
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # E2E tests
│   └── fixtures/         # Test data
│
└── docs/                 # Additional documentation
```

## Pipeline

```
1. BROWSE        Navigate to URL, wait for page load
      ↓
2. LOCATE        Find element via selector or AI
      ↓
3. EXTRACT       Pull HTML + reduced CSS + assets
      ↓
4. TRANSFORM     Convert to target framework via Claude
      ↓
5. WRITE         Output component files
```

## Examples

### Extract a Pricing Card

```bash
snatch "stripe.com/pricing" \
  --find "the Pro plan pricing card" \
  --framework react \
  --styling tailwind \
  --name PricingCard \
  --output ./src/components
```

Output:
```
./src/components/
└── PricingCard/
    ├── PricingCard.tsx
    ├── types.ts
    └── index.ts
```

### Extract Navigation with Assets

```bash
snatch "linear.app" \
  --selector "nav" \
  --framework vue \
  --styling css-modules \
  --assets \
  --output ./src/components
```

Output:
```
./src/components/
└── Navigation/
    ├── Navigation.vue
    ├── Navigation.module.css
    ├── assets/
    │   ├── logo.svg
    │   └── icon-menu.svg
    └── index.ts
```

### Batch Extraction

Extract multiple components in one run from a JSON config file:

```bash
snatch --batch components.json
```

Example `components.json`:

```json
{
  "components": [
    { "url": "stripe.com", "find": "pricing card", "name": "PricingCard" },
    { "url": "linear.app", "selector": "nav", "name": "Navigation", "framework": "vue" }
  ],
  "defaults": {
    "framework": "react",
    "styling": "tailwind",
    "outputDir": "./components"
  }
}
```

Each component can override `framework`, `styling`, `outputDir`, and `includeAssets`. The batch processor runs sequentially, continuing on errors and reporting success/failure per component.

## Programmatic API

```typescript
import { orchestrate, BrowserManager, extractElement } from './src/index.ts';

// Full pipeline
const result = await orchestrate({
  url: 'https://example.com',
  find: 'the hero section',
  framework: 'react',
  styling: 'tailwind',
  outputDir: './components',
});

// Individual modules
const browser = new BrowserManager({ headless: true });
await browser.launch();
await browser.navigate('https://example.com');

const extracted = await extractElement(browser.getPage(), '.hero');
console.log(extracted.html);
console.log(extracted.css);

await browser.close();
```

## Configuration

Create a `.snatchrc.json` in your project root (optional):

```json
{
  "framework": "react",
  "styling": "tailwind",
  "outputDir": "./src/components",
  "includeAssets": true,
  "llm": {
    "model": "sonnet",
    "timeout": 120000
  }
}
```

## Development

```bash
# Install dependencies
bun install

# Run CLI directly (no build needed)
bun run snatch "example.com" --find "hero"

# Run in watch mode
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint

# Build standalone binary (optional)
bun run build:bin
```

## How It Works

### Style Reduction

The extractor ports [sneaky-rat](https://github.com/KenKaiii/sneaky-rat)'s StyleReducer algorithm:

1. **Remove browser defaults** - Filter out values like `display: block` on divs
2. **Remove vendor prefixes** - Strip `-webkit-`, `-moz-`, etc.
3. **Remove inherited styles** - Skip properties inherited from parents
4. **Convert to shorthand** - Combine `margin-top/right/bottom/left` to `margin`
5. **Keep only essential** - Retain layout, colors, typography, shadows

Result: 70-90% reduction in CSS size.

### AI Element Location

When using `--find`, the tool:

1. Generates an accessibility tree of the page
2. Sends the tree + your query to Claude
3. Claude returns the most relevant element reference
4. Reference is resolved to a CSS selector

### Component Transformation

Claude converts extracted HTML+CSS to idiomatic framework code:

- Extracts dynamic content as props
- Applies chosen styling approach
- Generates TypeScript types
- Follows framework best practices

## Acknowledgments

- [agent-browser](https://github.com/vercel-labs/agent-browser) - Inspiration for accessibility-first element targeting
- [sneaky-rat](https://github.com/KenKaiii/sneaky-rat) - Core style reduction algorithm
- [subclaude](https://github.com/creativeprofit22/subclaude) - Claude subscription integration

## License

MIT

## Contributing

Contributions welcome! Please read the contributing guidelines first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request
