---
status: completed
created: 2026-02-11
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add List Subcommand to Plan Command

## Description
Add a `list` subcommand to the `plan` command that displays all tasks with `status: pending` from the `.ody/tasks` directory. This will help users quickly see what work remains to be done without manually inspecting each task file.

## Background
The Ody CLI stores task files in `.ody/tasks/` with the extension `.code-task.md`. Each task file contains YAML frontmatter with metadata including a `status` field that can be `pending`, `in_progress`, or `completed`. Currently, users must manually browse these files to see what tasks are remaining. A `list` subcommand will provide a convenient way to view pending work at a glance.

## Technical Requirements
1. Create a subcommand structure for the `plan` command using `citty`'s subCommands feature
2. The `list` subcommand must read all `.code-task.md` files from `.ody/tasks/`
3. Parse the YAML frontmatter of each file to extract the `status` field
4. Filter and display only tasks where `status` is `pending`
5. Display task titles and filenames in a user-friendly format
6. Handle the case when no tasks exist or no pending tasks remain

## Dependencies
- `packages/cli/src/util/constants.ts` — Contains `BASE_DIR` and `TASKS_DIR` constants
- `packages/cli/src/lib/config.ts` — `Config` namespace; use `Config.get('tasksDir')` to resolve the tasks directory (falls back to `TASKS_DIR` constant). Note: `Config.load()` is already called in the root command's `setup()` hook in `index.ts`.
- `packages/cli/src/cmd/plan.ts` — Current plan command that needs to be restructured to support subcommands (currently a leaf command with no subcommands). Note: the `edit` and `compact` tasks also require this restructuring, so whichever is implemented first must do the conversion.
- `fs/promises` — For `readdir` to list task files
- `Bun.file()` — For reading task file contents (preferred over `fs/promises` per project conventions)
- `@clack/prompts` — For user-friendly output formatting (use `log.info`, `outro`, etc.)
- A lightweight regex-based YAML frontmatter parser (do NOT add `gray-matter` or other external dependencies)

## Implementation Approach
1. **Restructure plan.ts for subcommands** — The current `planCmd` in `packages/cli/src/cmd/plan.ts` is a leaf command. It must be converted to a parent command using `citty`'s `subCommands` pattern, with the existing plan creation logic preserved as the default behavior. Note: the `edit` and `compact` tasks also require this same restructuring, so coordinate accordingly.
2. **Create the list subcommand** — Create a `listCmd` using `defineCommand` with appropriate meta (name: 'list', description: 'List pending tasks')
3. **Resolve the tasks directory** — Use `Config.get('tasksDir') ?? TASKS_DIR` joined with `BASE_DIR` via `path.join()` to resolve the tasks directory path (respecting the configurable `tasksDir` setting).
4. **Implement task scanning** — In the `run` function:
   - Read the resolved tasks directory using `fs/promises.readdir`
   - Filter for files ending in `.code-task.md`
   - If no files exist, display a message indicating no tasks were found
5. **Parse task files** — For each task file:
   - Read the file content using `Bun.file().text()`
   - Parse the YAML frontmatter using regex to extract `status` and the task title (from the `# Task:` heading)
   - Filter to only include tasks with `status: pending`
6. **Display results** — Format and display the pending tasks:
   - Show the task title and filename
   - Use `log.info()` or a table format for readability
   - If no pending tasks, display a completion message
7. **Test the command** — Run `ody plan list` to verify it displays pending tasks correctly

## Acceptance Criteria

1. **List pending tasks**
   - Given there are task files in `.ody/tasks/` with `status: pending`
   - When the user runs `ody plan list`
   - Then the command outputs a list of pending tasks showing their titles

2. **Handle no tasks directory**
   - Given the `.ody/tasks/` directory does not exist
   - When the user runs `ody plan list`
   - Then the command displays a helpful message indicating no tasks were found

3. **Handle no pending tasks**
   - Given all task files have `status: completed`
   - When the user runs `ody plan list`
   - Then the command displays a message indicating there are no pending tasks

4. **Subcommand is registered**
   - Given the CLI is built and available
   - When the user runs `ody plan --help`
   - Then the `list` subcommand appears in the list of available subcommands

5. **Default plan behavior preserved**
   - Given the refactored plan command with subcommands
   - When the user runs `ody plan` (without subcommand)
   - Then the original plan creation flow still works as expected

6. **Build succeeds**
   - Given the changes are applied
   - When `bun run build` is executed from the root
   - Then the build completes without errors

## Metadata
- **Complexity**: Medium
- **Labels**: cli, plan, subcommand, task-management
