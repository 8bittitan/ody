---
status: completed
created: 2026-03-15
started: 2026-03-16
completed: 2026-03-16
---
# Task: Load desktop progress data only when the progress panel is visible

## Description
Refine the desktop progress viewer so it does not repeatedly read progress data from the main process while the panel is collapsed or otherwise not visible to the user.

## Background
`packages/desktop/src/renderer/components/ProgressViewer.tsx` reads progress on mount and reloads on iteration changes regardless of whether the panel is expanded. This creates repeated IPC calls and file reads even when the user is not looking at the progress notes.

The progress panel is secondary UI, so its data-refresh behavior should follow visibility and user intent. Unnecessary polling or reloads during active agent runs create wasted work in both the renderer and the main process.

## Technical Requirements
1. Prevent automatic progress reloads while the panel is collapsed.
2. Keep manual refresh and clear-progress actions working.
3. Ensure progress loads when the panel is opened and remains current while visible.
4. Avoid spamming error toasts for background refresh failures in hidden UI.
5. Preserve existing progress rendering behavior.

## Dependencies
- `packages/desktop/src/renderer/components/ProgressViewer.tsx` owns the current load behavior.
- `packages/desktop/src/preload/index.ts` and `packages/desktop/src/main/ipc.ts` already expose progress IPC methods.
- `packages/desktop/src/renderer/components/AgentRunner.tsx` passes iteration and run state into the viewer.

## Implementation Approach
1. Gate the initial and iteration-driven `loadProgress()` calls on whether the panel is open.
2. Trigger a fresh progress read when the user expands the panel.
3. Keep any follow-up refresh policy visibility-aware so the app only performs progress work while users can benefit from it.
4. Review error handling so hidden-panel background failures do not produce noisy notifications.
5. Verify the panel still reflects current progress during active runs once opened.

## Scope Notes
- This task is about visibility-aware data fetching, not changing progress file semantics.
- Preserve the existing panel layout and actions.
- Keep the work inside `packages/desktop`.

## Acceptance Criteria

1. **Collapsed panel does not refetch unnecessarily**
   - Given the progress panel is collapsed during an active run
   - When iterations advance
   - Then the app does not keep reloading progress content solely because iteration changed

2. **Opening the panel loads current data**
   - Given the progress panel is collapsed and progress content exists
   - When the user expands the panel
   - Then the app loads the latest progress content at that time

3. **Visible panel can stay current**
   - Given the panel is open during an active run
   - When new progress is written
   - Then the viewer refreshes according to the intended visible-state policy

4. **Manual actions still work**
   - Given the user clicks Refresh or Clear Progress
   - When those actions run
   - Then the expected progress API calls still occur and the UI updates correctly

## Metadata
- **Complexity**: Low
- **Labels**: desktop, progress, performance, ipc, react
