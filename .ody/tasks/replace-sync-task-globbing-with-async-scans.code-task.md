---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Replace Synchronous Task Globbing with Async Scans

## Description
Remove synchronous task directory scans from runtime command paths to reduce event-loop blocking and improve responsiveness under larger task directories.

## Background
Several commands currently use `Bun.Glob(...).scanSync(...)` to discover `.code-task.md` files (`packages/cli/src/util/task.ts`, `packages/cli/src/cmd/task/list.ts`, `packages/cli/src/cmd/task/edit.ts`, and `packages/cli/src/cmd/compact.ts`). While functionally correct, sync scans block the main thread and can delay prompt rendering/spinner updates in bigger repositories.

## Technical Requirements
1. Replace `scanSync` usage in task-related runtime paths with asynchronous scanning.
2. Centralize async task-file discovery in shared utilities to avoid duplicate scan logic.
3. Preserve current filtering (`*.code-task.md`) and command behavior.
4. Preserve graceful handling when tasks directory does not exist.
5. Ensure command output remains deterministic and user-friendly.
6. Keep command interfaces unchanged (no new required flags or args).
7. Add/update tests to validate async discovery behavior and error handling.

## Dependencies
- `packages/cli/src/util/task.ts` -- primary shared point for task discovery logic.
- `packages/cli/src/cmd/task/list.ts` -- direct sync scan usage today.
- `packages/cli/src/cmd/task/edit.ts` -- direct sync scan usage today.
- `packages/cli/src/cmd/compact.ts` -- direct sync scan usage today.
- `packages/cli/src/cmd/run.ts` -- indirect consumer through task utilities.

## Implementation Approach
1. Add a shared async helper in `util/task.ts` for listing `.code-task.md` files.
2. Refactor utility and command call sites to use the shared async helper.
3. Keep existing try/catch behavior for missing directories and unreadable files.
4. Ensure discovered files are sorted consistently if async iteration order is not guaranteed.
5. Add or adjust tests around task discovery and command behavior expectations.

## Acceptance Criteria

1. **No `scanSync` in runtime task paths**
   - Given task-related command and utility code
   - When searching for file discovery implementation
   - Then runtime paths no longer use synchronous glob scanning

2. **Command behavior remains unchanged**
   - Given existing task directories and files
   - When running `ody task list`, `ody task edit`, and `ody compact`
   - Then output and behavior match current functional expectations

3. **Missing directory handling is preserved**
   - Given the tasks directory does not exist
   - When affected commands run
   - Then they return gracefully with existing warning/error patterns

4. **Ordering is deterministic**
   - Given a stable set of task files
   - When async scanning is used
   - Then commands return file lists in deterministic order

5. **Tests validate async scan behavior**
   - Given updated tests for task discovery utilities and/or command-adjacent logic
   - When test suite runs
   - Then tests pass and cover async scanning semantics

## Metadata
- **Complexity**: Low
- **Labels**: performance, tasks, io, event-loop
