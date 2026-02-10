---
status: completed
created: 2026-02-10
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add Label Filter Flag to Run Command

## Description
Add a `--label` (`-l` alias) flag to the `run` CLI command that filters which `.code-task.md` files the agent processes based on their `Labels` metadata field. When provided, only tasks whose labels include the specified value should be considered by the agent. This enables users to organize and selectively execute task subsets without manually moving or renaming files.

## Background
The `run` command (`packages/cli/src/cmd/run.ts`) currently delegates all task discovery and selection to the AI agent via the prompt built in `packages/cli/src/builders/prompt.ts`. The agent reads `.code-task.md` files from `.ody/tasks/`, parses YAML frontmatter, and picks the highest-priority pending task. Each task file includes a `## Metadata` section with a `Labels` field containing comma-separated labels (e.g., `cli, filtering, ux`). Currently there is no mechanism to filter tasks by label at the CLI level — the agent simply considers all pending tasks. Adding label filtering requires: (1) reading and parsing task files at the CLI level before prompt construction, (2) passing filtered task filenames into the prompt so the agent only considers matching tasks, and (3) wiring up the new flag through the existing `citty` command definition.

## Technical Requirements
1. Add a `label` arg to the `run` command's `args` definition in `packages/cli/src/cmd/run.ts` with type `string`, alias `l`, and a description indicating it filters tasks by label.
2. Create a task-loading utility (e.g., `packages/cli/src/lib/tasks.ts`) that reads all `.code-task.md` files from `.ody/tasks/`, parses each file's `## Metadata` section to extract the `Labels` value, and returns a list of task filenames that match a given label (case-insensitive, trimmed comparison).
3. Update `buildPrompt` in `packages/cli/src/builders/prompt.ts` to accept an optional `label` parameter. When a label is provided, the prompt must instruct the agent to only consider the filtered set of task files (by filename) rather than all files in the directory.
4. Thread the `--label` flag value from the `run` command through to `buildPrompt`.
5. When no `--label` flag is provided, behavior must remain unchanged (all pending tasks considered).
6. The task file parsing should be lightweight — read file contents with `Bun.file()`, extract the Labels line via string matching (no heavy markdown parser needed).
7. Follow existing code conventions: ESM imports, `import type` for type-only, `camelCase` functions, error handling with `logger`, and `const` by default.

## Dependencies
- `citty` — already used for command definitions; the `label` arg follows existing patterns (see `init.ts` for alias examples).
- `Bun.file()` / `Bun.readdir()` — used for filesystem access; no new dependencies needed.
- `packages/cli/src/util/constants.ts` — provides `BASE_DIR` and `TASKS_DIR` constants.
- `packages/cli/src/builders/prompt.ts` — the `buildPrompt` function signature must be extended.

## Implementation Approach
1. **Add the `--label` flag to `run.ts`**: In the `args` object of `runCmd`, add a `label` entry with `type: 'string'`, `alias: 'l'`, `description: 'Filter tasks by label'`, and `required: false`. This follows the same pattern as `backend` in `init.ts`.
2. **Create `packages/cli/src/lib/tasks.ts`**: Implement a `getTaskFilesByLabel(label: string): Promise<string[]>` function that: (a) reads filenames from `.ody/tasks/` using `readdir`, (b) filters to `.code-task.md` files, (c) reads each file with `Bun.file().text()`, (d) extracts the `Labels` line from the `## Metadata` section using a regex like `/\*\*Labels\*\*:\s*(.+)/i`, (e) splits by comma, trims each label, and compares case-insensitively against the provided label, (f) returns the matching filenames. Handle the case where the tasks directory does not exist by returning an empty array.
3. **Extend `buildPrompt` signature**: Update `buildPrompt` to accept an optional options object `{ taskFiles?: string[] }`. When `taskFiles` is provided and non-empty, inject an additional instruction into the prompt: `"Only consider the following task files: <list>"`. When not provided, keep the existing behavior of looking at all files.
4. **Wire the flag through in `run.ts`**: In the `run` handler, if `args.label` is defined, call `getTaskFilesByLabel(args.label)` and pass the result into `buildPrompt({ taskFiles })`. If no matching tasks are found, log a warning and exit early.
5. **Update the dry-run output**: When `--once --dry-run` is used with `--label`, include the label and filtered task filenames in the JSON output for debugging visibility.
6. **Run `bunx oxlint src` and `bunx oxfmt -w src`** from `packages/cli` to validate lint and formatting.

## Acceptance Criteria

1. **Flag Registration**
   - Given the `run` command definition
   - When a user runs `ody run --help`
   - Then the output includes `--label, -l` with a description about filtering tasks by label

2. **Label Filtering**
   - Given `.ody/tasks/` contains tasks with labels `cli, ux` and `api, backend`
   - When the user runs `ody run --label cli`
   - Then only the task with the `cli` label is considered by the agent

3. **Case Insensitive Matching**
   - Given a task has labels `CLI, Frontend`
   - When the user runs `ody run --label cli`
   - Then the task matches and is included

4. **No Label Flag**
   - Given the user runs `ody run` without `--label`
   - When the agent loop starts
   - Then all pending tasks are considered (existing behavior unchanged)

5. **No Matching Tasks**
   - Given no tasks match the provided label
   - When the user runs `ody run --label nonexistent`
   - Then a warning is logged and the command exits gracefully without starting the agent loop

6. **Dry Run Integration**
   - Given the user runs `ody run --once --dry-run --label cli`
   - When the dry-run output is displayed
   - Then the JSON output includes the label filter and the list of matched task filenames

## Metadata
- **Complexity**: Medium
- **Labels**: cli, filtering, run-command, flags
