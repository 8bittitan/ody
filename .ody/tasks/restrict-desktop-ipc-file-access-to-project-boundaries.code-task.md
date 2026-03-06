---
status: completed
created: 2026-03-06
started: 2026-03-06
completed: 2026-03-06
---
# Task: Restrict Desktop IPC File Access to the Active Project Task Boundaries

## Description
Several Electron IPC handlers in the desktop app trust arbitrary file paths from the renderer whenever the path string contains a slash. Tighten these handlers so reads, writes, snapshots, and deletions are constrained to the active project’s intended task file boundaries instead of allowing arbitrary filesystem access through the preload bridge.

## Background
In `packages/desktop/src/main/ipc.ts`, the `tasks:read`, `tasks:delete`, `editor:save`, and `editor:snapshot` handlers accept renderer-provided file paths. If the path contains `/` or `\`, the code treats it as a fully trusted path and uses it directly. In Electron, that means any renderer compromise or accidental misuse of the bridge can escalate into arbitrary file reads, writes, or deletes on the user’s machine.

The renderer should not be treated as a fully trusted caller for raw filesystem access. These handlers should validate that requested files belong to the active project’s task directory, or otherwise use stable identifiers that the main process resolves safely.

## Technical Requirements
1. Renderer-driven task file reads, saves, snapshots, and deletions must be restricted to the active project’s allowed task file directory
2. Arbitrary absolute paths or path traversal outside the active project’s task scope must be rejected
3. The preload-exposed IPC API must continue to support current task editor and task board flows without requiring unsafe raw path trust
4. Error messages returned to the renderer should be explicit enough for debugging but must not weaken the boundary
5. The fix must cover at least:
   - `tasks:read`
   - `tasks:delete`
   - `editor:save`
   - `editor:snapshot`

## Dependencies
- `packages/desktop/src/main/ipc.ts` — vulnerable handlers and path resolution
- `packages/desktop/src/preload/index.ts` — exposes the IPC bridge to the renderer
- `packages/desktop/src/renderer/hooks/useEditor.ts` — depends on read/save/snapshot flows
- `packages/desktop/src/renderer/components/TaskBoard.tsx` — depends on delete flows
- `packages/desktop/src/renderer/types/ipc.ts` — IPC contract definitions

## Implementation Approach
1. Introduce a shared helper in `ipc.ts` to resolve a renderer-supplied task reference to a canonical path within the active project’s task directory
2. Reject requests whose resolved path falls outside the allowed project boundary
3. Update all affected handlers to use the shared safe resolver instead of trusting slash-containing paths directly
4. Review whether the renderer should pass basenames/relative task identifiers instead of raw absolute paths where feasible
5. Add tests or validation coverage around path traversal, absolute-path injection, and valid in-project task file access

## Acceptance Criteria

1. **Out-of-scope paths are rejected**
   - Given the renderer requests a task read, save, snapshot, or delete using a path outside the active project task directory
   - When the IPC handler runs
   - Then the operation is rejected

2. **Valid task files still work**
   - Given a legitimate task file in the active project’s `.ody/tasks` directory
   - When the renderer reads, saves, snapshots, or deletes it through IPC
   - Then the operation succeeds normally

3. **No direct trust of arbitrary slash-containing paths remains**
   - Given `packages/desktop/src/main/ipc.ts`
   - When reviewing the affected handlers
   - Then slash-containing input is not automatically treated as a fully trusted filesystem path

4. **Task editor and task board continue to function**
   - Given the desktop task editor and task board flows
   - When reading, editing, snapshotting, or deleting task files
   - Then those workflows still function with the new path validation in place

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, security, ipc, filesystem
