---
status: completed
created: +2026-02-14
started: 2026-02-14
completed: 2026-02-14
---
# Task: Rename Plan Subcommands to Task and Promote Plan New to Root Plan

## Description
Restructure the CLI command hierarchy so that `plan list`, `plan edit`, and `plan compact` become `task list`, `task edit`, and `task compact`, while `plan new` is promoted to be the root `plan` command (i.e., `ody plan` with no subcommand). This better reflects the semantic distinction: "plan" is the act of creating a task plan, while "task" operations (listing, editing, compacting) manage existing task files.

## Background
Currently all task-file operations live under `ody plan <subcommand>`. The naming is slightly misleading — `plan list`, `plan edit`, and `plan compact` operate on existing task files rather than creating plans. Moving these to `ody task` makes the CLI more intuitive: `ody plan` creates a plan, `ody task *` manages tasks. The argument parsing is centralized in `main.zig` using zig-clap with terminating positionals for hierarchical subcommand routing. The `cmd/plan/` modules define `*Args` structs and `run()` functions but do not handle their own CLI parsing.

## Technical Requirements
1. Add `task` to the top-level `Command` enum in `main.zig` alongside `init`, `config`, `run`, `plan`.
2. Create a new `TaskSubcommand` enum with variants `list`, `edit`, and `compact`.
3. Implement `runTask()` and its subcommand routers (`runTaskList`, `runTaskEdit`, `runTaskCompact`) in `main.zig`, reusing the existing `cmd/plan/list.zig`, `cmd/plan/edit.zig`, and `cmd/plan/compact.zig` modules.
4. Change `plan` from a subcommand-based command to a leaf command that directly runs the plan-new logic (currently in `cmd/plan/new.zig`).
5. Remove the `PlanSubcommand` enum and `runPlan*` routing functions that are no longer needed.
6. Update help text, descriptions, and any user-facing strings to reflect the new command names.
7. Optionally reorganize `cmd/plan/` directory — move `list.zig`, `edit.zig`, and `compact.zig` into a new `cmd/task/` directory, keeping `new.zig` as `cmd/plan.zig` or `cmd/plan/new.zig`.

## Dependencies
- `cli/src/main.zig` — central command routing and clap parameter definitions
- `cli/src/cmd/plan/list.zig` — list module (moves to task subcommand)
- `cli/src/cmd/plan/edit.zig` — edit module (moves to task subcommand)
- `cli/src/cmd/plan/compact.zig` — compact module (moves to task subcommand)
- `cli/src/cmd/plan/new.zig` — new module (becomes the root `plan` command)
- `zig-clap` argument parsing patterns (terminating positionals for subcommand routing)

## Implementation Approach
1. **Add `task` to the `Command` enum** in `main.zig` (line ~29) so the top-level parser recognizes `ody task`.
2. **Define `TaskSubcommand` enum** with `list`, `edit`, `compact` variants and corresponding clap params (`task_params`, `task_parsers`) mirroring the current `plan_params`/`plan_parsers` pattern.
3. **Create `runTask()` dispatcher** in `main.zig` that parses the task subcommand and delegates to `runTaskList()`, `runTaskEdit()`, or `runTaskCompact()`.
4. **Implement `runTaskList`, `runTaskEdit`, `runTaskCompact`** by copying the argument parsing logic from the current `runPlanList`, `runPlanEdit`, `runPlanCompact` but calling the same underlying `cmd/plan/*.run()` functions (or the relocated `cmd/task/*.run()` functions).
5. **Convert `plan` to a leaf command**: Replace the `runPlan()` subcommand dispatcher with a `runPlan()` that directly parses `--dry-run`/`--verbose` flags and calls `plan_new_cmd.run()`. This means `ody plan` behaves exactly like the old `ody plan new`.
6. **Move source files**: Rename/move `cli/src/cmd/plan/list.zig`, `edit.zig`, and `compact.zig` into `cli/src/cmd/task/` directory. Keep `new.zig` accessible for the `plan` command (either as `cmd/plan.zig` or retain `cmd/plan/new.zig`).
7. **Update module re-exports** in `main.zig`: Add new `pub const` imports for any moved modules and update the `comptime` test discovery block.
8. **Update help text and descriptions** in clap parameter definitions to reflect the new `task` and `plan` semantics.
9. **Run `zig build test`** to verify all tests pass after the restructure.
10. **Run `zig fmt --check src/`** to ensure formatting compliance.

## Acceptance Criteria

1. **Task List Command Works**
   - Given the CLI is built successfully
   - When the user runs `ody task list`
   - Then pending task files are listed (same behavior as old `ody plan list`)

2. **Task Edit Command Works**
   - Given there are pending task files in `.ody/tasks/`
   - When the user runs `ody task edit`
   - Then the interactive task selection and AI-driven edit flow executes (same as old `ody plan edit`)

3. **Task Compact Command Works**
   - Given there are completed task files in `.ody/tasks/`
   - When the user runs `ody task compact`
   - Then completed tasks are archived and deleted (same as old `ody plan compact`)

4. **Root Plan Command Creates a Plan**
   - Given the CLI is built successfully
   - When the user runs `ody plan`
   - Then the interactive plan creation flow executes (same as old `ody plan new`)

5. **Old Plan Subcommands Are Removed**
   - Given the CLI is built successfully
   - When the user runs `ody plan list`, `ody plan edit`, `ody plan new`, or `ody plan compact`
   - Then an error or help message is shown (these subcommands no longer exist under `plan`)

6. **Build and Tests Pass**
   - Given all code changes are applied
   - When `zig build` and `zig build test` are run from `cli/`
   - Then both complete without errors

7. **Formatting Is Clean**
   - Given all code changes are applied
   - When `zig fmt --check src/` is run from `cli/`
   - Then no formatting issues are reported

## Metadata
- **Complexity**: Medium
- **Labels**: cli, refactor, commands
