---
status: completed
created: 2026-02-11
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add Compact Subcommand to Plan Command

## Description
Add a `compact` subcommand to the `plan` command that condenses all completed tasks into a single markdown file for historical record-keeping. This will help users archive finished work while preserving essential information (task name, condensed description, and completion timestamp) without cluttering the active tasks directory.

## Background
The Ody CLI stores task files in `.ody/tasks/` with the extension `.code-task.md`. Each task file contains YAML frontmatter with metadata including `status`, `created`, `started`, and `completed` timestamps. Over time, completed tasks accumulate in the tasks directory, making it harder to navigate. A `compact` subcommand will allow users to archive completed tasks into a single historical record file, reducing clutter while maintaining a searchable history of completed work.

## Technical Requirements
1. Create a `compact` subcommand using `citty`'s subCommands feature within the `plan` command
2. The subcommand must read all `.code-task.md` files from `.ody/tasks/`
3. Parse the YAML frontmatter of each file to extract `status` and `completed` fields
4. Filter and process only tasks where `status` is `completed` and `completed` timestamp exists
5. Extract the task name (from the `# Task:` heading) and description (from the `## Description` section)
6. Condense the description into a brief summary (2-3 sentences max)
7. Generate a single markdown archive file with all completed tasks
8. Remove or mark the original task files after successful compaction (configurable behavior)
9. Handle edge cases: no completed tasks, missing frontmatter, or empty tasks directory

## Dependencies
- `packages/cli/src/util/constants.ts` — Contains `BASE_DIR` and `TASKS_DIR` constants
- `packages/cli/src/lib/config.ts` — `Config` namespace; use `Config.get('tasksDir')` to resolve the tasks directory (falls back to `TASKS_DIR` constant)
- `packages/cli/src/cmd/plan.ts` — Plan command that needs to be restructured to support subcommands (currently a leaf command with no subcommands). Note: the `list` and `edit` tasks also require this restructuring, so whichever is implemented first must do the conversion.
- `Bun.file()` — For reading task file contents (preferred over `fs/promises` per project conventions)
- `fs/promises` — For `readdir` and `mkdir` operations
- `path` — For path manipulation
- `@clack/prompts` — For user-friendly output and confirmations (use `log.info`, `confirm`, `outro`, etc.)
- A lightweight regex-based YAML frontmatter parser (do NOT add `gray-matter` or other external dependencies)
- Date formatting utility (native `Date` or `Intl.DateTimeFormat`)

## Implementation Approach
1. **Restructure plan.ts for subcommands** — The current `planCmd` in `packages/cli/src/cmd/plan.ts` is a leaf command. It must be converted to a parent command using `citty`'s `subCommands` pattern, with the existing plan creation logic preserved as the default behavior (or a `create` subcommand). Note: the `list` and `edit` tasks also require this same restructuring, so coordinate accordingly.
2. **Create the compact subcommand** — Create a `compactCmd` using `defineCommand` with appropriate meta (name: 'compact', description: 'Archive completed tasks into a historical record')
3. **Add to plan.ts subCommands** — Import and register the compact subcommand in the `subCommands` object of `plan.ts`
4. **Resolve the tasks directory** — Use `Config.get('tasksDir') ?? TASKS_DIR` joined with `BASE_DIR` via `path.join()` to resolve the tasks directory path (respecting the configurable `tasksDir` setting).
5. **Implement task scanning** — In the `run` function:
   - Read the resolved tasks directory using `fs/promises.readdir`
   - Filter for files ending in `.code-task.md`
   - If no files exist, display a message and exit
6. **Parse and filter completed tasks** — For each task file:
   - Read the file content using `Bun.file().text()`
   - Parse the YAML frontmatter using regex to extract `status`, `completed` timestamp
   - Filter to only include tasks with `status: completed` and a valid `completed` date
   - Extract the task title from the `# Task:` heading
   - Extract and condense the description from `## Description` section (first 2-3 sentences)
7. **Sort by completion date** — Sort the completed tasks by their `completed` timestamp (ascending or descending)
8. **Generate archive content** — Create a markdown file with:
   - A header section with generation timestamp
   - Each task entry formatted with: task name, condensed description, completed date
   - Clear visual separation between entries
9. **Write archive file** — Save the archive to `.ody/history/archive-{timestamp}.md` using `Bun.write()`
10. **Handle original files** — After successful archive creation:
    - Delete the original task files after the compaction is completed
11. **Display results** — Show summary: number of tasks archived, archive file location, disk space saved
12. **Test the command** — Run `ody plan compact` to verify completed tasks are properly archived

## Acceptance Criteria

1. **Archive completed tasks**
   - Given there are task files in `.ody/tasks/` with `status: completed` and valid `completed` timestamps
   - When the user runs `ody plan compact`
   - Then a markdown archive file is created containing each completed task's name, condensed description, and completion timestamp

2. **Condense descriptions**
   - Given a completed task with a detailed description section
   - When the archive is generated
   - Then the description is condensed to 2-3 sentences capturing the essential information

3. **Sort by completion date**
   - Given multiple completed tasks with different completion dates
   - When the archive is generated
   - Then tasks are sorted chronologically by their `completed` timestamp

4. **Handle no completed tasks**
   - Given no task files have `status: completed`
   - When the user runs `ody plan compact`
   - Then the command displays a message indicating there are no completed tasks to archive

5. **Handle empty tasks directory**
   - Given the `.ody/tasks/` directory does not exist or is empty
   - When the user runs `ody plan compact`
   - Then the command displays a helpful message indicating no tasks were found

6. **Archive file naming**
   - Given the command successfully archives completed tasks
   - When the archive file is created
   - Then the filename includes a timestamp (e.g., `archive-2026-02-11.md`) to prevent overwriting previous archives

7. **Subcommand is registered**
   - Given the CLI is built and available
   - When the user runs `ody plan --help`
   - Then the `compact` subcommand appears in the list of available subcommands

8. **Default plan behavior preserved**
   - Given the refactored plan command with subcommands
   - When the user runs `ody plan` (without subcommand)
   - Then the original plan creation flow still works as expected

9. **Build succeeds**
   - Given the changes are applied
   - When `bun run build` is executed from the root
   - Then the build completes without errors

## Metadata
- **Complexity**: Medium
- **Labels**: cli, plan, subcommand, archive, task-management
