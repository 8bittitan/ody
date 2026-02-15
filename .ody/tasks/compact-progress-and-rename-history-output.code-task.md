---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Compact Progress File and Rename History Output Files

## Description
Extend the `compact` command to also archive the `.ody/progress.txt` file alongside completed tasks. Change the output file naming from `archive-{DATE}.md` to two separate files: `.ody/history/{DATE}/tasks.md` for the archived tasks and `.ody/history/{DATE}/progress.md` for the archived progress log. After archiving, the original `progress.txt` should be cleared or removed.

## Background
The `compact` command currently only archives completed `.code-task.md` files into a single `archive-{DATE}.md` file under `.ody/history/`. The `.ody/progress.txt` file accumulates progress notes over time from agent runs but is never cleaned up. This means progress context grows unbounded and stale entries persist indefinitely. By compacting both tasks and progress together, the command provides a complete historical snapshot for a given date and keeps the working directory clean for fresh work.

The current output path is `.ody/history/archive-YYYY-MM-DD.md`. The new structure uses a date-stamped subdirectory containing two distinct files, which better organizes the archive and separates concerns between task summaries and progress logs.

## Technical Requirements
1. The `compact` command must read `.ody/progress.txt`, archive its contents to `.ody/history/{DATE}/progress.md`, and then clear or remove the original file
2. The task archive output must change from `.ody/history/archive-{DATE}.md` to `.ody/history/{DATE}/tasks.md`
3. The history directory structure must use date-stamped subdirectories (e.g., `.ody/history/2026-02-15/`) instead of date-stamped filenames
4. If `progress.txt` is empty or does not exist, the command should still archive tasks (and skip progress archiving gracefully)
5. If there are no completed tasks but `progress.txt` has content, the command should still archive progress (and skip task archiving gracefully)
6. If neither completed tasks nor progress content exist, the command should exit early with an informational message
7. Running compact twice on the same day should handle the existing date directory gracefully (overwrite or append — overwrite matches current behavior)

## Dependencies
- `packages/cli/src/cmd/task/compact.ts` — the compact command implementation that must be modified
- `packages/cli/src/util/constants.ts` — defines `BASE_DIR` (`.ody`), may need a `PROGRESS_FILE` constant if not already present
- `packages/cli/src/builders/runPrompt.ts` — references `.ody/progress.txt` as `{PROGRESS_FILE}` in prompt templates; should be checked for consistency but likely does not need changes
- `packages/cli/src/util/task.ts` — provides `resolveTasksDir()`, `parseFrontmatter()`, `parseTitle()`, `parseDescription()` used by compact
- `packages/cli/src/types/task.ts` — defines `CompletedTask` type used by compact
- `node:fs/promises` — for `mkdir`, `rm`, and potentially `readFile`/`writeFile` or checking file existence
- `Bun.file()` and `Bun.write()` — for reading and writing files per project conventions

## Implementation Approach
1. **Update the history directory structure**: Change `historyDir` from `.ody/history/` to `.ody/history/{DATE}/` using the existing `dateStamp` variable. Use `mkdir` with `{ recursive: true }` to create the nested date directory
2. **Rename the task archive output**: Change the archive filename from `archive-${dateStamp}.md` to `tasks.md` and write it inside the new date-stamped directory (`.ody/history/{DATE}/tasks.md`)
3. **Add progress file reading**: Before the early return checks, read `.ody/progress.txt` using `Bun.file()`. Handle the case where the file does not exist or is empty gracefully (wrap in try/catch or check existence first)
4. **Generate the progress archive**: Format the progress content into a markdown file with a header (similar to the task archive), including the generation timestamp. Write it to `.ody/history/{DATE}/progress.md`
5. **Clear the progress file after archiving**: After successfully writing the progress archive, either delete `.ody/progress.txt` with `rm()` or truncate it by writing an empty string
6. **Update early-exit logic**: Adjust the early return conditions so the command proceeds if either completed tasks or progress content exist. Only exit early if both are absent
7. **Update the log output**: Adjust the `log.info` summary message to reflect both tasks and progress archiving, and update the output paths shown to the user

## Acceptance Criteria

1. **Tasks archived to new path**
   - Given there are completed task files in `.ody/tasks/`
   - When the `compact` command is run
   - Then completed tasks are archived to `.ody/history/{DATE}/tasks.md` and the original task files are deleted

2. **Progress archived to new path**
   - Given `.ody/progress.txt` contains progress entries
   - When the `compact` command is run
   - Then progress content is archived to `.ody/history/{DATE}/progress.md` and the original `progress.txt` is cleared or removed

3. **Both tasks and progress archived together**
   - Given there are completed tasks and progress entries
   - When the `compact` command is run
   - Then both `.ody/history/{DATE}/tasks.md` and `.ody/history/{DATE}/progress.md` are created in the same date directory

4. **Only progress exists**
   - Given there are no completed tasks but `.ody/progress.txt` has content
   - When the `compact` command is run
   - Then only `.ody/history/{DATE}/progress.md` is created and the command completes successfully

5. **Only tasks exist**
   - Given there are completed tasks but `.ody/progress.txt` is empty or missing
   - When the `compact` command is run
   - Then only `.ody/history/{DATE}/tasks.md` is created and the command completes successfully

6. **Nothing to compact**
   - Given there are no completed tasks and `.ody/progress.txt` is empty or missing
   - When the `compact` command is run
   - Then the command exits with an informational message and no files are created

7. **Date directory created correctly**
   - Given the `.ody/history/` directory may or may not exist
   - When the `compact` command is run with archivable content
   - Then a `.ody/history/{YYYY-MM-DD}/` subdirectory is created containing the output files

## Metadata
- **Complexity**: Low
- **Labels**: cli, compact, progress, history, refactor
