---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Filter Task Edit Command to Only Show Pending Tasks

## Description
The `task edit` command currently displays all code task files as select options regardless of their frontmatter status. It should only present tasks with `status: pending` so users are not offered completed, in-progress, or other non-pending tasks for editing. This aligns the edit command's behavior with the existing `task list` command which already filters to pending tasks only.

## Background
The CLI has a `task edit` subcommand (`packages/cli/src/cmd/task/edit.ts`) that lets users select a task file to edit via an interactive `@clack/prompts` select prompt. Currently, the command reads all `*.code-task.md` files from the tasks directory and builds select options from every file it finds, using only `parseTitle()` to extract the display label. It does not inspect the frontmatter `status` field at all.

By contrast, the `task list` command (`packages/cli/src/cmd/task/list.ts`) already demonstrates the correct pattern: it calls `parseFrontmatter()` on each file's content and filters out any task where `frontmatter.status !== 'pending'`. The edit command should adopt the same filtering approach.

## Technical Requirements
1. Import `parseFrontmatter` from `../../util/task` in the edit command module
2. Within the `mapWithConcurrency` callback that builds select options, call `parseFrontmatter(content)` on each file's content and return `null` for any task whose status is not `'pending'`
3. Filter the resulting options array to remove `null` entries before passing to the `select()` prompt
4. Display an appropriate message (e.g., "No pending tasks to edit.") and return early if no pending tasks remain after filtering
5. Preserve all existing behavior for pending tasks (label format, select prompt, dry-run, backend invocation)

## Dependencies
- `parseFrontmatter` utility from `packages/cli/src/util/task.ts` (already exists, just needs to be imported)
- `@clack/prompts` `select`, `log`, `outro`, `isCancel` (already imported)
- No new packages or modules required

## Implementation Approach
1. **Add `parseFrontmatter` to the import statement** in `packages/cli/src/cmd/task/edit.ts` — add it to the existing destructured import from `../../util/task` on lines 9-14
2. **Update the `mapWithConcurrency` callback** (lines 46-50) to parse the frontmatter from each file's content and return `null` when `frontmatter.status !== 'pending'`, mirroring the pattern used in `list.ts` lines 39-49
3. **Filter out null entries** from the options array after the `mapWithConcurrency` call, using a type-narrowing filter similar to `list.ts` lines 52-54
4. **Add an early return with a user-friendly message** if the filtered options array is empty, logging "No pending tasks to edit." via `log.info()` before returning — place this check between the filter and the `select()` call
5. **Verify** that the existing select prompt, cancellation handling, file reading, prompt building, and backend invocation remain unchanged for pending tasks

## Acceptance Criteria

1. **Only pending tasks appear in the select list**
   - Given the tasks directory contains tasks with mixed statuses (pending, in_progress, completed)
   - When the user runs `ody task edit`
   - Then only tasks with `status: pending` in their frontmatter are shown as select options

2. **Graceful handling when no pending tasks exist**
   - Given all tasks in the directory have non-pending statuses
   - When the user runs `ody task edit`
   - Then the user sees an informational message "No pending tasks to edit." and the command exits cleanly without showing a select prompt

3. **Empty tasks directory still handled**
   - Given the tasks directory contains no `*.code-task.md` files
   - When the user runs `ody task edit`
   - Then the existing "No task files found." message is displayed (unchanged behavior)

4. **Editing flow unchanged for pending tasks**
   - Given a pending task is selected from the filtered list
   - When the user confirms the selection
   - Then the task file is read, the edit prompt is built, and the backend agent is invoked exactly as before

5. **Dry-run mode unchanged**
   - Given the `--dry-run` flag is passed
   - When a pending task is selected
   - Then the edit prompt is logged and no backend agent is invoked (existing behavior preserved)

## Metadata
- **Complexity**: Low
- **Labels**: cli, task-command, filtering
