---
status: completed
created: 2026-03-15
started: 2026-03-16
completed: 2026-03-16
---
# Task: Debounce desktop window-state persistence during resize

## Description
Reduce unnecessary `electron-store` writes by debouncing or otherwise batching desktop window-size persistence instead of writing on every resize event.

## Background
In `packages/desktop/src/main.ts`, the main window listens to `resized` and immediately writes updated bounds into `electron-store`. During live resizing, this can trigger a large number of writes in quick succession even though only the final dimensions matter for restoring the next session.

This is not the highest-impact issue in the app, but it is a straightforward cleanup that reduces unnecessary disk churn and keeps the main process a little lighter.

## Technical Requirements
1. Avoid writing window bounds to storage on every raw resize event.
2. Preserve restoring the most recent useful window dimensions on the next app launch.
3. Keep the implementation simple and robust in the Electron main process.
4. Preserve current BrowserWindow creation behavior and stored shape.

## Dependencies
- `packages/desktop/src/main.ts` creates the BrowserWindow and persists its dimensions.
- `electron-store` remains the persistence mechanism for saved window size.

## Implementation Approach
1. Replace the current immediate resize handler with a debounced save, a resize-end style strategy, or a persistence point tied to window close/move completion.
2. Ensure the latest bounds are still captured before app shutdown.
3. Keep the existing store schema intact unless a small compatibility-safe update is required.
4. Verify window dimensions are restored correctly after relaunch.

## Scope Notes
- This task is intentionally narrow and low risk.
- Do not expand into broader window-management features.

## Acceptance Criteria

1. **Resize writes are reduced**
   - Given the user continuously resizes the desktop window
   - When many raw resize events fire
   - Then the app does not write the updated window dimensions to storage for every individual event

2. **Latest useful bounds are restored**
   - Given the user finishes resizing and later relaunches the app
   - When the main window is created
   - Then the restored dimensions reflect the last persisted useful size

3. **No regression in startup behavior**
   - Given saved window dimensions already exist
   - When the app starts
   - Then BrowserWindow still initializes from the stored dimensions as before

## Metadata
- **Complexity**: Low
- **Labels**: desktop, electron, performance, windowing
