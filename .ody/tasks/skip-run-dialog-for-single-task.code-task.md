---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Skip Run Dialog When Running a Single Task from the Task Board

## Description
When a user clicks the "Run" button on an individual task card in the Task Board, the agent should start immediately without showing the run confirmation dialog. The dialog adds unnecessary friction for single-task runs where the user has already made an explicit choice about which task to execute. The run dialog should still appear in other contexts (e.g., the Agent Runner page) where configuration review is appropriate.

## Background
The Task Board (`TaskBoard.tsx`) renders task cards in a three-column Kanban layout (pending, in_progress, completed). Each pending or in-progress task card has a "Run" action button. Currently, clicking "Run" on a task card sets `runTarget` state which opens a confirmation dialog (lines 406-471 of `TaskBoard.tsx`). The dialog shows the task title, backend name, an editable iterations input, an auto-commit toggle, and Cancel/Start Agent buttons. Only after the user clicks "Start Agent" does the actual agent execution begin via `startTaskRun()`.

The `startTaskRun` function (lines 136-162) calls `useAgent.start()` with the task file path and iteration count, which sends an IPC message to the Electron main process to spawn the backend CLI. The iteration count and auto-commit setting are currently sourced from the dialog's local state, but they have sensible defaults already — iterations defaults to `config.maxIterations` and auto-commit defaults to `config.shouldCommit`.

## Technical Requirements
1. Clicking the "Run" button on a `TaskCard` in the `TaskBoard` must immediately start the agent for that specific task without displaying the run confirmation dialog
2. The agent run must use the default configuration values for iterations (`config.maxIterations`) and auto-commit (`config.shouldCommit`) when bypassing the dialog
3. The run confirmation dialog in the `AgentRunner` page must remain unchanged — it should still display as before
4. If the agent is already running (`isRunning` is true), the Run button should remain disabled or the click should be a no-op, preserving existing guard behavior
5. After the agent starts, the task card should transition to showing the live output panel and "Stop" button, exactly as it does today after going through the dialog

## Dependencies
- `packages/desktop/src/renderer/components/TaskBoard.tsx` — contains the run dialog and `startTaskRun` logic
- `packages/desktop/src/renderer/components/TaskCard.tsx` — contains the "Run" button that triggers `onRun`
- `packages/desktop/src/renderer/hooks/useAgent.ts` — provides the `start()` function for launching the agent
- `packages/desktop/src/renderer/hooks/useTasks.ts` — provides task data and refresh logic
- Config values (`maxIterations`, `shouldCommit`) used as defaults for the run parameters

## Implementation Approach
1. **Refactor `startTaskRun` in `TaskBoard.tsx`**: Modify the function to accept a task parameter directly instead of reading from `runTarget` dialog state. It should use config defaults for iterations and auto-commit rather than dialog-controlled state values.
2. **Update the `onRun` handler on task cards**: Instead of `setRunTarget(task)` (which opens the dialog), call the refactored `startTaskRun(task)` directly. This bypasses the dialog entirely for task board runs.
3. **Remove or gate the run dialog**: Either remove the run confirmation `AlertDialog` from `TaskBoard.tsx` entirely, or conditionally render it only if `runTarget` is set through a non-task-card path. Since the task board only uses this dialog for single-task runs, it can likely be removed from this component.
4. **Clean up unused state**: Remove the `runTarget` state variable and any dialog-specific state (e.g., local iterations input, auto-commit toggle state within the dialog) that are no longer referenced.
5. **Preserve guard checks**: Ensure the existing `isRunning` check that prevents concurrent runs is maintained in the direct-run path, not just in the dialog's start button.

## Acceptance Criteria

1. **Single task runs immediately on click**
   - Given the Task Board is displayed with pending tasks and no agent is currently running
   - When the user clicks the "Run" button on a task card
   - Then the agent starts processing that task immediately without any dialog appearing

2. **Default config values are used**
   - Given the project has `maxIterations: 5` and `shouldCommit: true` in config
   - When a task is run directly from the task board
   - Then the agent runs with iterations set to 5 and auto-commit enabled

3. **Concurrent run prevention**
   - Given an agent is already running
   - When the user clicks the "Run" button on another task card
   - Then the run is not started and no error occurs (button should be disabled or click ignored)

4. **Live output displays correctly**
   - Given a task has been started from the task board
   - When the agent begins producing output
   - Then the task card transitions to show live output and a "Stop" button

5. **Agent Runner dialog unchanged**
   - Given the user navigates to the Agent Runner page
   - When the user initiates a run from that page
   - Then the run confirmation dialog still appears with all its existing options

## Metadata
- **Complexity**: Low
- **Labels**: desktop, ux, task-board
