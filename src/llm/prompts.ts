/**
 * LLM Prompts
 *
 * System and user prompts for Claude interactions.
 */

export const PROMPTS = {
  // ============================================================================
  // Element Location
  // ============================================================================

  LOCATE_SYSTEM: `You are an expert at analyzing accessibility trees and locating UI elements.
Your task is to find the element that best matches a natural language description.

Rules:
1. Return ONLY the element reference (e.g., @e5 or @e0.1.2)
2. If multiple elements match, pick the most specific/relevant one
3. Include a confidence score (0-1) for your match
4. Briefly explain your reasoning

Format your response as:
@eX.X.X
Confidence: 0.XX
Reasoning: <brief explanation>`,

  LOCATE_ELEMENT: `Given this accessibility tree:

{{TREE}}

Find the element that matches this description:
"{{QUERY}}"

Return the element reference, confidence score, and brief reasoning.`,

  // ============================================================================
  // Component Transformation
  // ============================================================================

  TRANSFORM_SYSTEM: `You are an expert frontend developer who converts HTML+CSS into clean, reusable components.

Core principles:
1. Create idiomatic code for the target framework
2. Extract dynamic content as props with sensible defaults
3. Use TypeScript for type safety
4. Follow component best practices (single responsibility, composition)
5. Make components responsive by default
6. Use semantic HTML elements
7. Ensure accessibility (aria labels, keyboard navigation)

Output format:
1. Start with the props interface (for TypeScript frameworks)
2. Then the component code
3. Add brief comments only for non-obvious logic
4. Do NOT include import statements unless framework-specific`,

  TRANSFORM_COMPONENT: `Convert this extracted HTML and CSS into a {{FRAMEWORK}} component with {{STYLING}} styling.

Component name: {{COMPONENT_NAME}}

HTML:
\`\`\`html
{{HTML}}
\`\`\`

CSS:
\`\`\`css
{{CSS}}
\`\`\`

Additional instructions: {{INSTRUCTIONS}}

Generate a clean, reusable component with:
- Props for dynamic content (strings, arrays, handlers)
- Responsive design
- Proper TypeScript types
- {{STYLING}} styling approach`,

  // ============================================================================
  // Framework-Specific Guides
  // ============================================================================

  FRAMEWORK_GUIDES: {
    react: `React Guidelines:
- Use functional components with hooks
- Use TypeScript interfaces for props
- Prefer composition over inheritance
- Use React.memo() only if needed for performance
- Event handlers should be typed properly`,

    vue: `Vue 3 Guidelines:
- Use Composition API with <script setup>
- Define props with defineProps<T>()
- Use TypeScript for type annotations
- Emit events with defineEmits<T>()
- Use computed() for derived state`,

    svelte: `Svelte Guidelines:
- Use TypeScript with <script lang="ts">
- Export props with export let
- Use reactive statements ($:) appropriately
- Prefer slots for composition
- Use on:event for event forwarding`,

    html: `HTML Guidelines:
- Use semantic HTML5 elements
- Include inline <style> block
- Add data attributes for JavaScript hooks
- Include basic interactivity with vanilla JS
- Ensure the component is self-contained`,
  },

  // ============================================================================
  // Styling-Specific Guides
  // ============================================================================

  STYLING_GUIDES: {
    tailwind: `Tailwind CSS Guidelines:
- Use Tailwind utility classes directly in markup
- Prefer responsive utilities (sm:, md:, lg:) over media queries
- Use arbitrary values [value] sparingly
- Group related utilities logically
- No separate CSS file needed`,

    'css-modules': `CSS Modules Guidelines:
- Import styles as 'styles' object
- Use camelCase for class names
- Apply with className={styles.className}
- Keep styles in separate .module.css file
- Provide the CSS separately in your response`,

    vanilla: `Vanilla CSS Guidelines:
- Use BEM naming convention (.block__element--modifier)
- Scope styles with unique class prefix
- Include CSS in separate file
- Use CSS custom properties for theming
- Provide both component and CSS file`,

    inline: `Inline Styles Guidelines:
- Use style objects in JavaScript
- Define reusable style constants
- Use camelCase property names
- Consider extracting shared styles
- All styles should be in the component file`,
  },
} as const;
