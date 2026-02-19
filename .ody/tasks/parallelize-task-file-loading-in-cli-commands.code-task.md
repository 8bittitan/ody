---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Parallelize Task File Loading in CLI Commands

## Description
Improve command latency for task-heavy projects by parallelizing task file reads in list, edit, and status-related paths while keeping resource usage bounded.

## Background
Task-oriented commands currently read task files sequentially with `await` in loops across `packages/cli/src/util/task.ts`, `packages/cli/src/cmd/task/list.ts`, and `packages/cli/src/cmd/task/edit.ts`. As task counts grow, this creates avoidable wall-clock delays and sluggish UX. Controlled concurrency can significantly reduce latency while avoiding excessive file descriptor pressure.

## Technical Requirements
1. Replace sequential task file reads with bounded-concurrency parallel reads in high-traffic paths.
2. Apply the change to `getTaskFilesByLabel`, `getTaskStates`, task list rendering, and task edit option generation.
3. Use a deterministic and safe concurrency limit (for example 8-16 workers) rather than unbounded `Promise.all`.
4. Preserve current error tolerance behavior (warn and continue on individual read failures where currently applicable).
5. Preserve output order stability where order matters for display and selection.
6. Keep command behavior and filtering logic unchanged except for speed improvements.
7. Add or update tests for affected utility behavior in `packages/cli/src/util/__tests__`.

## Dependencies
- `packages/cli/src/util/task.ts` -- shared task file discovery and status utilities.
- `packages/cli/src/cmd/task/list.ts` -- pending task listing path.
- `packages/cli/src/cmd/task/edit.ts` -- task selection option construction.
- `packages/cli/src/cmd/run.ts` -- consumes `getTaskStates`; performance impact in loop completion checks.
- `packages/cli/src/util/__tests__/*` -- test coverage for task utility behavior.

## Implementation Approach
1. Introduce a small internal concurrency helper for async mapping with fixed parallelism.
2. Refactor `getTaskFilesByLabel` to read candidate files concurrently and aggregate matched labels.
3. Refactor `getTaskStates` to resolve file statuses concurrently with stable ordering.
4. Refactor `task list` and `task edit` commands to load title/frontmatter data concurrently.
5. Maintain existing warning/error messages and return shapes.
6. Add test coverage for correctness with mixed success/failure reads and ordering guarantees.

## Acceptance Criteria

1. **Task reads are concurrency-bounded**
   - Given commands process many task files
   - When reading task contents
   - Then reads execute in parallel with a fixed upper concurrency limit

2. **Behavioral parity is maintained**
   - Given existing task files and statuses
   - When running list/edit/label/status flows
   - Then results match prior logic (same filtering and semantics)

3. **Order is stable for user-facing output**
   - Given deterministic input file ordering
   - When command output or option lists are generated
   - Then item order remains deterministic and consistent

4. **Partial failures do not break commands**
   - Given one or more task files fail to read
   - When commands execute
   - Then commands continue and emit warnings where previously expected

5. **Utility tests validate concurrency refactor**
   - Given updated task utility tests
   - When relevant test files are run with Bun
   - Then tests pass and verify correctness under concurrent reads

## Metadata
- **Complexity**: Medium
- **Labels**: performance, tasks, io, cli
