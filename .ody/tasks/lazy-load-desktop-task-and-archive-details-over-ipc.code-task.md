---
status: completed
created: 2026-03-15
started: 2026-03-16
completed: 2026-03-16
---
# Task: Lazy-load desktop task and archive details over IPC

## Description
Reduce Electron main-process and IPC overhead by returning lightweight metadata for task and archive listings, then loading full file contents only when the renderer explicitly requests them.

## Background
The desktop app currently does eager work in `packages/desktop/src/main/ipc.ts` for both `tasks:list` and `archive:list`. Task listing reads and summarizes every task file, while archive listing reads complete archive and progress files for every history entry before the user opens any specific section. The renderer then stores these large payloads in views like `packages/desktop/src/renderer/components/ArchiveViewer.tsx`.

Because Electron routes all of this through the main process, the current approach increases filesystem work, blocks more main-process time than necessary, and sends oversized payloads over IPC. Larger projects and long archive histories will amplify this cost.

## Technical Requirements
1. Keep list endpoints lightweight by returning metadata only for initial task and archive views.
2. Add follow-up IPC read paths for fetching full task or archive content on demand.
3. Preserve existing renderer behavior while shifting heavy file reads to user-triggered actions.
4. Avoid sending large archive or task bodies over IPC unless the user has requested that specific item.
5. Keep the work scoped to the desktop package.

## Dependencies
- `packages/desktop/src/main/ipc.ts` currently implements `tasks:list` and `archive:list`.
- `packages/desktop/src/renderer/components/ArchiveViewer.tsx` eagerly receives archive contents today.
- `packages/desktop/src/renderer/hooks/useTasks.ts` already wraps task list loading and may need companion detail reads.
- `packages/desktop/src/preload/index.ts` and `packages/desktop/src/renderer/types/ipc.ts` define the IPC surface.

## Implementation Approach
1. Redesign the `tasks:list` and `archive:list` response shapes so list payloads contain only the metadata needed for initial rendering.
2. Add new IPC handlers for reading full archive section contents and any task details that should no longer be bundled in the list response.
3. Update preload and renderer IPC typings to expose the new detail-read methods.
4. Refactor `ArchiveViewer` to fetch content only when a date/section is expanded instead of hydrating all content up front.
5. Review whether task summaries can be built from lighter metadata or deferred reads without regressing the task board UX.
6. Keep responses project-scoped and ensure missing files fail gracefully.

## Scope Notes
- This task focuses on IPC payload size and main-process file-read cost.
- Do not redesign archive presentation beyond what is required to support lazy reads.
- Any schema changes should remain backwards-consistent inside the desktop package.

## Acceptance Criteria

1. **Archive list is lightweight**
   - Given the archive view loads for a project with many archived files
   - When the renderer calls the archive list endpoint
   - Then the response contains metadata only and does not include every archive body's full content

2. **Archive content loads on demand**
   - Given the user expands a tasks, progress, or legacy archive section
   - When that section is opened
   - Then the renderer fetches that specific content through a dedicated read path

3. **Task-related IPC avoids oversized payloads**
   - Given a project has many or large task files
   - When the task board requests initial list data
   - Then the app avoids unnecessarily transferring large task bodies over IPC

4. **UI behavior remains correct**
   - Given the user browses tasks and archives normally
   - When content is fetched lazily
   - Then the desktop UI still renders the expected information and handles missing-file errors gracefully

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, electron, ipc, performance, tasks, archive
