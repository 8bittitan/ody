---
status: completed
created: 2026-02-11
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add Edit Subcommand to Plan Command

## Description
Add an `edit` subcommand to the existing `plan` command that allows users to select and edit existing plan files. The edit command should prompt the user to choose a plan file from `.ody/tasks/`, then open the CLI harness in interactive mode specifically for editing that file, with the harness forced into `build` mode.

## Background
The Ody CLI currently has a `plan` command that generates new task plan files. However, there is no built-in way to edit existing plan files using the agent. Users must manually edit `.code-task.md` files or regenerate them entirely. An `edit` subcommand would allow users to leverage the agent to modify existing plans, making it easier to refine and update task specifications without losing the structured format.

The plan command currently uses `citty`'s `defineCommand` and exists as a standalone command. To support subcommands, the plan command needs to be restructured as a parent command with `create` (existing functionality) and `edit` (new functionality) as subcommands.

## Technical Requirements
1. Restructure `packages/cli/src/cmd/plan.ts` to support subcommands using `citty`'s `subCommands` pattern
2. Move existing plan creation logic to a `create` subcommand (or keep as default)
3. Create a new `edit` subcommand that:
   - Discovers all `.code-task.md` files in `.ody/tasks/`
   - Prompts the user to select which plan file to edit
   - Opens the selected file in the CLI harness in interactive mode
   - Forces the harness to use `build` agent mode
4. The `edit` subcommand must pass the file content and a context prompt to the harness
5. The harness should be invoked using `backend.buildCommand()` which already sets `agent: 'build'`
6. Support standard flags like `--verbose` and `--dry-run` in subcommands

## Dependencies
- `packages/cli/src/cmd/plan.ts` — Main plan command file that needs restructuring (currently a leaf command with no subcommands)
- `packages/cli/src/backends/backend.ts` — `Backend` class with `buildCommand()` method (sets `agent: 'build'`)
- `packages/cli/src/lib/config.ts` — `Config` namespace for backend selection and `tasksDir` resolution. Note: `Config.load()` is already called in the root command's `setup()` hook in `index.ts`, so subcommands do not need to call it.
- `packages/cli/src/util/constants.ts` — `BASE_DIR` and `TASKS_DIR` constants for fallback path resolution
- `@clack/prompts` — For interactive prompts (file selection via `select`, confirmations)
- `citty` — CLI framework for subcommand support
- `fs/promises` — For `readdir` to list task files
- `Bun.file()` — For reading task file contents (preferred over `fs/promises` per project conventions)
- `packages/cli/src/util/stream.ts` — `Stream` utility for handling harness output

## Implementation Approach
1. **Analyze current plan command structure** — `planCmd` in `packages/cli/src/cmd/plan.ts` is currently a leaf command (no subcommands). It uses `defineCommand` with `args` for `dry-run` and `verbose`, and the `run` function contains all plan creation logic. Note: the `list` and `compact` tasks also require this restructuring, so whichever is implemented first must do the conversion.
2. **Restructure as parent command** — Convert `planCmd` to a parent command that defines `subCommands` with `create` and `edit` entries. The existing plan creation logic should remain accessible as the default behavior when `ody plan` is run without a subcommand.
3. **Create create subcommand** — Move the existing plan generation logic into a `create` subcommand (or configure it as the default)
4. **Implement edit subcommand**:
   - Resolve the tasks directory using `Config.get('tasksDir') ?? TASKS_DIR` joined with `BASE_DIR` via `path.join()`
   - Use `readdir` from `fs/promises` to find all `*.code-task.md` files in the resolved tasks directory
   - Use `select` from `@clack/prompts` to let the user pick a file
   - Read the selected file content using `Bun.file().text()`
   - Construct an edit prompt that instructs the agent to modify the file
   - Spawn the harness using `backend.buildCommand(editPrompt)` with piped stdio
   - Stream output using `Stream.toOutput()` and handle completion marker `<woof>COMPLETE</woof>`
5. **Update index.ts** — The restructured plan command should still export `planCmd` so no changes to `index.ts` registration are needed
6. **Test both subcommands** — Verify `ody plan` (default create flow) and `ody plan edit` work correctly

## Acceptance Criteria

1. **Create subcommand works**
   - Given the user runs `ody plan`
   - When they enter a task description and confirm
   - Then a new `.code-task.md` file is generated in `.ody/tasks/`

2. **Edit subcommand lists files**
   - Given there are existing `.code-task.md` files in `.ody/tasks/`
   - When the user runs `ody plan edit`
   - Then they are presented with a list of available plan files to select from

3. **Edit subcommand opens harness**
   - Given the user has selected a plan file to edit
   - When the edit subcommand runs
   - Then the CLI harness opens in interactive mode with `agent: 'build'`

4. **Edit subcommand passes file content**
   - Given the user is editing an existing plan file
   - When the harness spawns
   - Then the file content and edit instructions are passed as the prompt

5. **Edit subcommand respects flags**
   - Given the user runs `ody plan edit --verbose`
   - When the harness is running
   - Then verbose output is streamed to the console

6. **Build succeeds**
   - Given all changes are applied
   - When `bun run build` is executed from the root
   - Then the build completes without errors

7. **Help displays subcommands**
   - Given the user runs `ody plan --help`
   - When the help output displays
   - Then both `create` and `edit` subcommands are listed with descriptions

## Metadata
- **Complexity**: Medium
- **Labels**: cli, plan, subcommand, edit, harness
