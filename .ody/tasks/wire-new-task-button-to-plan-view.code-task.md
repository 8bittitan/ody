---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Wire "New Task" Button to Navigate to Plan View

## Description
The global "New Task" button in the top header bar of the Layout component currently has no click handler and does nothing when clicked. It should navigate the user to the Plan view so they can create a new plan, which is the entry point for generating tasks.

## Background
The desktop app uses state-driven view switching via the `activeView` state in `Layout.tsx` rather than URL-based routing. The Plan view is already fully implemented and accessible through the sidebar, the Electron menu (`CmdOrCtrl+N`), and the TaskBoard empty state's "New Plan" action. The "New Task" button is the only navigation element that is not yet wired up. The TaskBoard empty state already demonstrates the correct pattern: it calls `onOpenPlan` which resolves to `setActiveView('plan')`.

## Technical Requirements
1. The "New Task" button in `Layout.tsx` must call `setActiveView('plan')` when clicked
2. The behavior must be consistent with all other existing navigation paths to the Plan view (sidebar, Electron menu, TaskBoard empty state)
3. No new dependencies or routing changes are needed — this is purely adding an `onClick` handler to an existing button

## Dependencies
- `Layout.tsx` (`packages/desktop/src/renderer/components/Layout.tsx`) — contains the button at lines 408-413 and the `activeView` state at line 56
- `setActiveView` function — already in scope within the component where the button is rendered

## Implementation Approach
1. Open `packages/desktop/src/renderer/components/Layout.tsx`
2. Locate the "New Task" `<button>` element (around line 408)
3. Add an `onClick` handler that calls `setActiveView('plan')` to the button element
4. Verify the button is consistent with the existing "New Plan" action pattern used by the TaskBoard empty state (`onOpenPlan={() => setActiveView('plan')}`)

## Acceptance Criteria

1. **New Task Button Navigates to Plan View**
   - Given the user is on any view (tasks, run, config, etc.) with an active project selected
   - When the user clicks the "New Task" button in the top header bar
   - Then the active view switches to the Plan view, rendering the PlanCreator and GenerationOutput components

2. **Existing Navigation Paths Unaffected**
   - Given the Plan view is accessible via sidebar, Electron menu, and TaskBoard empty state
   - When the user navigates to the Plan view through any of these existing paths
   - Then the behavior remains identical to before this change

3. **Button Retains Existing Styling**
   - Given the "New Task" button has existing styling classes
   - When the onClick handler is added
   - Then no visual changes occur to the button's appearance or layout

## Metadata
- **Complexity**: Low
- **Labels**: desktop, ui, navigation, bug-fix
