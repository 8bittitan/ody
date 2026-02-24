---
status: pending
created: 2026-02-24
started: null
completed: null
---
# Task: Wrap Generation Output in Scroll Area

## Description
Replace the native `overflow-auto` scrolling on the `<pre>` element in the `GenerationOutput` component with the project's `ScrollArea` component. This will contain the generation output within its panel and prevent it from extending the page's height, while providing a styled, consistent scrollbar that matches the rest of the application's scroll behavior (e.g., TaskBoard).

## Background
The plan page uses a two-column grid layout defined in `Layout.tsx` (lines 459–476). The left column holds `PlanCreator` (input form) and the right column holds `GenerationOutput` (streaming agent output). Currently, `GenerationOutput` renders a `<pre>` element with `flex-1 overflow-auto` to display ANSI-converted HTML output. While this technically scrolls, the native overflow behavior can cause the outer `<section>` or page height to grow unboundedly instead of constraining the output within the panel's bounds. The project already has a `ScrollArea` component (`@/components/ui/scroll-area`) built on `@base-ui/react/scroll-area` and an established usage pattern in `TaskBoard.tsx` (lines 364–397).

## Technical Requirements
1. Import `ScrollArea`, `ScrollAreaViewport`, `ScrollAreaContent`, `ScrollAreaScrollbar`, and `ScrollAreaThumb` from `@/components/ui/scroll-area` into `GenerationOutput.tsx`
2. Wrap the `<pre>` output element(s) inside the `ScrollArea` component hierarchy, replacing the native `overflow-auto` CSS approach
3. Ensure the `ScrollArea` fills the remaining vertical space in the flex-col `<section>` using `min-h-0 flex-1` (matching the established pattern)
4. Remove `overflow-auto` and `flex-1` from the `<pre>` element's className since the `ScrollArea` root now handles sizing and scrolling
5. Preserve all existing styling on the `<pre>` element (background, border, font, text color, whitespace handling)
6. Preserve the ANSI HTML rendering via `dangerouslySetInnerHTML` on the `<pre>` element
7. Preserve the conditional rendering logic (stream output vs. placeholder text)
8. Include a vertical `ScrollAreaScrollbar` with `ScrollAreaThumb` for the styled scrollbar appearance

## Dependencies
- `@/components/ui/scroll-area` — The existing ScrollArea component wrapping `@base-ui/react/scroll-area`
- `@base-ui/react` — Already installed as a project dependency (^1.2.0)
- `GenerationOutput.tsx` — The target component at `packages/desktop/src/renderer/components/GenerationOutput.tsx`
- `Layout.tsx` — Parent layout that renders `GenerationOutput` inside a grid cell; no changes needed here

## Implementation Approach
1. **Add ScrollArea imports** — Add the necessary imports (`ScrollArea`, `ScrollAreaViewport`, `ScrollAreaContent`, `ScrollAreaScrollbar`, `ScrollAreaThumb`) from `@/components/ui/scroll-area` at the top of `GenerationOutput.tsx`
2. **Wrap the output area** — Between the header `<div>` and the `<pre>` element(s), insert the `ScrollArea` component tree. The `ScrollArea` root should take `className="min-h-0 flex-1"` to fill the remaining flex space. Inside it, nest `ScrollAreaViewport` > `ScrollAreaContent` > existing `<pre>` element(s)
3. **Adjust `<pre>` styling** — Remove `flex-1` and `overflow-auto` from the `<pre>` className since scrolling and sizing are now handled by `ScrollArea`. Keep all other classes (`bg-background`, `border-edge`, `rounded`, `border`, `p-2`, `font-mono`, `text-[11px]`, `whitespace-pre-wrap`, `text-zinc-200`). Add `min-h-full` to the `<pre>` so it fills the viewport when content is short
4. **Add the scrollbar** — After `ScrollAreaViewport`, add `<ScrollAreaScrollbar orientation="vertical"><ScrollAreaThumb /></ScrollAreaScrollbar>` to render the styled vertical scrollbar
5. **Verify both conditional branches** — Ensure both the `dangerouslySetInnerHTML` branch (when output exists) and the placeholder text branch (when output is empty) are properly wrapped inside the `ScrollAreaContent`
6. **Test visually** — Verify that long generation output scrolls within the panel without extending the page height, the styled scrollbar appears on hover/scroll, and the empty/waiting states render correctly

## Acceptance Criteria

1. **Scroll Area Contains Output**
   - Given the plan page is open and a generation is running or complete
   - When the output content exceeds the visible panel height
   - Then the output scrolls within the `ScrollArea` and does not extend the page height

2. **Styled Scrollbar Appears**
   - Given the generation output overflows the visible area
   - When the user hovers over or scrolls within the output panel
   - Then a styled vertical scrollbar (matching the `ScrollArea` component design) appears and is functional

3. **Empty State Renders Correctly**
   - Given no generation has been started or output is empty
   - When the user views the plan page
   - Then the placeholder text ("No output yet." or "Waiting for agent output...") displays correctly within the scroll area

4. **ANSI Rendering Preserved**
   - Given the generation output contains ANSI escape codes
   - When the output is rendered in the scroll area
   - Then ANSI colors and formatting are correctly displayed as before

5. **Panel Does Not Grow Beyond Viewport**
   - Given the plan page two-column grid layout
   - When generation output is very long (hundreds of lines)
   - Then the `GenerationOutput` section remains within its grid cell bounds and the page does not gain a vertical scrollbar due to the output

## Metadata
- **Complexity**: Low
- **Labels**: ui, desktop, scroll-area, plan-page
