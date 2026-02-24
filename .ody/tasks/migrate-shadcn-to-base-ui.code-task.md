---
status: completed
created: 2026-02-23
started: 2026-02-23
completed: 2026-02-23
---
# Task: Migrate Desktop App from shadcn/ui to Base UI

## Description
Replace all shadcn/ui components in the `packages/desktop` Electron app with equivalent [Base UI](https://base-ui.com/) components. shadcn/ui wraps Radix primitives with opinionated Tailwind styles and copy-paste source files, while Base UI provides unstyled, accessible React primitives (built by the teams behind Radix, Floating UI, and Material UI) that are styled directly via Tailwind utility classes without a code-generation CLI. This migration removes the shadcn abstraction layer, gives full control over markup and styling, and aligns the project on a single headless component library.

## Background
The desktop app (`packages/desktop`, `@ody/desktop`) is an Electron + React 19 + Vite + Tailwind CSS v4 application. It currently uses 11 shadcn/ui components (Button, Badge, Card, Dialog, Dropdown Menu, Input, Radio Group, Select, Sonner/Toast, Switch, Tabs) installed under `src/renderer/components/ui/`. These are consumed by roughly 12 application-level components (ConfigPanel, SettingsModal, InitWizard, AuthPanel, AgentRunner, TaskBoard, TaskImport, TaskEditor, PlanCreator, Layout, App, Dialog itself). The design system uses an "Art Deco v3 Teal" theme with CSS custom properties mapped to shadcn's variable naming convention (`--background`, `--primary`, `--border`, etc.) plus extended tokens (`--color-panel`, `--color-edge`, `--color-dim`, etc.). Supporting dependencies include `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`, and `next-themes`.

## Technical Requirements
1. Install `@base-ui/react` as a dependency in `packages/desktop`
2. Rewrite each of the 11 shadcn `components/ui/*` files to use Base UI primitives, preserving the existing Art Deco theme and Tailwind class styling
3. Update all consumer components to use the new Base UI-based component APIs (props, compound component patterns, slot names may differ)
4. Migrate the CSS variable architecture in `globals.css` — remove shadcn-specific variable conventions where no longer needed, keep the Art Deco design tokens, and adapt any variable references to match Base UI's approach (Base UI is unstyled, so styling is applied via Tailwind classes and custom CSS, not component-internal variable reads)
5. Remove shadcn-specific dependencies that are no longer needed: all `@radix-ui/*` packages, `class-variance-authority`, `sonner`, and `next-themes` (evaluate `clsx` and `tailwind-merge` — keep if still useful for the `cn()` helper)
6. Remove the `components.json` shadcn CLI configuration file
7. Replace the `sonner` toast system with Base UI's `Toast` component
8. Ensure full keyboard navigation and ARIA accessibility is preserved (Base UI provides this out of the box)
9. Maintain visual parity with the current Art Deco v3 Teal design — no regressions in appearance or theming (light/dark mode)
10. The app must build successfully with `bun run build` from `packages/desktop`

## Dependencies
- **Base UI (`@base-ui/react`)**: The replacement component library. Requires React 19 (already satisfied). Docs at https://base-ui.com/
- **Tailwind CSS v4**: Already in use; Base UI components are styled entirely through Tailwind utility classes — no config changes needed
- **Existing Art Deco design tokens**: The custom CSS properties in `globals.css` for colors, fonts, and spacing must be preserved and applied to the new components
- **Electron Forge + Vite build pipeline**: No changes expected, but the migration must not break the renderer build (`vite.renderer.config.ts`)

## Implementation Approach
1. **Install Base UI and audit component mapping**
   - Run `bun add @base-ui/react` in `packages/desktop`
   - Create a mapping from each shadcn component to its Base UI equivalent:
     - `Button` -> Base UI has no Button primitive; replace with a styled `<button>` element using the existing Tailwind variant classes (keep `cva` patterns or convert to plain conditional classes)
     - `Badge` -> No direct Base UI equivalent; convert to a simple styled `<span>` component
     - `Card` -> No direct Base UI equivalent; convert to styled `<div>` container components
     - `Dialog` -> `Dialog` from `@base-ui/react/dialog`
     - `Dropdown Menu` -> `Menu` from `@base-ui/react/menu`
     - `Input` -> `Input` from `@base-ui/react/input` or `Field` from `@base-ui/react/field`
     - `Radio Group` -> `RadioGroup` from `@base-ui/react/radio-group` + `Radio` from `@base-ui/react/radio`
     - `Select` -> `Select` from `@base-ui/react/select`
     - `Sonner (Toast)` -> `Toast` from `@base-ui/react/toast`
     - `Switch` -> `Switch` from `@base-ui/react/switch`
     - `Tabs` -> `Tabs` from `@base-ui/react/tabs`

2. **Migrate simple/self-contained components first (Button, Badge, Card)**
   - Rewrite `button.tsx` — since Base UI has no Button component, refactor to a standalone styled button with the same variant API (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, sizes). Can keep `cva` or migrate to a simpler conditional class approach with `cn()`
   - Rewrite `badge.tsx` — convert to a styled `<span>` with variant support
   - Rewrite `card.tsx` — convert to styled `<div>` subcomponents (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`)
   - These components have no external primitive dependency, so this step validates the styling approach

3. **Migrate Switch component**
   - Replace Radix Switch with `Switch` from `@base-ui/react/switch`
   - Map `Switch.Root` and `Switch.Thumb` to Base UI's compound pattern
   - Apply existing Tailwind classes using `data-[checked]` / `data-[unchecked]` attributes (Base UI uses data attributes for state, matching the existing pattern)

4. **Migrate Radio Group component**
   - Replace Radix RadioGroup with `RadioGroup` from `@base-ui/react/radio-group` and `Radio` from `@base-ui/react/radio`
   - Use `Radio.Root` + `Radio.Indicator` compound components
   - Maintain the same label/value patterns used by ConfigPanel, SettingsModal, InitWizard, and TaskImport

5. **Migrate Input component**
   - Replace with `Field` from `@base-ui/react/field` or `Input` from `@base-ui/react/input`
   - Preserve the existing styling (border, focus ring, placeholder, disabled states)
   - Update all consumer components that pass props like `placeholder`, `value`, `onChange`, `disabled`, `type`

6. **Migrate Tabs component**
   - Replace Radix Tabs with `Tabs` from `@base-ui/react/tabs`
   - Map `Tabs.Root`, `Tabs.List`, `Tabs.Tab`, `Tabs.Panel` to Base UI equivalents
   - Used in SettingsModal, AuthPanel, PlanCreator

7. **Migrate Select component**
   - Replace Radix Select with `Select` from `@base-ui/react/select`
   - Map compound parts: `Select.Root`, `Select.Trigger`, `Select.Value`, `Select.Icon`, `Select.Portal`, `Select.Positioner`, `Select.Popup`, `Select.Item`
   - Used in ConfigPanel, InitWizard

8. **Migrate Dialog component**
   - Replace Radix Dialog with `Dialog` from `@base-ui/react/dialog`
   - Map compound parts: `Dialog.Root`, `Dialog.Trigger`, `Dialog.Portal`, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Title`, `Dialog.Description`, `Dialog.Close`
   - This is widely used (Layout, SettingsModal, InitWizard, AuthPanel, AgentRunner, TaskBoard, TaskEditor) so test thoroughly
   - Apply transition/animation classes using `data-[starting-style]` and `data-[ending-style]` attributes

9. **Migrate Dropdown Menu component**
   - Replace Radix DropdownMenu with `Menu` from `@base-ui/react/menu`
   - Map compound parts: `Menu.Root`, `Menu.Trigger`, `Menu.Portal`, `Menu.Positioner`, `Menu.Popup`, `Menu.Item`, `Menu.Separator`
   - Apply existing styling using data attributes for highlighted/active states

10. **Migrate Toast/Sonner component**
    - Remove `sonner` dependency and its `next-themes` dependency
    - Replace with `Toast` from `@base-ui/react/toast`
    - Set up `Toast.Provider` + `Toast.Viewport` in the root `App.tsx`
    - Create a `useToast()` hook or use `Toast.useToastManager()` for imperative toast creation
    - Update all toast call sites to use the new API

11. **Update CSS variable architecture in `globals.css`**
    - Keep the Art Deco v3 Teal design tokens (both shadcn-convention names and extended tokens) — they are referenced throughout component Tailwind classes
    - Remove any CSS that was specific to shadcn component internals (if any)
    - Verify the `@theme inline` bridge and `@theme` block still correctly expose all needed tokens to Tailwind utilities
    - Confirm light/dark mode switching still functions correctly

12. **Clean up dependencies and configuration**
    - Remove `components.json` (shadcn CLI config)
    - Run `bun remove` for: all `@radix-ui/*` packages, `class-variance-authority` (if no longer used), `sonner`, `next-themes`
    - Keep `clsx` and `tailwind-merge` if the `cn()` utility is still used
    - Keep `lucide-react` (icon library, independent of shadcn)
    - Update any references to shadcn in planning docs or task files if needed

13. **Full integration testing**
    - Run `bun run build` from `packages/desktop` and verify it succeeds
    - Manually verify each migrated component renders correctly in the Electron app
    - Test keyboard navigation and screen reader behavior for Dialog, Menu, Select, Tabs, RadioGroup, Switch
    - Test light/dark theme toggle
    - Test toast notifications appear and dismiss correctly

## Acceptance Criteria

1. **All shadcn components replaced**
   - Given the desktop app has 11 shadcn/ui components
   - When the migration is complete
   - Then all 11 components under `src/renderer/components/ui/` use Base UI primitives (or are self-contained styled components where Base UI has no equivalent)

2. **No shadcn or Radix dependencies remain**
   - Given the migration is complete
   - When inspecting `packages/desktop/package.json`
   - Then no `@radix-ui/*` packages, `sonner`, `next-themes`, or `class-variance-authority` remain in dependencies, and `components.json` is deleted

3. **Visual parity maintained**
   - Given the Art Deco v3 Teal theme is applied
   - When rendering any page/component in the desktop app
   - Then the visual appearance matches the pre-migration design in both light and dark modes

4. **Accessibility preserved**
   - Given any interactive component (Dialog, Menu, Select, Tabs, RadioGroup, Switch)
   - When navigating with keyboard (Tab, Arrow keys, Enter, Escape)
   - Then focus management, ARIA attributes, and expected keyboard interactions work correctly

5. **Toast system functional**
   - Given the app is running
   - When an action triggers a toast notification
   - Then the toast appears, displays correctly, and can be dismissed using Base UI's Toast component

6. **Build succeeds**
   - Given all changes are complete
   - When running `bun run build` from `packages/desktop`
   - Then the build completes without errors

7. **All consumer components updated**
   - Given the 12+ application components that import from `@/components/ui/`
   - When the migration is complete
   - Then all imports resolve correctly and components render without runtime errors

## Metadata
- **Complexity**: High
- **Labels**: desktop, ui, migration, base-ui, components, electron
