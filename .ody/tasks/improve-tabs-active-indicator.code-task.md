---
status: completed
created: 2026-02-23
started: 2026-02-23
completed: 2026-02-23
---
# Task: Improve Active Tab Indicator Visibility

## Description
The tabs component in the desktop app lacks a clear visual indicator for the currently active tab. Users cannot easily distinguish which tab is selected at a glance. The active state needs stronger visual differentiation through improved contrast, color, and/or structural cues so that the selected tab is immediately obvious.

## Background
The desktop app uses a custom `Tabs` component (`packages/desktop/src/renderer/components/ui/tabs.tsx`) built on `@base-ui/react/tabs` primitives and styled entirely with Tailwind CSS utility classes. The component supports two variants — `default` (contained pill style) and `line` (underline style) — but all three consumers (`SettingsModal`, `PlanCreator`, `AuthPanel`) use the `default` variant.

Currently, the active tab in the default variant relies on subtle differences: a slightly lighter background (`bg-background` vs the surrounding `bg-muted`), a foreground text color shift, and a tiny `shadow-sm`. In practice — especially when consumers override the list background with classes like `bg-background/50` or `bg-background/60` — the contrast between active and inactive tabs becomes negligible. The `line` variant has a `::after` pseudo-element underline but it is never used.

The design system uses Tailwind v4 with CSS custom properties for theming (light and dark modes defined in `globals.css`), and the `cn()` utility from `clsx` + `tailwind-merge` for class merging.

## Technical Requirements
1. The active tab must be clearly distinguishable from inactive tabs in both light and dark themes
2. The indicator must work correctly for both horizontal and vertical tab orientations
3. The solution must not break the existing `line` variant behavior (even though it is currently unused)
4. Consumer-level className overrides on `TabsList` and `TabsTrigger` must continue to work via `cn()` merging
5. The solution should feel consistent with the existing design language (muted backgrounds, subtle borders, foreground colors defined in `globals.css`)
6. Both the `default` and `line` variants should have clear active indicators appropriate to their style

## Dependencies
- `packages/desktop/src/renderer/components/ui/tabs.tsx` — the core component to modify
- `packages/desktop/src/renderer/globals.css` — theme CSS custom properties (may need a new accent/active color variable if one doesn't exist)
- `@base-ui/react/tabs` — provides the `data-[state=active]` attribute used for styling
- Consumer components that may need className adjustments if the base styling changes significantly:
  - `packages/desktop/src/renderer/components/SettingsModal.tsx`
  - `packages/desktop/src/renderer/components/PlanCreator.tsx`
  - `packages/desktop/src/renderer/components/AuthPanel.tsx`

## Implementation Approach
1. **Audit current theme tokens** — Review `globals.css` to identify available color variables (e.g., `--primary`, `--accent`, `--ring`) and determine whether an existing token can serve as the active indicator color or if a new one is needed.
2. **Strengthen the default variant active state** — Update the `TabsTrigger` classes to increase contrast for the active tab. Approaches to consider (combine as needed):
   - Use a stronger background color for the active tab (e.g., `bg-primary` or a dedicated `bg-active` token) instead of the current `bg-background` which blends in.
   - Add a visible bottom border or left/right accent border using a high-contrast color (e.g., `border-b-2 border-primary`).
   - Increase font weight on active (`font-semibold`) for an additional textual cue.
   - Ensure the `shadow-sm` is replaced or supplemented with a more visible indicator that doesn't rely on subtle elevation.
3. **Improve the line variant active state** — The existing `::after` underline uses `bg-foreground` which is fine, but ensure it is thick enough (currently `h-0.5` / 2px) and consider bumping to `h-[3px]` if the underline still feels subtle. Also consider using `bg-primary` instead of `bg-foreground` for a stronger color cue.
4. **Verify dark mode** — Test that the changes produce sufficient contrast in dark mode. The dark mode overrides in `TabsTrigger` (`dark:data-[state=active]:bg-input/30`, `dark:data-[state=active]:border-input`) may need updating to match the new active styling.
5. **Review consumer overrides** — Check `SettingsModal`, `PlanCreator`, and `AuthPanel` to ensure their className overrides on `TabsList` (e.g., `bg-background/50 border-edge`) don't conflict with or negate the improved active indicator. Adjust consumer classes if necessary.
6. **Visual QA** — Run the desktop app and manually verify the active indicator across all three consumer contexts, in both light and dark themes, ensuring the active tab is immediately identifiable.

## Acceptance Criteria

1. **Active tab is visually distinct in default variant**
   - Given the app is running with a tabs component using the default variant
   - When a tab is active
   - Then it is immediately distinguishable from inactive tabs through a clear color, border, or structural difference visible at a glance

2. **Active tab is visually distinct in line variant**
   - Given a tabs component is rendered with `variant="line"`
   - When a tab is active
   - Then the underline/sideline indicator is clearly visible and uses a prominent color

3. **Dark mode parity**
   - Given the app is in dark mode
   - When a tab is active
   - Then the active indicator has sufficient contrast against the dark background and is equally clear as in light mode

4. **Consumer components unbroken**
   - Given SettingsModal, PlanCreator, and AuthPanel all render tabs
   - When each is opened and tabs are clicked
   - Then the active indicator displays correctly and no visual regressions are present

5. **Orientation support preserved**
   - Given a tabs component with vertical orientation
   - When a tab is active
   - Then the indicator adapts to the vertical layout (e.g., side border instead of bottom border)

## Metadata
- **Complexity**: Medium
- **Labels**: ui, tabs, desktop, accessibility, visual-design
