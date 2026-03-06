---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Make Desktop Graceful Stop Actually Interrupt the Current Agent Run

## Description
The desktop app exposes “graceful” and “force” stop modes for agent runs, but the graceful path does not actually signal the current backend process. Fix the stop behavior so the graceful option meaningfully interrupts or requests shutdown of the active iteration instead of merely preventing the next loop from starting.

## Background
In `packages/desktop/src/renderer/components/AgentRunner.tsx`, users can choose between graceful and force stop. The UI copy implies graceful cleanup is possible. However, `AgentRunner.stop()` in `packages/desktop/src/main/agent.ts` only sets `aborted = true` for the graceful path and does not send any signal to the active child process. Since `runLoop()` is awaiting `spawnAndStream()`, the current iteration continues to run until the backend exits on its own.

This means the UI is overstating the app’s control over the process. For long-running iterations, users effectively have only one real stop option: force kill.

## Technical Requirements
1. The “graceful” stop option in the desktop UI must correspond to actual backend interruption behavior
2. If a genuine graceful shutdown protocol is not available for the backend harnesses, the UI must not present the option as if it exists
3. The renderer’s status and notifications must accurately describe what kind of stop occurred
4. Stopping a run must not leave the app stuck waiting indefinitely for the active iteration to finish
5. The stop behavior for inline edit flows must remain correct and not regress while changing shared stop semantics

## Dependencies
- `packages/desktop/src/main/agent.ts` — current stop semantics and child process lifecycle
- `packages/desktop/src/renderer/components/AgentRunner.tsx` — stop confirmation UI and messaging
- `packages/desktop/src/renderer/hooks/useAgent.ts` — renderer stop action and state handling
- `packages/desktop/src/main/ipc.ts` — IPC `agent:stop` behavior, including inline edit cancellation
- Backend harness process model exposed via `internal/backends`

## Implementation Approach
1. Decide whether the app can support a real graceful stop for backend CLIs:
   - If yes, implement appropriate signaling and process shutdown handling
   - If no, simplify the UI to remove the false distinction and present one honest stop path
2. Update `AgentRunner.stop()` so the chosen stop modes match the actual process control behavior
3. Align renderer notifications and dialog descriptions with the implemented stop semantics
4. Verify `agent:stopped` and related completion events are emitted consistently after the stop path
5. Confirm inline AI edit cancellation still works correctly after any shared stop changes

## Acceptance Criteria

1. **Graceful stop is real or removed**
   - Given the stop confirmation dialog in the desktop app
   - When the user chooses a stop action
   - Then the available stop options accurately reflect the behavior the app can actually perform

2. **Current run does not continue indefinitely after stop request**
   - Given an agent iteration is actively running
   - When the user requests a stop
   - Then the run is interrupted according to the selected stop mode and the app does not keep misleadingly showing a stoppable state

3. **Status messages are accurate**
   - Given a stop request completes
   - When notifications or banners are shown
   - Then they describe the real stop behavior, not an unavailable graceful cleanup path

4. **Inline edit stop still works**
   - Given an inline AI edit is running in the task editor
   - When the user cancels it
   - Then the edit process stops correctly and the editor state remains consistent

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, agent, process-control, ux
