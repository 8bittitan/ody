---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Set Up Tailwind v4 + shadcn/ui + Art Deco Design System

## Description
Configure Tailwind CSS v4 with the CSS-first approach, set up shadcn/ui with the Art Deco design system, and install foundational UI components. This establishes the complete visual foundation for the desktop app including the three-layer CSS variable architecture, custom fonts, animations, and scrollbar styling.

## Background
The design system uses an "Art Deco v3 Teal" visual language with a dark-first theme. Tailwind v4 uses CSS-first configuration via `@theme` directives instead of a `tailwind.config.js`. shadcn/ui components are installed on-demand and styled through CSS variable overrides. The system has three CSS layers: shadcn semantic variables (`:root`/`.dark`), `@theme inline` bridge to Tailwind utilities, and Art Deco extended tokens via `@theme`. Fonts are Sora (sans) and JetBrains Mono (mono) from Google Fonts.

## Technical Requirements
1. Create `src/renderer/globals.css` with the complete three-layer CSS variable architecture:
   - `@import "tailwindcss"` and `@import "tw-animate-css"`
   - `@custom-variant dark (&:is(.dark *))` for class-based dark mode
   - `:root` block with all shadcn semantic variables mapped to Art Deco hex values
   - `@theme inline` block bridging CSS variables to Tailwind color tokens
   - `@theme` block with Art Deco extended tokens (panel, edge, text hierarchy, accent states, semantic colors, fonts)
   - `@layer base` with border and body styles
2. Create `src/renderer/lib/utils.ts` with the `cn()` helper using `clsx` + `tailwind-merge`
3. Run `npx shadcn init` to generate `components.json` with the correct configuration (style: "new-york", rsc: false, tsx: true, baseColor: "neutral", aliases matching directory structure)
4. Install foundational shadcn components: `npx shadcn add button dialog input select switch tabs dropdown-menu card badge radio-group sonner`
5. Add Google Fonts links for Sora and JetBrains Mono to `src/renderer/index.html`
6. Add custom scrollbar styles (4px width, panel track, muted thumb, accent thumb on hover)
7. Add custom animation keyframes: `fadeUp`, `pulse` (status dots), `blink` (cursor)
8. Add stagger delay utility classes (`d1`, `d2`, `d3` with 60ms increments)
9. Add the subtle grid background pattern for the main content area

## Dependencies
- `scaffold-electron-app` task must be completed first

## Implementation Approach
1. Create `globals.css` with the exact CSS from the planning document:
   - Layer 1: `:root` block mapping Art Deco palette to shadcn variables
   - Layer 2: `@theme inline` bridge for Tailwind utility class generation
   - Layer 3: `@theme` block for Art Deco-specific tokens
   - Base layer styles for border and body defaults
2. Add animation keyframes:
   ```css
   @keyframes fadeUp {
     from { opacity: 0; transform: translateY(8px); }
     to { opacity: 1; transform: translateY(0); }
   }
   @keyframes blink {
     0%, 50% { opacity: 1; }
     51%, 100% { opacity: 0; }
   }
   ```
3. Add custom scrollbar styles:
   ```css
   ::-webkit-scrollbar { width: 4px; }
   ::-webkit-scrollbar-track { background: var(--color-panel); }
   ::-webkit-scrollbar-thumb { background: var(--color-ody-muted); border-radius: 2px; }
   ::-webkit-scrollbar-thumb:hover { background: var(--color-primary); }
   ```
4. Add grid background pattern utility
5. Create `lib/utils.ts`:
   ```typescript
   import { clsx, type ClassValue } from 'clsx';
   import { twMerge } from 'tailwind-merge';
   export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
   ```
6. Update `index.html` with Google Fonts preconnect and stylesheet links
7. Run `npx shadcn init` and configure `components.json`
8. Install shadcn components: button, dialog, input, select, switch, tabs, dropdown-menu, card, badge, radio-group, sonner
9. Verify: run the dev server and confirm components render with Art Deco styling

## Acceptance Criteria

1. **CSS Variables Defined**
   - Given `globals.css`
   - When inspecting `:root` CSS variables
   - Then all shadcn semantic variables are mapped to Art Deco hex values

2. **Tailwind Utilities Generated**
   - Given the `@theme inline` and `@theme` blocks
   - When using classes like `bg-background`, `text-dim`, `border-edge`, `bg-panel`
   - Then they resolve to the correct Art Deco colors

3. **shadcn Components Installed**
   - Given the `src/renderer/components/ui/` directory
   - When listing its contents
   - Then it contains button, dialog, input, select, switch, tabs, dropdown-menu, card, badge, radio-group, and sonner components

4. **Fonts Loading**
   - Given the renderer HTML
   - When the app loads
   - Then Sora and JetBrains Mono fonts are available

5. **Design System Renders Correctly**
   - Given a test page with Art Deco-styled components
   - When viewed in the Electron window
   - Then colors, typography, animations, and scrollbar match the design spec

## Metadata
- **Complexity**: Medium
- **Labels**: design-system, tailwind, shadcn, ui
