---
status: completed
created: 2026-02-23
started: 2026-02-23
completed: 2026-02-23
---
# Task: Add Scroll Area to Task Board Columns

## Description
The task board columns (Pending, In Progress, Completed) do not scroll vertically when they contain more task cards than can fit in the visible area. The card list container uses a plain `overflow-auto` div with no explicit height constraint or custom scrollbar styling, meaning content overflows without a usable scrolling experience. This task replaces the plain overflow div with a Base UI Scroll Area component, providing consistent custom scrollbars and a polished scroll experience across all platforms.

## Background
The task board is rendered in `packages/desktop/src/renderer/components/TaskBoard.tsx`. The three status columns are laid out in a CSS grid (`md:grid-cols-3`) inside a flex container that fills the available height via `flex-1` and `min-h-0`. Each column is a `<div>` with `min-h-0` that contains a header and a card list wrapper at line 348:

```tsx
<div className="space-y-2 overflow-auto pb-1">
```

This wrapper has `overflow-auto` but lacks custom scrollbar styling, so it relies on the browser's native scrollbar, which is inconsistent across platforms and does not match the application's design language.

The project already uses `@base-ui/react` (v1.2.0+) extensively for headless UI primitives. All Base UI wrappers follow a consistent pattern found in `packages/desktop/src/renderer/components/ui/` — each file imports the Base UI primitive, wraps it with default styling via the `cn()` utility, and re-exports named components. The Scroll Area component from Base UI (`@base-ui/react/scroll-area`) provides a native scroll container with custom-styled scrollbars that will integrate naturally with the existing design system.

## Technical Requirements
1. Create a new `scroll-area.tsx` UI wrapper component in `packages/desktop/src/renderer/components/ui/` following the existing Base UI wrapper pattern (import primitive, wrap with `cn()` styling, re-export named parts)
2. The Scroll Area wrapper must export: `ScrollArea`, `ScrollAreaViewport`, `ScrollAreaContent`, `ScrollAreaScrollbar`, `ScrollAreaThumb`, and `ScrollAreaCorner`
3. Style the scrollbar track and thumb to match the application's design tokens (use `bg-edge` or similar muted colors for the track, `bg-dim` or `bg-light` for the thumb, with hover states)
4. The scrollbar should be thin (approximately `w-1.5` or `w-2`) and use rounded corners to match the overall aesthetic
5. Replace the `<div className="space-y-2 overflow-auto pb-1">` card list wrapper in `TaskBoard.tsx` (line 348) with the new Scroll Area component
6. The Scroll Area must only show a vertical scrollbar — horizontal scrolling is not needed
7. The column flex layout chain (`h-screen` → `flex-1 min-h-0` → grid → column `min-h-0` → scroll area) must be preserved so the scroll area correctly constrains to the available height
8. The `space-y-2` and `pb-1` spacing on the card list must be preserved inside the `ScrollAreaContent`

## Dependencies
- `@base-ui/react` (already installed at v1.2.0+) — provides `@base-ui/react/scroll-area`
- `packages/desktop/src/renderer/lib/utils.ts` — provides the `cn()` class-merging utility used by all UI wrappers
- `packages/desktop/src/renderer/components/TaskBoard.tsx` — the board component whose columns will be modified
- Existing Tailwind design tokens: `bg-edge`, `bg-dim`, `text-light`, `border-edge`, etc.

## Implementation Approach
1. **Create the Scroll Area UI wrapper** (`packages/desktop/src/renderer/components/ui/scroll-area.tsx`):
   - Import `ScrollArea as ScrollAreaPrimitive` from `@base-ui/react/scroll-area`
   - Create wrapper components for each part (`Root`, `Viewport`, `Content`, `Scrollbar`, `Thumb`, `Corner`) following the exact same pattern as `tabs.tsx` and other existing wrappers (function components using `React.ComponentProps`, `data-slot` attributes, `cn()` for class merging, spread remaining props)
   - Apply default styling:
     - `ScrollArea` (Root): `relative overflow-hidden` with flex-compatible sizing
     - `ScrollAreaViewport`: fills the root
     - `ScrollAreaContent`: no special defaults (passes through)
     - `ScrollAreaScrollbar`: thin track (`w-1.5`), `bg-transparent` by default, rounded, with padding, auto-hiding via opacity transition
     - `ScrollAreaThumb`: `bg-dim/40 hover:bg-dim/60` rounded-full for a subtle, consistent look
   - Export all wrapper components as named exports

2. **Integrate into TaskBoard.tsx**:
   - Import the new `ScrollArea`, `ScrollAreaViewport`, `ScrollAreaContent`, `ScrollAreaScrollbar`, `ScrollAreaThumb` components
   - Replace the card list `<div className="space-y-2 overflow-auto pb-1">` (line 348) with:
     ```tsx
     <ScrollArea className="min-h-0 flex-1">
       <ScrollAreaViewport>
         <ScrollAreaContent className="space-y-2 pb-1">
           {/* existing TaskCard mapping */}
         </ScrollAreaContent>
       </ScrollAreaViewport>
       <ScrollAreaScrollbar orientation="vertical">
         <ScrollAreaThumb />
       </ScrollAreaScrollbar>
     </ScrollArea>
     ```
   - Ensure the column `<div>` parent uses `flex flex-col` so the scroll area can take up remaining space after the header via `flex-1 min-h-0`

3. **Verify the flex layout chain**:
   - The column container (line 329) needs `flex flex-col` added to its className so that the header and scroll area stack correctly and `flex-1` on the scroll area fills remaining space
   - Confirm `min-h-0` is present on the column container and the section grid to allow flex children to shrink below their content size

4. **Test across column states**:
   - Verify scrolling works with many cards (Pending column is typically the fullest)
   - Verify the empty state ("No tasks in this column.") renders correctly inside the scroll area
   - Verify the scrollbar appears only when content overflows and hides when it doesn't
   - Verify the in-progress column with live output preview still functions and scrolls properly

## Acceptance Criteria

1. **Vertical Scrolling Works**
   - Given a task board column contains more task cards than fit in the visible area
   - When the user views the column
   - Then the column content is scrollable vertically with a styled custom scrollbar

2. **Scrollbar Styling Matches Design System**
   - Given the scroll area is rendered
   - When the user hovers over the scrollbar area
   - Then a thin, rounded scrollbar thumb appears that uses the application's muted color tokens and is visually consistent with the overall UI

3. **Scrollbar Only Appears When Needed**
   - Given a task board column contains fewer cards than fit in the visible area
   - When the user views the column
   - Then no scrollbar is visible

4. **Empty State Renders Correctly**
   - Given a task board column has zero tasks
   - When the user views the column
   - Then the "No tasks in this column." placeholder is displayed correctly within the scroll area

5. **Card Spacing Is Preserved**
   - Given task cards are rendered inside a column
   - When the user views the scrollable area
   - Then the vertical spacing between cards (`space-y-2`) and bottom padding (`pb-1`) remain identical to the current layout

6. **Scroll Area Component Is Reusable**
   - Given the new `scroll-area.tsx` UI component
   - When another developer needs a scrollable container elsewhere in the app
   - Then they can import and use the same components with custom className overrides, following the same pattern as other UI primitives

7. **Layout Chain Integrity**
   - Given the full-height layout from `h-screen` to the task board grid
   - When the window is resized
   - Then columns correctly fill available height and scroll areas adjust without breaking the layout

## Metadata
- **Complexity**: Low
- **Labels**: ui, bug-fix, task-board, base-ui, scroll
