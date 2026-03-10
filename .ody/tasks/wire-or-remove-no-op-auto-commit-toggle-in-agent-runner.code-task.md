---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Wire or Remove the No-Op Auto-Commit Toggle in Desktop Agent Runner

## Description
The desktop Agent Runner exposes an “Auto-commit after run” switch in its confirmation dialog, but the selected value is never used to change run behavior. Fix this false-control UI by either wiring the toggle into real run configuration or removing it from the dialog.

## Background
`packages/desktop/src/renderer/components/AgentRunner.tsx` stores `runShouldCommit` in local state and renders a switch in the run confirmation dialog. However, `handleStart()` only passes `projectDir`, `taskFiles`, and `iterations` to `useAgent().start()`. The switch value never reaches the backend or config layer. The only effect is that the success toast conditionally says “Auto-commit is enabled in config.”

This is misleading: users can toggle the switch and reasonably expect it to change run behavior, but it currently does nothing.

## Technical Requirements
1. The Agent Runner must not expose a toggle that has no effect on run behavior
2. Choose one of these outcomes:
   - wire the toggle into actual run behavior/config used by the agent process, or
   - remove the toggle from the Agent Runner UI
3. Any remaining toast or dialog copy must accurately describe the source of auto-commit behavior
4. The task board and global run entry points should remain behaviorally consistent with the chosen approach
5. The implementation must not imply per-run auto-commit overrides if the backend only supports config-based behavior

## Dependencies
- `packages/desktop/src/renderer/components/AgentRunner.tsx` — false-control toggle and start flow
- `packages/desktop/src/renderer/hooks/useAgent.ts` — current run API shape
- `packages/desktop/src/renderer/types/ipc.ts` — run option contract
- `packages/desktop/src/main/ipc.ts` — receives run options from the renderer
- `@internal/config` / backend run behavior — determines whether per-run auto-commit overrides are actually supported

## Implementation Approach
1. Review whether the underlying desktop/main-process run flow can support a per-run `autoCommit` override without broad architectural changes
2. If it can, extend the IPC and run option flow to carry and honor that value
3. If it cannot, remove the switch and update the dialog to present auto-commit as a config-derived behavior only
4. Ensure any success notifications describe the real source of auto-commit behavior
5. Compare the Agent Runner behavior with the task board and global run controls so the desktop app does not present inconsistent controls for the same backend behavior

## Acceptance Criteria

1. **No false-control toggle remains**
   - Given the Agent Runner run confirmation dialog
   - When the user reviews the controls
   - Then every control shown there has an actual effect on run behavior

2. **Auto-commit behavior is truthful**
   - Given the user starts a run from the Agent Runner
   - When the run begins
   - Then the UI messaging accurately reflects whether auto-commit is config-driven or explicitly overridden

3. **Chosen behavior is consistent across entry points**
   - Given the desktop app supports starting runs from multiple places
   - When comparing Agent Runner, task board, and global run controls
   - Then the auto-commit behavior and messaging are consistent with the implemented model

## Metadata
- **Complexity**: Low
- **Labels**: desktop, ux, config, bug-fix
