---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Implement IPC Layer and Preload Script

## Description
Implement the complete typed IPC contract between the Electron main process and renderer, including the preload script that exposes the `window.ody` API via `contextBridge`, IPC handler registration in the main process, and TypeScript type definitions shared between both sides.

## Background
All communication between the renderer (React) and main process (Node.js) goes through Electron's `ipcMain`/`ipcRenderer` via `contextBridge`. The preload script exposes a `window.ody` API object with namespaced methods (config, backends, tasks, agent, editor, import, auth, progress, projects, theme, archive, system). The main process registers handlers for each channel. Type safety is enforced through shared type definitions.

## Technical Requirements
1. Create `src/renderer/types/ipc.ts` with the full `IpcChannels` and `IpcEvents` type definitions
2. Implement `src/preload/index.ts` with the complete `contextBridge.exposeInMainWorld('ody', {...})` API
3. Create `src/main/ipc.ts` with `registerIpcHandlers(win: BrowserWindow)` function that registers all `ipcMain.handle()` handlers
4. Implement handler stubs for all IPC channels (actual logic delegated to later tasks):
   - Config: `config:load`, `config:save`, `config:saveGlobal`, `config:validate`, `config:resetGuiOverrides`
   - Backends: `backends:available`, `backends:models`
   - Tasks: `tasks:list`, `tasks:read`, `tasks:delete`, `tasks:byLabel`, `tasks:states`
   - Agent: `agent:run`, `agent:runOnce`, `agent:stop`, `agent:planNew`, `agent:planBatch`, `agent:planEdit`, `agent:dryRun`, `agent:editInline`
   - Editor: `editor:save`, `editor:snapshot`
   - Import: `import:fetchJira`, `import:fetchGitHub`, `agent:importFromJira`, `agent:importFromGitHub`, `agent:importDryRun`
   - Auth: `auth:list`, `auth:setJira`, `auth:setGitHub`, `auth:removeJira`, `auth:removeGitHub`
   - Progress: `progress:read`, `progress:clear`
   - Archive: `archive:compact`, `archive:list`
   - Projects: `projects:list`, `projects:add`, `projects:remove`, `projects:switch`, `projects:active`
   - Theme: `theme:get`, `theme:set`
   - System: `system:openExternal`
5. Create `src/renderer/lib/api.ts` with typed wrapper functions around `window.ody`
6. Ensure all event listeners in preload have proper cleanup via `removeAllListeners`

## Dependencies
- `scaffold-electron-app` task must be completed first

## Implementation Approach
1. Define the shared types in `src/renderer/types/ipc.ts`:
   - `IpcChannels` type mapping channel names to function signatures (invoke/handle pattern)
   - `IpcEvents` type mapping event names to callback signatures (send/on pattern)
   - `RunOptions`, `RunOnceOptions`, `TaskSummary`, `TaskState`, `ArchiveEntry` helper types
2. Implement the preload script with the full `window.ody` API:
   - Each namespace maps to a group of `ipcRenderer.invoke()` calls
   - Event listeners use `ipcRenderer.on()` with callback wrappers
   - Include `removeAllListeners()` method on the agent namespace
3. Create `src/main/ipc.ts`:
   - Export `registerIpcHandlers(win: BrowserWindow)` function
   - Register `ipcMain.handle()` for each channel
   - Stubs return placeholder data (e.g., empty arrays, null) for now
   - Real implementations will be wired in by subsequent tasks
4. Create `src/renderer/lib/api.ts`:
   - Typed wrapper around `window.ody` that provides TypeScript-safe access
   - Handles the case where `window.ody` is undefined (for testing outside Electron)
5. Wire `registerIpcHandlers()` into `src/main/index.ts` after window creation
6. Add `Window` interface augmentation for `window.ody` typing

## Acceptance Criteria

1. **Preload Exposes API**
   - Given the Electron app running
   - When accessing `window.ody` in the renderer console
   - Then it exposes all namespaced methods (config, backends, tasks, agent, editor, import, auth, progress, projects, theme, archive, system)

2. **IPC Channels Registered**
   - Given the main process
   - When it starts
   - Then all IPC handlers are registered without errors

3. **Type Safety**
   - Given the IPC type definitions
   - When importing and using the typed API in renderer code
   - Then TypeScript provides full autocomplete and type checking

4. **Event Cleanup**
   - Given the agent event listeners
   - When calling `removeAllListeners()`
   - Then all agent event listeners are properly cleaned up

5. **Invoke/Handle Round-Trip**
   - Given a registered handler (e.g., `config:load`)
   - When called from the renderer via `window.ody.config.load()`
   - Then it returns the handler's response (stub data for now)

## Metadata
- **Complexity**: High
- **Labels**: ipc, electron, preload, desktop
