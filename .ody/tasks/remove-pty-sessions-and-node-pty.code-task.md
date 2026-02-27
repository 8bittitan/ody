---
status: completed
created: 2026-02-24
started: 2026-02-24
completed: 2026-02-24
---
# Task: Remove PTY Sessions and node-pty Dependency

## Description
Remove all PTY session functionality and the `node-pty` native dependency from the codebase. The PTY-based terminal feature in the desktop app will be evaluated again later, so this is a clean removal rather than a refactor. The goal is to eliminate the native addon dependency, simplify the build pipeline, and remove dead code paths that depend on PTY.

## Background
The desktop Electron app (`packages/desktop`) currently uses `node-pty` to spawn interactive PTY sessions for agent backends. This powers the "Run" / "Open in Terminal" flow where xterm.js in the renderer displays live terminal output from a backend CLI process. The `node-pty` package is a native C++ addon that complicates cross-platform builds and adds maintenance burden. Since the feature is being shelved for re-evaluation, all related code should be cleanly removed. The CLI package (`packages/cli`) does **not** use `node-pty` — it uses inherited stdio via `Bun.spawn`, so it is unaffected. The backend harness's `buildInteractiveCommand()` method is used by the PTY flow and should also be removed.

## Technical Requirements
1. Remove `node-pty` from `packages/desktop/package.json` dependencies
2. Remove `xterm`, `xterm-addon-fit`, and `xterm-addon-web-links` from `packages/desktop/package.json` devDependencies (these are exclusively used by the PTY terminal view)
3. Delete the `packages/desktop/src/main/pty.ts` module entirely
4. Remove all PTY-related IPC handlers and guards from `packages/desktop/src/main/ipc.ts` — specifically the `pty:input` handler, `pty:resize` handler, `PtySession` import/instantiation, `ptySession.kill()` on window close, `ptySession.isRunning()` guards, and the `agent:runOnce` handler that starts PTY sessions
5. Remove `pty:input` and `pty:resize` channel types from `packages/desktop/src/renderer/types/ipc.ts`, and remove the `pty` property from the `OdyApi` type
6. Remove PTY bridge code from both preload scripts (`packages/desktop/src/preload.ts` and `packages/desktop/src/preload/index.ts`)
7. Delete the `packages/desktop/src/renderer/components/TerminalView.tsx` component entirely
8. Remove PTY-related references from `packages/desktop/src/renderer/components/TaskEditor.tsx` (the "Open in Terminal" toast/action)
9. Remove `'node-pty'` from the `external` array in `packages/desktop/vite.main.config.ts`
10. Remove `buildInteractiveCommand()` from the backend harness base class (`internal/backends/src/harness.ts`), the backend facade (`internal/backends/src/backend.ts`), and all backend implementations (`claude.ts`, `codex.ts`, `opencode.ts` in `internal/backends/src/`)
11. Regenerate the lockfile by running `bun install` after dependency removal
12. Verify the project builds cleanly with `bun run build`

## Dependencies
- **`packages/desktop/package.json`**: The `node-pty`, `xterm`, `xterm-addon-fit`, and `xterm-addon-web-links` packages must be removed from dependencies/devDependencies
- **`internal/backends`**: The `buildInteractiveCommand()` method must be removed from the harness interface and all implementations without breaking the non-PTY `buildCommand()` flow
- **`packages/desktop/src/main/ipc.ts`**: Heavy modification needed — PTY code is woven into the IPC handler registration alongside non-PTY handlers, so care must be taken to remove only PTY-specific code
- **Both preload scripts**: Both `src/preload.ts` and `src/preload/index.ts` expose the PTY bridge and must be updated in sync

## Implementation Approach
1. **Remove the core PTY module** — Delete `packages/desktop/src/main/pty.ts` entirely
2. **Clean up IPC handlers** — In `packages/desktop/src/main/ipc.ts`: remove the `PtySession` import, remove the `ptySession` instantiation (line 368), remove `ptySession.kill()` from window close (line 383), remove `ptySession.isRunning()` guard checks from `agent:run` (line 615), `agent:runOnce` (line 652), `agent:editInline` (line 831), `agent:importFromJira` (line 957), and `agent:importFromGitHub` (line 1003). Remove the entire `agent:runOnce` handler (lines 674-688). Remove the `pty:input` handler (lines 708-711) and `pty:resize` handler (lines 712-723)
3. **Update IPC type definitions** — In `packages/desktop/src/renderer/types/ipc.ts`: remove the `pty:input` and `pty:resize` channel entries and the `pty` property from `OdyApi`
4. **Update preload scripts** — Remove the `pty` object from both `packages/desktop/src/preload.ts` and `packages/desktop/src/preload/index.ts`
5. **Delete the TerminalView component** — Remove `packages/desktop/src/renderer/components/TerminalView.tsx` entirely, and remove any imports of it in parent components or route definitions
6. **Clean up TaskEditor** — Remove PTY-related toast message and "Open in Terminal" action from `packages/desktop/src/renderer/components/TaskEditor.tsx`
7. **Remove backend interactive command methods** — Remove `buildInteractiveCommand()` from `internal/backends/src/harness.ts`, `internal/backends/src/backend.ts`, `internal/backends/src/claude.ts`, `internal/backends/src/codex.ts`, and `internal/backends/src/opencode.ts`
8. **Update Vite config** — Remove `'node-pty'` from the `external` array in `packages/desktop/vite.main.config.ts`
9. **Remove package dependencies** — Remove `node-pty` from dependencies and `xterm`/`xterm-addon-fit`/`xterm-addon-web-links` from devDependencies in `packages/desktop/package.json`
10. **Regenerate lockfile and verify build** — Run `bun install` to update `bun.lock`, then run `bun run build` from root to confirm everything compiles without errors
11. **Verify lint passes** — Run `bun lint` to ensure no unused imports or dead references remain

## Acceptance Criteria

1. **node-pty dependency removed**
   - Given the `packages/desktop/package.json` file
   - When inspecting its dependencies
   - Then `node-pty` is not listed in `dependencies` or `devDependencies`

2. **xterm dependencies removed**
   - Given the `packages/desktop/package.json` file
   - When inspecting its devDependencies
   - Then `xterm`, `xterm-addon-fit`, and `xterm-addon-web-links` are not listed

3. **PTY module deleted**
   - Given the desktop source directory
   - When listing files in `packages/desktop/src/main/`
   - Then `pty.ts` does not exist

4. **TerminalView component deleted**
   - Given the renderer components directory
   - When listing files in `packages/desktop/src/renderer/components/`
   - Then `TerminalView.tsx` does not exist

5. **No PTY references in IPC handlers**
   - Given `packages/desktop/src/main/ipc.ts`
   - When searching for `pty`, `PtySession`, or `ptySession`
   - Then no matches are found

6. **No PTY references in preload scripts**
   - Given both preload scripts
   - When searching for `pty`
   - Then no matches are found

7. **No buildInteractiveCommand in backends**
   - Given the `internal/backends/src/` directory
   - When searching for `buildInteractiveCommand`
   - Then no matches are found

8. **Build succeeds**
   - Given the complete set of changes
   - When running `bun run build` from the repository root
   - Then the build completes without errors

9. **Lint passes**
   - Given the complete set of changes
   - When running `bun lint`
   - Then no errors related to PTY removal are reported

## Metadata
- **Complexity**: Medium
- **Labels**: cleanup, dependency-removal, desktop, backends
