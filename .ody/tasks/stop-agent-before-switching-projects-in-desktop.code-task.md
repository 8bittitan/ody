---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Stop Active Agent Runs Before Switching Projects in Desktop

## Description
The desktop app currently allows switching to a different project while an agent run is active, but it only resets renderer-side state and does not stop the underlying backend process in the main process. Fix project switching so the old run is explicitly stopped or blocked before the active project changes, preventing hidden background mutations against the previous project.

## Background
In `packages/desktop/src/renderer/routes/__root.tsx`, selecting another project while `isRunning` is true opens a confirmation dialog. Confirming the switch proceeds with `applySwitch()` and then shows a warning that agent state was reset. Separately, a `useEffect` on `activeProjectPath` calls `resetAgentState()` whenever the active project changes.

The problem is that the actual run is owned by `AgentRunner` in `packages/desktop/src/main/agent.ts`, and switching projects does not stop it. `runLoop()` continues using the original `projectDir`, so the previous project can still be modified while the UI now points at a different project and claims the agent state was reset.

## Technical Requirements
1. The desktop app must not leave an old project’s agent run active after switching to a different project
2. Confirming a project switch while a run is active must either:
   - stop the current run before switching, or
   - block the switch until the run has been stopped
3. Renderer state must not be reset in a way that hides a still-running main-process agent
4. The project-switch confirmation dialog copy must accurately reflect the behavior the app will perform
5. The global run indicator and task/run views must remain synchronized with the real process state after a switch

## Dependencies
- `packages/desktop/src/renderer/routes/__root.tsx` — project switching flow and renderer-side reset behavior
- `packages/desktop/src/renderer/hooks/useAgent.ts` — renderer-facing run/stop controls and state subscriptions
- `packages/desktop/src/main/agent.ts` — owns the actual backend process lifecycle
- `packages/desktop/src/main/ipc.ts` — IPC handlers for `agent:run` and `agent:stop`

## Implementation Approach
1. Update the project-switch confirmation flow in `__root.tsx` so confirming a switch first stops the active run or refuses to switch until the run is stopped
2. Ensure the renderer does not call `resetAgentState()` purely because `activeProjectPath` changed while an old run may still be active
3. If the chosen UX is “stop then switch,” await the stop path and only change projects once the process lifecycle and renderer state are aligned
4. Review any related notifications or warning text so the app does not claim the run was merely “reset” if it was actually stopped or blocked
5. Verify that switching projects leaves both the UI and main process in the same run state

## Acceptance Criteria

1. **Switching does not leave a hidden run behind**
   - Given an agent run is active for Project A
   - When the user switches to Project B
   - Then the run for Project A is no longer active after the switch completes

2. **Renderer and main-process state stay aligned**
   - Given a project switch occurs while a run was active
   - When the switch is complete
   - Then the UI run status matches the real process state in the main process

3. **Confirmation dialog matches behavior**
   - Given the user is prompted before switching projects during a run
   - When the dialog is shown
   - Then its message accurately describes whether the current run will be stopped or the switch will be blocked

4. **No silent state reset of active work**
   - Given `packages/desktop/src/renderer/routes/__root.tsx`
   - When inspecting the project-switch logic
   - Then renderer state is not reset in a way that can hide a still-running backend process

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, agent, project-switching, bug-fix
