---
status: pending
created: 2026-03-15
started: null
completed: null
---
# Task: Split desktop agent state subscriptions to reduce renderer rerenders

## Description
Refactor the desktop renderer's agent state flow so high-frequency output streaming does not trigger broad rerenders across unrelated views. Separate status, output, and control state into narrower subscriptions, and avoid rebuilding large derived output strings on every chunk.

## Background
The desktop app currently exposes agent state through `packages/desktop/src/renderer/hooks/useAgent.ts`, which subscribes consumers to `isRunning`, `iteration`, `maxIterations`, `output`, `error`, and completion flags in one hook. Components such as `packages/desktop/src/renderer/routes/__root.tsx`, `packages/desktop/src/renderer/components/TaskBoard.tsx`, and `packages/desktop/src/renderer/components/AgentRunner.tsx` all consume this hook, so any streamed output chunk can rerender large parts of the renderer tree.

On top of that, `packages/desktop/src/renderer/store/slices/agentSlice.ts` appends output by copying the full string array on every chunk, and `packages/desktop/src/renderer/components/TaskBoard.tsx` derives a preview by calling `stripAnsi(output.join(''))` each time output changes. During long-running sessions this can create unnecessary CPU and memory churn in the renderer.

## Technical Requirements
1. Break agent state consumption into narrower selectors or hooks so components subscribe only to the state they actually render.
2. Ensure layout-level components do not subscribe to streamed output unless they visibly render it.
3. Replace expensive repeated output reconstruction with a more incremental or localized preview strategy.
4. Preserve current agent controls and lifecycle behavior while reducing rerender frequency during output streaming.
5. Keep the solution scoped to `packages/desktop` only.

## Dependencies
- `packages/desktop/src/renderer/hooks/useAgent.ts` currently centralizes agent subscriptions and actions.
- `packages/desktop/src/renderer/store/slices/agentSlice.ts` owns the renderer-side output buffer and status flags.
- `packages/desktop/src/renderer/components/TaskBoard.tsx` and `packages/desktop/src/renderer/components/AgentRunner.tsx` consume streamed state directly.
- `packages/desktop/src/renderer/routes/__root.tsx` should only react to lightweight status changes.

## Implementation Approach
1. Audit each `useAgent()` consumer and separate the current API into more focused selectors or hooks such as status-only, controls-only, and output-only accessors.
2. Update root/layout components to subscribe only to `isRunning` and any other state they visibly display.
3. Rework output buffering in the Zustand slice so appends avoid unnecessary full-array recreation where practical, or at minimum isolate those updates away from non-output subscribers.
4. Replace `TaskBoard`'s `stripAnsi(output.join(''))` preview path with a smaller derived structure, cached preview text, or output processing that only runs in the component that actually needs it.
5. Keep `AgentOutput` and other output-heavy views responsible for the streaming buffer while preventing unrelated components from rerendering on each chunk.
6. Verify long agent runs keep the UI responsive and that status indicators still update correctly.

## Scope Notes
- This task is about renderer responsiveness, not redesigning the run UI.
- Preserve existing user-visible run/stop behavior and notifications.
- Avoid broad architectural changes outside the desktop package.

## Acceptance Criteria

1. **Output streaming is isolated**
   - Given an agent run is actively streaming output
   - When chunks arrive rapidly
   - Then only components that render agent output or output-derived data rerender for those updates

2. **Root layout stays lightweight**
   - Given the app shell is mounted during a run
   - When output changes without a status transition
   - Then the root layout does not rerender purely because output text changed

3. **Task board preview is efficient**
   - Given the task board shows a running-task preview
   - When output grows over time
   - Then preview generation avoids rebuilding the entire output text on every chunk

4. **Agent behavior remains unchanged**
   - Given the user starts and stops agent runs through the desktop UI
   - When the refactor is complete
   - Then iteration counts, stop controls, completion state, and errors still behave as before

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, react, performance, zustand, agent
