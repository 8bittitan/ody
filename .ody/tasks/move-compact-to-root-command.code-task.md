---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Move `task compact` Subcommand to Root-Level `ody compact`

## Description
Promote the `compact` subcommand from `ody task compact` to a root-level CLI command `ody compact`. This simplifies the user experience by making task compaction a first-class command rather than burying it under the `task` namespace, reflecting how frequently it is used as a standalone operation.

## Background
The `compact` command archives completed `.code-task.md` files from `.ody/tasks/` into a dated markdown file under `.ody/history/` and deletes the originals. It currently lives as a subcommand of the `task` parent command at `packages/cli/src/cmd/task/compact.ts`, registered via the `task` grouping command at `packages/cli/src/cmd/task/index.ts`. Root-level commands are registered in the main CLI definition at `packages/cli/src/index.ts` using lazy dynamic imports in the `subCommands` object. This refactor follows the same pattern used by existing root commands (`config`, `init`, `plan`, `run`).

## Technical Requirements
1. The `compact` command must be accessible as `ody compact` (root-level)
2. The command implementation, behavior, and all imports must remain identical to the current `task compact` subcommand
3. The `compact` subcommand must be removed from the `task` parent command's `subCommands` registration
4. The old `compact.ts` file under `packages/cli/src/cmd/task/` must be relocated to `packages/cli/src/cmd/compact.ts`
5. The root CLI definition in `packages/cli/src/index.ts` must register the new `compact` command via a lazy dynamic import
6. If the `task` parent command still has remaining subcommands (`edit`, `list`), it should remain; otherwise remove it entirely

## Dependencies
- `packages/cli/src/index.ts` — root CLI definition where the new command must be registered (lines 15-21)
- `packages/cli/src/cmd/task/index.ts` — task parent command where `compact` must be deregistered (lines 8-12)
- `packages/cli/src/cmd/task/compact.ts` — current compact command implementation (lines 1-87)
- `packages/cli/src/types/task.ts` — `CompletedTask` type used by the command
- `packages/cli/src/util/task.ts` — utility functions (`resolveTasksDir`, `parseFrontmatter`, `parseTitle`, `parseDescription`)
- `packages/cli/src/util/constants.ts` — `BASE_DIR` constant

## Implementation Approach
1. **Move the command file**: Relocate `packages/cli/src/cmd/task/compact.ts` to `packages/cli/src/cmd/compact.ts`. Update all relative import paths within the file to account for the new directory depth (e.g., `../../types/task` becomes `../types/task`, `../../util/constants` becomes `../util/constants`, `../../util/task` becomes `../util/task`).
2. **Update the command metadata**: In the moved file, update the `meta.name` from `'compact'` to `'compact'` (no change needed since the name stays the same) and optionally update the `meta.description` to reflect that it is now a standalone command (e.g., `'Archive completed tasks and remove originals'`).
3. **Register at root level**: In `packages/cli/src/index.ts`, add a `compact` entry to the `subCommands` object: `compact: () => import('./cmd/compact').then((m) => m.compactCmd)`.
4. **Deregister from task parent**: In `packages/cli/src/cmd/task/index.ts`, remove the `compact` line from its `subCommands` object, leaving only `edit` and `list`.
5. **Delete the old file**: Remove `packages/cli/src/cmd/task/compact.ts` since the implementation now lives at `packages/cli/src/cmd/compact.ts`.
6. **Validate**: Run `bun run build` from the project root to confirm the build succeeds with no errors.

## Acceptance Criteria

1. **Root-level invocation works**
   - Given the CLI is built and installed
   - When the user runs `ody compact`
   - Then completed tasks are archived to `.ody/history/archive-YYYY-MM-DD.md` and originals are deleted, identical to the previous `ody task compact` behavior

2. **Old subcommand path is removed**
   - Given the CLI is built and installed
   - When the user runs `ody task compact`
   - Then the command is not recognized and an appropriate error or help message is shown

3. **Remaining task subcommands unaffected**
   - Given the CLI is built and installed
   - When the user runs `ody task list` or `ody task edit`
   - Then those subcommands work exactly as before

4. **Build succeeds cleanly**
   - Given the code changes are complete
   - When `bun run build` is executed from the project root
   - Then the build completes without errors

5. **Import paths are correct**
   - Given the compact command file is at `packages/cli/src/cmd/compact.ts`
   - When the file is loaded at runtime
   - Then all imports (`CompletedTask`, `BASE_DIR`, `resolveTasksDir`, `parseFrontmatter`, `parseTitle`, `parseDescription`) resolve correctly

## Metadata
- **Complexity**: Low
- **Labels**: cli, refactor, commands
