---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Remove Render-Phase State Updates from Desktop Views

## Description
Some desktop React components currently call state setters during render, which is a React antipattern and can lead to unstable rerender behavior, warnings, or accidental render loops. Refactor these flows so state is updated from effects, event handlers, or derived rendering logic instead of inside the render body.

## Background
At least two core desktop views currently mutate state during render:

- `packages/desktop/src/renderer/components/TaskBoard.tsx` clears `viewError` inside the component body when loading finishes
- `packages/desktop/src/renderer/routes/__root.tsx` clears `showInitWizard` inside the component body when there is no active project

These updates are not triggered by explicit events or effects. React allows some cases but treats render-phase mutation as unsafe, especially as components get more complex or concurrent rendering behavior evolves.

## Technical Requirements
1. Desktop React components must not call state setters directly from the render body for these flows
2. The existing user-visible behavior must be preserved:
   - task board errors should still clear appropriately when retry/load succeeds
   - the init wizard should still close appropriately when no active project is selected
3. The refactor should prefer effects or derived rendering logic over local “fix-up” mutations during render
4. Similar render-phase state updates elsewhere in `packages/desktop/src/renderer/` should be checked and cleaned up if found while making this change
5. The change should align with stable React patterns for rerender safety

## Dependencies
- `packages/desktop/src/renderer/components/TaskBoard.tsx` — render-phase `setViewError(null)`
- `packages/desktop/src/renderer/routes/__root.tsx` — render-phase `setShowInitWizard(false)`
- Related hooks that determine loading and project-selection state

## Implementation Approach
1. Move the task board error-reset behavior into an effect keyed on the relevant loading/success state, or derive the visible error without storing a render-time reset
2. Move the init wizard close behavior into an effect keyed on `activeProjectPath`, or derive the dialog open state from project presence
3. Search the desktop renderer for any other state setters that occur directly in render and evaluate whether they should be cleaned up in the same pass
4. Verify the resulting flows do not change the current UX around retries and project switching
5. Keep the fix local and explicit rather than introducing broad architectural churn

## Acceptance Criteria

1. **TaskBoard no longer mutates state during render**
   - Given `packages/desktop/src/renderer/components/TaskBoard.tsx`
   - When reviewing the component body
   - Then `viewError` is not reset via a render-phase state setter

2. **Root layout no longer mutates state during render**
   - Given `packages/desktop/src/renderer/routes/__root.tsx`
   - When reviewing the component body
   - Then `showInitWizard` is not reset via a render-phase state setter

3. **User-visible behavior remains intact**
   - Given task loading succeeds after a prior failure, or the active project becomes unavailable
   - When the relevant view updates
   - Then the UI still clears or closes the affected state correctly without render-phase mutation

4. **No new render loops or warnings are introduced**
   - Given the affected screens render repeatedly during normal use
   - When exercising those views
   - Then they do not rely on render-phase state fix-ups to stay stable

## Metadata
- **Complexity**: Low
- **Labels**: desktop, react, state-management, cleanup
