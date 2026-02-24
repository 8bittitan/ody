---
status: pending
created: 2026-02-24
started: null
completed: null
---
# Task: Collapsible Sidebar with Icon-Only Mode and Keyboard Shortcut

## Description
Make the main sidebar collapsible so it can toggle between its full-width state (showing icons + labels + project names) and a narrow icon-only state. When collapsed, navigation items should display only their Lucide icon, and project names should be truncated with ellipsis if they exceed the available width. The toggle should be triggerable via a keyboard shortcut (`Cmd+[` on macOS, `Ctrl+[` on Windows/Linux) as well as a visible UI toggle button.

## Background
The sidebar is implemented in `packages/desktop/src/renderer/components/Sidebar.tsx` as a React functional component rendered inside `Layout.tsx` at line 278. It currently has a fixed width of `w-56` (224px) with `shrink-0`. Navigation items are defined in a `VIEW_ITEMS` array, each with an `id`, `label`, and `Icon` (Lucide React component). Projects are listed below the navigation items with their full `name` displayed as button text. The sidebar receives `activeView`, `onViewSelect`, project data, and project action callbacks as props from `Layout.tsx`.

There is no centralized keyboard shortcut system. Shortcuts are handled via Electron menu accelerators (in `packages/desktop/src/main/menu.ts`), per-component `keydown` listeners, and custom events dispatched through `Layout.tsx`. The app uses Zustand for global state management (store at `packages/desktop/src/renderer/store/index.ts` with sliced architecture), though the current `activeView` state lives as local `useState` in `Layout.tsx`. Styling uses Tailwind CSS v4 utility classes with a `cn()` helper for class merging.

## Technical Requirements
1. Add a `sidebarCollapsed` boolean to the Zustand store so collapsed state persists across view changes and is accessible from any component
2. The sidebar must animate smoothly between expanded (`w-56` / 224px) and collapsed (~`w-14` / 56px, enough for icon + padding) states using a CSS transition
3. In collapsed mode, navigation buttons must show only the Lucide icon (hide the text label) and display a tooltip on hover showing the full label
4. In collapsed mode, project list items must either show a truncated single-character avatar or be hidden behind a popover/tooltip, with the full project name visible on hover
5. In expanded mode, project names that exceed the sidebar width must be truncated with text ellipsis (`truncate` Tailwind class)
6. A toggle button (e.g., a chevron icon) must be visible at the bottom or top of the sidebar to collapse/expand it
7. Register `Cmd+[` (macOS) / `Ctrl+[` (Windows/Linux) as a global keyboard shortcut to toggle the sidebar, following the existing pattern of `keydown` listeners in `Layout.tsx`
8. The collapsed state should be persisted so it survives app restarts (either via the Zustand store with persistence middleware or via Electron's local storage)

## Dependencies
- `packages/desktop/src/renderer/components/Sidebar.tsx` — primary component to modify
- `packages/desktop/src/renderer/components/Layout.tsx` — hosts the sidebar, manages layout, and handles keyboard events
- `packages/desktop/src/renderer/store/index.ts` — Zustand store entry point for adding sidebar slice or extending an existing slice
- `packages/desktop/src/renderer/components/ui/` — existing UI primitives (may need a Tooltip component if one doesn't already exist)
- `lucide-react` — for the collapse/expand toggle icon (e.g., `PanelLeftClose`, `PanelLeftOpen`, or `ChevronsLeft`/`ChevronsRight`)
- `packages/desktop/src/renderer/globals.css` — may need sidebar transition CSS custom properties or width variables

## Implementation Approach
1. **Add sidebar state to Zustand store** — Create a `UISlice` (or extend an existing slice) in the store with a `sidebarCollapsed: boolean` field and a `toggleSidebar` action. Wire it into the combined store in `index.ts`. Consider adding `persist` middleware so the value survives restarts.
2. **Update `Layout.tsx` to consume collapsed state** — Replace the fixed sidebar width with a conditional class based on `sidebarCollapsed`. Add a `keydown` event listener for `Cmd+[` / `Ctrl+[` that calls `toggleSidebar()`, following the existing pattern of keyboard listeners (e.g., lines 188-223 in Layout.tsx).
3. **Refactor `Sidebar.tsx` to accept and respect a `collapsed` prop** — Accept `collapsed` and `onToggle` props. Conditionally render navigation item labels (hide text when collapsed, show icon only). Add `truncate` class to project names in expanded mode. Add width transition classes (`transition-all duration-200`) to the sidebar root element.
4. **Add a collapse toggle button to the sidebar** — Place a small icon button (e.g., `ChevronsLeft` when expanded, `ChevronsRight` when collapsed) at the bottom of the sidebar that calls `onToggle`.
5. **Add tooltips for collapsed state** — When collapsed, wrap each navigation icon button and project button in a tooltip (using an existing `Tooltip` UI primitive or creating a lightweight one with `@base-ui/react`) so users can still identify items on hover.
6. **Handle project list in collapsed mode** — In collapsed mode, show project items as single-character circle avatars (first letter of project name) with the full name in a tooltip. The active project should remain visually distinct.
7. **Add Electron menu accelerator (optional enhancement)** — Register `Cmd+[` / `Ctrl+[` in `packages/desktop/src/main/menu.ts` as a menu accelerator that sends a `view:toggle-sidebar` IPC action. Handle it in Layout's `onMenuAction` listener alongside the existing actions. This provides a fallback if the renderer `keydown` listener doesn't capture the shortcut.
8. **Test transitions and edge cases** — Verify the sidebar animates correctly, tooltips appear in collapsed mode, project names truncate properly in expanded mode, the keyboard shortcut works on both macOS and Windows/Linux, and the collapsed state persists across view changes and app restarts.

## Acceptance Criteria

1. **Sidebar collapses to icon-only mode**
   - Given the sidebar is in its default expanded state
   - When the user clicks the collapse toggle button
   - Then the sidebar animates to a narrow width showing only icons for each navigation item, and the main content area expands to fill the freed space

2. **Sidebar expands back to full width**
   - Given the sidebar is in collapsed (icon-only) mode
   - When the user clicks the expand toggle button
   - Then the sidebar animates back to its full `w-56` width with icons and text labels visible

3. **Keyboard shortcut toggles sidebar**
   - Given the app is focused and the sidebar is in any state
   - When the user presses `Cmd+[` (macOS) or `Ctrl+[` (Windows/Linux)
   - Then the sidebar toggles between collapsed and expanded states

4. **Tooltips appear in collapsed mode**
   - Given the sidebar is collapsed
   - When the user hovers over a navigation icon or project avatar
   - Then a tooltip appears showing the full label or project name

5. **Project names truncate in expanded mode**
   - Given the sidebar is expanded and a project name exceeds the available width
   - When the project list renders
   - Then the project name is truncated with an ellipsis and the full name is available via the existing `title` attribute tooltip

6. **Collapsed state persists**
   - Given the user has collapsed the sidebar
   - When the user switches views or restarts the app
   - Then the sidebar remains in its collapsed state

7. **Smooth transition animation**
   - Given the sidebar is toggling between states
   - When the transition occurs
   - Then the width change animates smoothly (200-300ms duration) without layout jank or content overflow artifacts

## Metadata
- **Complexity**: Medium
- **Labels**: ui, sidebar, layout, keyboard-shortcuts, desktop
