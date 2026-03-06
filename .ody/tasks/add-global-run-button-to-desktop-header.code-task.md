---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Add Global Run Control To Desktop Header

## Description
Implement a global `Run` control in the Desktop application's top-level header that starts the agent for the active project in continuous mode. While the agent is running, the header control should switch to `Stop`. If the run ends because there are no remaining tasks to execute, the app should stop the loop and show a toast notification so the user understands why execution ended.

## Background
The Desktop app already exposes agent run and stop IPC handlers, a shared `useAgent` renderer hook, a top-level header in the root route, and a toast system. The existing agent runner supports iterative execution, but there is no global header action that lets users start or stop an always-on run from anywhere in the app. This task adds that control and makes the completion state clearer when the agent exits because there is nothing left to do.

## Technical Requirements
1. Add a header-level action in the Desktop renderer that is visible across the app and uses the existing agent state to render `Run` when idle and `Stop` while a run is active.
2. Start the agent in continuous mode for the active project without requiring a specific task selection.
3. Stop the active run when the user presses `Stop`, using the existing stop pathway.
4. Detect the case where a continuous run ends because there are no unresolved tasks remaining and surface that outcome to the renderer.
5. Show a toast notification when the run stops due to no remaining tasks.
6. Preserve existing run/stop behavior, agent output streaming, and error handling for other execution paths.

## Dependencies
- Existing Desktop agent IPC flow in `packages/desktop/src/main/ipc.ts`
- Existing agent runner in `packages/desktop/src/main/agent.ts`
- Existing renderer hook in `packages/desktop/src/renderer/hooks/useAgent.ts`
- Existing header layout in `packages/desktop/src/renderer/routes/__root.tsx`
- Existing toast utilities in `packages/desktop/src/renderer/lib/toast.ts`

## Implementation Approach
1. Add a global header action in the root Desktop route that reads the active project and agent state, invokes `useAgent().start()` with continuous run options, and swaps to `Stop` while running.
2. Extend the main-process agent run flow to distinguish "completed because no unresolved tasks remain" from other completion paths and emit an event or state signal the renderer can observe.
3. Update the renderer agent hook to listen for that completion reason and trigger an informational toast when the run stops because there are no tasks left.
4. Ensure the control is disabled or guarded when no active project is selected so the action cannot start an invalid run.

## Acceptance Criteria

1. **Header Run Action**
   - Given the Desktop app has an active project selected
   - When the user views any screen in the app
   - Then a top-level header action is visible for starting the agent run

2. **Run Starts In Continuous Mode**
   - Given the app is idle and an active project exists
   - When the user clicks `Run`
   - Then the Desktop app starts the agent for the active project without a task file filter and keeps iterating until stopped or no unresolved tasks remain

3. **Stop Replaces Run While Active**
   - Given the agent is currently running
   - When the header is rendered
   - Then the `Run` action is replaced by a `Stop` action
   - And when the user clicks `Stop`, the current run is stopped through the existing stop flow

4. **No-Task Completion Notification**
   - Given a continuous run is active and the agent reaches a state where no unresolved tasks remain
   - When the run exits for that reason
   - Then the app stops the run cleanly
   - And an informational toast notifies the user that there are no tasks left to run

5. **No Active Project Guard**
   - Given no active project is selected
   - When the header is rendered
   - Then the global run control does not start a run with an empty project path

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, agent, ui, ipc
