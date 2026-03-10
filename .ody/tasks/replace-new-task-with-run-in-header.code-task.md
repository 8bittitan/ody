---
status: completed
created: 2026-03-09
started: 2026-03-10
completed: 2026-03-10
---
# Task: Replace "New Task" Header Action with Repositioned "Run" Button

## Description
Remove the "New Task" button from the desktop header action bar and reposition the existing "Run" button to sit immediately to the right of the "Refresh" button. This simplifies the header by removing the plan navigation shortcut and gives the Run/Stop toggle a more natural placement next to the Refresh action.

## Background
The desktop app header in `packages/desktop/src/renderer/routes/__root.tsx` currently renders three action buttons in this order: **Run/Stop**, **Refresh**, **New Task**. The "New Task" button navigates to the `/plan` route but is no longer needed as a persistent header action. The "Run" button should be moved from its current first position to sit directly after "Refresh", resulting in a final order of: **Refresh**, **Run/Stop**.

The action buttons are rendered inside a flex container (`<div className="flex items-center gap-2">`) within the content header section of the root layout (approximately lines 437-472 of `__root.tsx`).

## Technical Requirements
1. Remove the "New Task" `<Button>` element (the one that calls `navigate({ to: '/plan' })`) from the header action bar
2. Reorder the remaining buttons so that the "Refresh" button appears first (left) and the "Run/Stop" button appears second (right)
3. Preserve all existing functionality of both the "Run/Stop" and "Refresh" buttons — no behavioral changes
4. Ensure no dead imports remain (e.g., if `navigate` or `useNavigate` are no longer used elsewhere, remove them; however, verify usage before removing)

## Dependencies
- `packages/desktop/src/renderer/routes/__root.tsx` — the sole file that needs modification
- `useAgent` hook — provides `isRunning`, `start`, `stop` for the Run/Stop button (no changes needed)
- `useTasks` hook — provides `loadTasks` for the Refresh button (no changes needed)

## Implementation Approach
1. Open `packages/desktop/src/renderer/routes/__root.tsx` and locate the action button group (`<div className="flex items-center gap-2">`, around line 437)
2. Remove the "New Task" `<Button>` block entirely (the block that calls `navigate({ to: '/plan' })`)
3. Reorder the remaining two buttons so the Refresh button comes first and the Run/Stop button comes second
4. Check whether `useNavigate` and `navigate` are still used elsewhere in the component; if not, remove the import and variable declaration
5. Run `bun typecheck` and `bun lint` to verify no errors were introduced
6. Visually confirm the header renders correctly with only two buttons in the expected order: Refresh, Run/Stop

## Acceptance Criteria

1. **New Task button removed**
   - Given the desktop app is running
   - When the user views the header action bar
   - Then there is no "New Task" button visible

2. **Run button repositioned**
   - Given the desktop app is running
   - When the user views the header action bar
   - Then the "Run" (or "Stop") button appears immediately to the right of the "Refresh" button

3. **Button order is correct**
   - Given the header action bar is visible
   - When reading left to right
   - Then the order is: Refresh, Run/Stop (exactly two buttons)

4. **Run/Stop functionality preserved**
   - Given the Run button is in its new position
   - When the user clicks "Run"
   - Then the agent starts and the button toggles to "Stop" as before

5. **Refresh functionality preserved**
   - Given the Refresh button is in its new position
   - When the user clicks "Refresh"
   - Then the task list reloads as before

6. **No dead code remains**
   - Given the changes are complete
   - When running `bun typecheck` and `bun lint`
   - Then there are no type errors, unused imports, or lint warnings related to this change

## Metadata
- **Complexity**: Low
- **Labels**: desktop, ui, header, cleanup
