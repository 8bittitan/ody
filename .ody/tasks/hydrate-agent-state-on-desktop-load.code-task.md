---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---

# Task: Hydrate Agent State on Desktop Load

## Description
When the desktop app loads (or the renderer reloads), the UI has no way to learn whether an agent is already running. The Zustand agent store initializes `isRunning: false`, and the only updates come from push events (`agent:started`, `agent:complete`, `agent:stopped`). If the renderer wasn't mounted when those events fired, the Run/Stop button in the header, the footer status dot, and the sidebar indicator all show "idle" even though an agent process is active in the main process.

Add an `agent:status` request/response IPC channel that returns the current agent state, and call it from the renderer on initial mount and on project switch so the Zustand store is hydrated correctly.

## Background
- `AgentRunner` (in `packages/desktop/src/main/agent.ts`) already has an `isRunning()` method that checks `this.proc !== null`.
- However, iteration number, max iterations, and task files are **local variables** inside `runLoop()` — they are not currently queryable from outside.
- The renderer's `useAgent` hook (`packages/desktop/src/renderer/hooks/useAgent.ts`) sets up push-event listeners via `ensureAgentListeners()` but has no pull mechanism.
- The `agentSlice` Zustand store (`packages/desktop/src/renderer/store/slices/agentSlice.ts`) defaults `isRunning` to `false` with no initialization logic.
- IPC types are defined in `packages/desktop/src/renderer/types/ipc.ts`; the preload bridge is in `packages/desktop/src/preload.ts`.
- The `agentRunner` instance is a local `const` inside `registerIpcHandlers()` in `packages/desktop/src/main/ipc.ts` (line ~471).

## Technical Requirements
1. **Promote run-loop state to instance fields on `AgentRunner`**: Store `iteration`, `maxIterations`, and `taskFiles` as private instance fields (alongside `proc`, `aborted`, etc.) so they survive beyond the local scope of `runLoop()`. Reset them when a run ends.
2. **Add a `status()` method to `AgentRunner`**: Return an `AgentStatus` object: `{ isRunning: boolean; iteration: number; maxIterations: number; taskFiles: string[] }`.
3. **Register an `agent:status` IPC invoke handler** in `ipc.ts` that calls `agentRunner.status()` and returns the result.
4. **Add the `agent:status` channel to `IpcChannels`** in `ipc.ts` (renderer types) with the correct return type.
5. **Expose `agent.status` in the preload bridge** (`preload.ts`) mapped to `ipcRenderer.invoke('agent:status')`.
6. **Add `status` to the `OdyApi` type** under the `agent` namespace.
7. **Call `agent.status()` on renderer initialization** — inside `ensureAgentListeners()` (or a new dedicated init function called from `useAgent`) — and hydrate the Zustand store (`setRunning`, `setIteration`) with the response.
8. **Call `agent.status()` on project switch** — listen for `projects:switched` and re-query agent status, since switching projects may mean the running agent belongs to a different project context.
9. **Do not replay output history** — the status response intentionally excludes buffered stdout/stderr. Output replay is out of scope.

## Dependencies
- The `agentRunner` instance in `ipc.ts` is a local variable — the new handler must be registered in the same scope (inside `registerIpcHandlers()`), consistent with the existing `agent:run` and `agent:stop` handlers.

## Implementation Approach
1. In `agent.ts`, add private fields `private _iteration = 0`, `private _maxIterations = 0`, `private _taskFiles: string[] = []` to `AgentRunner`. Update `runLoop()` to write to these fields instead of (or in addition to) local variables. Reset them when the run ends (after `agent:complete` or `agent:stopped` is sent).
2. Add a public `status(): AgentStatus` method that reads these fields and `isRunning()`.
3. Define the `AgentStatus` type in `ipc.ts` (renderer types): `{ isRunning: boolean; iteration: number; maxIterations: number; taskFiles: string[] }`.
4. Add `'agent:status': () => AgentStatus` to the `IpcChannels` type.
5. In `ipc.ts` (main), register `agent:status` via `registerHandler('agent:status', () => agentRunner.status())`.
6. In `preload.ts`, add `status: () => ipcRenderer.invoke('agent:status')` under the `agent` namespace.
7. Add `status: Asyncify<IpcChannels['agent:status']>` to the `agent` section of `OdyApi`.
8. In `useAgent.ts`, after `ensureAgentListeners()` sets up push listeners, immediately call `api.agent.status()` and use the response to hydrate the store (guard against race conditions by only applying if `isRunning` differs from the current store value, or always applying on first call).
9. In `useAgent.ts` or `__root.tsx`, subscribe to `projects:switched` and re-query `api.agent.status()` to refresh the store.

## Acceptance Criteria

1. **Agent running before renderer load**
   - Given an agent is running in the main process
   - When the renderer mounts (initial load or reload)
   - Then the header Run button shows "Stop" (destructive variant), the footer shows a pulsing green dot, and the sidebar shows "running"

2. **No agent running on load**
   - Given no agent is running
   - When the renderer mounts
   - Then the header Run button shows "Run" (default variant) and the footer/sidebar show idle state — no change from current behavior

3. **Iteration info is restored**
   - Given an agent is on iteration 3 of 5
   - When the renderer mounts
   - Then `useAgent()` returns `iteration: 3` and `maxIterations: 5`

4. **Status re-queried on project switch**
   - Given an agent is running in the current project
   - When the user switches to a different project
   - Then `agent:status` is re-queried and the UI updates accordingly

5. **Push events still work normally**
   - Given the renderer is mounted and status has been hydrated
   - When an agent starts, iterates, completes, or stops
   - Then the push events continue to update the Zustand store as before — no regressions

6. **Type safety**
   - Given the new `agent:status` channel
   - When the project is typechecked (`bun typecheck`)
   - Then there are no type errors related to the new channel, preload bridge, or API type

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, ipc, agent, state-sync, ux
