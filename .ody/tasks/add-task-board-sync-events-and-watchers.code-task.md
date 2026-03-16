---
status: pending
created: 2026-03-15
started: null
completed: null
---
# Task: Add task board sync via main-process events and filesystem watchers

## Description
Keep the desktop task board, task-state queries, and related progress UI in sync when task files change by combining explicit main-process change events with per-project filesystem watchers. Changes triggered by Ody itself should publish immediate task-change notifications, and external/manual edits should be detected by watchers as a safety net.

## Background
The desktop renderer currently fetches task summaries and task states through React Query in `packages/desktop/src/renderer/hooks/useTasks.ts`, and the task board in `packages/desktop/src/renderer/components/TaskBoard.tsx` renders from those query results. The current model refreshes tasks only when specific UI actions manually call `loadTasks()` or when project context changes. There is no subscription that tells the renderer task files or statuses changed after an agent run, plan generation, import flow, archive operation, manual file edit, or git branch switch.

Because the app is staying local to Electron, the main process should become the source of truth for change notifications. Explicit emits cover known in-app writes, while filesystem watchers catch changes that happen outside those code paths.

## Technical Requirements
1. Add a new IPC event for task invalidation/sync notifications, scoped by project, so the renderer can refresh only the affected task queries.
2. Emit the new task-change event from main-process code paths that are known to modify tasks or task status, including at minimum:
   - task-run lifecycle points where task statuses may move between `pending`, `in_progress`, and `completed`,
   - plan generation that creates or edits task files,
   - import flows that create task files,
   - task deletion,
   - archive/compaction flows that remove completed task files,
   - any other desktop task mutation path already implemented in `packages/desktop/src/main/ipc.ts`.
3. Add main-process filesystem watchers for each tracked project's task directory, and optionally adjacent progress artifacts if the progress UI should refresh from the same mechanism.
4. Debounce/coalesce watcher events per project so bursty file writes do not trigger excessive renderer invalidations.
5. Update renderer task hooks to subscribe once to the new event and invalidate/refetch the project-scoped task queries when the active project's tasks change.
6. Ensure the sync mechanism works whether changes come from Ody, an external editor, a script, or a branch switch that modifies task files on disk.
7. Keep the IPC payload lightweight: send invalidation metadata only, not full task contents.

## Dependencies
- `packages/desktop/src/main/ipc.ts` already owns task mutation handlers and is the primary place to emit task-change events.
- `packages/desktop/src/renderer/types/ipc.ts` will need the new event definition and API typing.
- `packages/desktop/src/renderer/hooks/useTasks.ts` already holds the React Query keys that should be invalidated on task changes.
- `packages/desktop/src/renderer/components/TaskBoard.tsx` should benefit automatically once query invalidation becomes event-driven.

## Implementation Approach
1. Extend `packages/desktop/src/renderer/types/ipc.ts` with a new event such as `tasks:changed`, carrying a payload like `{ projectPath: string; reason: 'agent-iteration' | 'agent-complete' | 'plan-created' | 'import-created' | 'task-deleted' | 'task-archived' | 'fs-change' }`.
2. Add a small main-process task sync helper module or inline utility in `packages/desktop/src/main/ipc.ts` that exposes:
   - `emitTasksChanged(projectPath, reason)`
   - watcher registration/unregistration per project
   - per-project debounce timers for filesystem events
3. Wire explicit emits into all existing task mutation paths in `packages/desktop/src/main/ipc.ts`, including after successful task-run iterations/completions where statuses may have changed, and after any operation that creates, deletes, archives, or imports task files.
4. Add filesystem watching in the main process for each known desktop project's `.ody/tasks` directory.
5. Ensure watcher lifecycle is managed safely:
   - create watchers for existing saved projects on startup,
   - create a watcher when a project is added,
   - dispose watchers when a project is removed or the window closes,
   - recreate or tolerate missing task directories for projects that are initialized later.
6. In `useTasks`, subscribe to `tasks:changed` once and invalidate `queryKeys.tasks.list(projectPath)` plus `queryKeys.tasks.states(projectPath)` when the event matches the active project. If progress data is also refreshed from this signal, invalidate that query too.
7. Keep `TaskBoard` focused on rendering query data; avoid duplicating task-sync logic inside the component itself.
8. Add focused coverage for the sync helper if practical, especially debounce behavior and project-scoped invalidation payloads.

## Scope Notes
- This task is about keeping desktop task data fresh, not redesigning the task board layout.
- Watcher behavior should be best-effort and resilient; missing directories during init should not crash the app.
- This task should integrate cleanly with any future multi-job architecture by always scoping events with `projectPath`.
- If the concurrent job refactor lands separately, this task should still work as long as run/plan/import mutation paths emit `tasks:changed`.

## Acceptance Criteria

1. **In-app task updates refresh automatically**
   - Given the desktop app changes task files or task status through a run, plan, import, delete, or archive flow
   - When that operation completes or reaches the relevant lifecycle point
   - Then the task board refreshes automatically without requiring a manual reload action

2. **External edits refresh automatically**
   - Given the user edits, adds, removes, or replaces `.ody/tasks/*.code-task.md` files outside the desktop app
   - When the filesystem change is detected
   - Then the active project's task queries are invalidated and the task board reflects the new on-disk state shortly afterward

3. **Scoped invalidation**
   - Given multiple projects are configured in the desktop app
   - When tasks change for one project
   - Then only that project's task-change event is emitted and only that project's query data is invalidated/refetched

4. **Watcher burst handling**
   - Given a task operation touches several files in quick succession
   - When the filesystem watcher receives multiple raw events
   - Then the desktop app coalesces them into a small number of task-refresh cycles rather than flooding the renderer

5. **Startup and teardown safety**
   - Given saved desktop projects exist at startup or are added/removed during runtime
   - When watcher registration changes
   - Then the app attaches and disposes watchers without leaking resources or crashing when task directories are missing

6. **Lightweight IPC contract**
   - Given task-change events are flowing from the main process to the renderer
   - When the renderer receives them
   - Then it refetches task data via existing APIs instead of relying on large task payloads sent over IPC

## Metadata
- **Complexity**: Medium
- **Labels**: desktop, electron, tasks, ipc, watcher, sync
