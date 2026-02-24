---
status: completed
created: 2026-02-23
started: 2026-02-23
completed: 2026-02-23
---
# Task: Add Collapsible Label Filter Sections

## Description
The label filter pill bars in the desktop app (TaskBoard and AgentRunner) currently display every available label as a flat, always-visible horizontal row. When a project accumulates many labels this becomes visually overwhelming. Wrap each label list in a collapsible section that is collapsed by default, so users can expand it on demand to select a filter and the UI stays clean otherwise.

## Background
The desktop app (`packages/desktop`) is built with React 19, Electron 40, Tailwind CSS v4, Zustand, and `@base-ui/react` for headless UI primitives. Label filter bars exist in two components:

- **TaskBoard** (`packages/desktop/src/renderer/components/TaskBoard.tsx`, lines 288-320) — renders unique labels extracted from all tasks as horizontal pill buttons, toggling a `labelFilter` in the Zustand store.
- **AgentRunner** (`packages/desktop/src/renderer/components/AgentRunner.tsx`, lines 192-224) — duplicates the same pattern with local `selectedLabel` state.

`@base-ui/react` ships a `Collapsible` primitive (`Collapsible.Root`, `Collapsible.Trigger`, `Collapsible.Panel`) that is already available in `node_modules` but not yet wrapped or used anywhere in the app. The project's UI components live in `packages/desktop/src/renderer/components/ui/` and follow a pattern of thin wrappers around Base UI primitives styled with Tailwind.

## Technical Requirements
1. Create a reusable `Collapsible` UI wrapper component in `packages/desktop/src/renderer/components/ui/collapsible.tsx` using `@base-ui/react`'s `Collapsible.Root`, `Collapsible.Trigger`, and `Collapsible.Panel`.
2. The collapsible must default to the **collapsed** state (`defaultOpen={false}`).
3. The trigger should include a chevron icon (from `lucide-react`) that rotates to indicate open/closed state.
4. Wrap the label filter `<section>` in **TaskBoard.tsx** (lines ~288-320) with the new Collapsible component, using a descriptive trigger label such as "Labels" or "Filter by label".
5. Wrap the label filter section in **AgentRunner.tsx** (lines ~192-224) with the same Collapsible component.
6. When a label filter is active (i.e., a label is currently selected), the trigger text or an inline badge should indicate the active filter even while collapsed, so the user knows a filter is applied without expanding.
7. The collapsible animation should be smooth — use CSS `grid-template-rows` transition or Base UI's built-in animation support on the panel.
8. Maintain all existing label filtering functionality and styling; the change is purely presentational wrapping.

## Dependencies
- `@base-ui/react` (already installed) — provides `Collapsible` headless primitive
- `lucide-react` (already installed) — provides `ChevronDown` or `ChevronRight` icon
- `clsx` / `tailwind-merge` via existing `cn()` utility — for conditional class composition
- Existing Zustand store `labelFilter` state in `taskSlice.ts` — read to show active filter indicator
- Existing `selectedLabel` local state in `AgentRunner.tsx` — read for the same purpose

## Implementation Approach
1. **Create the Collapsible UI component** — Add `packages/desktop/src/renderer/components/ui/collapsible.tsx`. Import `Collapsible` from `@base-ui/react/collapsible`. Export a composed component that accepts `defaultOpen`, `label`, `children`, and an optional `badge` prop. Style the trigger as a small, subtle row with the label text, optional badge, and a rotating chevron. Style the panel with a height transition for smooth expand/collapse.
2. **Refactor TaskBoard label section** — In `TaskBoard.tsx`, extract the label filter `<section>` (lines ~288-320) and wrap it with the new `<Collapsible>` component. Pass `defaultOpen={false}`. Derive the active filter indicator from the Zustand `labelFilter` state and pass it as the `badge` prop so the selected label name appears next to the trigger even when collapsed.
3. **Refactor AgentRunner label section** — In `AgentRunner.tsx`, apply the same wrapping to the label filter section (lines ~192-224). Derive the active filter indicator from the local `selectedLabel` state.
4. **Add transition styles** — Ensure the collapsible panel uses a CSS transition (e.g., `grid-template-rows: 0fr` to `1fr`, or `max-height` with overflow hidden) so the expand/collapse is animated rather than abrupt. Match the existing design system's motion timing.
5. **Verify no regressions** — Confirm that clicking label pills still correctly filters the task list in both views, that the "All labels" reset works, and that the active-label highlight styling is preserved inside the collapsible panel.

## Acceptance Criteria

1. **Label sections are collapsed by default**
   - Given the desktop app is freshly loaded
   - When the TaskBoard or AgentRunner view is rendered
   - Then the label filter pill bar is hidden inside a collapsed section

2. **User can expand and collapse label sections**
   - Given a collapsed label section
   - When the user clicks the collapsible trigger
   - Then the label pills are revealed with a smooth animation, and clicking again collapses them

3. **Active filter is visible when collapsed**
   - Given the user has selected a label filter and then collapses the section
   - When the section is in its collapsed state
   - Then the trigger area displays the name of the active label filter (e.g., as an inline badge)

4. **Existing filter behavior is preserved**
   - Given the label section is expanded
   - When the user clicks a label pill or "All labels"
   - Then the task list filters correctly, identical to the current behavior

5. **Chevron icon indicates state**
   - Given the collapsible trigger is rendered
   - When the section is collapsed the chevron points right (or down when expanded)
   - Then the icon rotates smoothly between states to indicate open/closed

6. **Reusable component exists**
   - Given a developer wants to add another collapsible section
   - When they import `Collapsible` from `components/ui/collapsible`
   - Then they can use it with `label`, `defaultOpen`, `badge`, and `children` props without duplicating logic

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, ui, feature, component
