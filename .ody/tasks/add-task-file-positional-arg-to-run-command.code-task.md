---
status: completed
created: 2026-02-10
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add Task File Positional Argument to Run Command

## Description
Add a positional argument to the `run` command that accepts a path to a single `.code-task.md` file. When provided, the command should run the harness for only that specific task and exit upon completion, bypassing the normal task-selection loop. This gives users direct control to target a specific task without relying on label filters or the agent's priority selection.

## Background
The `run` command currently operates in two modes: a loop mode that iterates through pending tasks (selected by the agent based on priority), and a `--once` mode that runs a single interactive session. In both cases, the agent decides which task to work on from the pool of pending `.code-task.md` files in the tasks directory. The `--label` flag provides some filtering, but there is no way to point the command at one exact task file and say "do this, then stop."

A positional argument accepting a task file path would allow users to explicitly target a single task. This is useful for re-running a specific task, testing a newly created task in isolation, or integrating `ody run <file>` into scripted workflows. The harness should run in loop mode (not `--once` PTY mode) for the targeted task so it benefits from the same completion-marker detection and iteration logic, but it should exit as soon as the single task is complete.

## Technical Requirements
1. Add a positional argument to the `run` command definition in `packages/cli/src/cmd/run.ts` using `citty`'s `defineCommand` args. The argument should accept a string value representing a path to a `.code-task.md` file (e.g., `.ody/tasks/add-email-validation.code-task.md`).
2. When the positional argument is provided, validate that the file exists and ends with `.code-task.md`. If the file does not exist or has the wrong extension, log an error and exit with code 1.
3. Build a modified prompt that instructs the agent to work on only the specified task file, skipping the normal task-selection logic. The prompt should tell the agent to read that file, set its status to `in_progress`, implement it, validate, mark it `completed`, and output `<woof>COMPLETE</woof>`.
4. The positional argument should be mutually exclusive with the `--label` flag. If both are provided, log an error and exit.
5. When a task file is provided, the command should use the loop mode (not `--once` PTY mode) with a default of 1 iteration (overridable by `--iterations`) and exit once the agent outputs the completion marker or iterations are exhausted.
6. The `buildRunPrompt` function in `packages/cli/src/builders/runPrompt.ts` must be updated to accept an optional `taskFile` parameter and produce a prompt that targets the single file when provided.

## Dependencies
- `packages/cli/src/cmd/run.ts` -- the run command where the positional arg is added and routing logic is modified
- `packages/cli/src/builders/runPrompt.ts` -- the prompt builder that must support a single-task-file mode
- `citty` -- the CLI framework; need to confirm positional argument support (citty supports positional args via the `args` definition with no `alias` and `type: 'positional'`, or by defining the arg name as the positional key)
- `packages/cli/src/util/constants.ts` -- `BASE_DIR` and `TASKS_DIR` constants used for path resolution
- `packages/cli/src/lib/tasks.ts` -- existing task utilities, may need a helper to validate a task file path

## Implementation Approach
1. **Investigate citty positional arg support** -- Review citty documentation or source to determine the correct way to define a positional argument. If citty does not support a dedicated positional type, use a trailing string argument or parse `process.argv` manually for the positional value after all flags.
2. **Add the positional argument definition** -- In `packages/cli/src/cmd/run.ts`, add a `task` (or `taskFile`) arg to the `args` object. Configure it as a positional string argument that is optional. Add a description like `"Path to a specific .code-task.md file to run"`.
3. **Add validation logic** -- In the `run` function, after loading config, check if the positional arg was provided. If so:
   - Verify the file path ends with `.code-task.md`.
   - Resolve the path and check it exists using `Bun.file(path).exists()`.
   - Check for mutual exclusivity with `--label`; if both are set, log an error via `log.error` and `process.exit(1)`.
4. **Update `buildRunPrompt`** -- Add an optional `taskFile?: string` parameter to the options. When `taskFile` is provided, generate a prompt variant that instructs the agent to work on only that specific file (skipping the task-selection step). The prompt should include the full file path and instruct the agent to read it, update frontmatter, implement, validate, commit (if `shouldCommit`), and output `<woof>COMPLETE</woof>` when done.
5. **Wire up prompt and execution** -- In `run.ts`, when the positional arg is set, call `buildRunPrompt({ taskFile: resolvedPath })` and proceed with the loop execution path. The loop should default to `maxIterations = 1` when a single task file is targeted (unless `--iterations` overrides it), so the agent gets one shot at the task before exiting.
6. **Format, lint, and build** -- Run `bunx oxfmt -w packages/cli/src/cmd/run.ts packages/cli/src/builders/runPrompt.ts` and `bunx oxlint packages/cli/src/cmd/run.ts packages/cli/src/builders/runPrompt.ts`, then `bun run build` from the repo root to confirm everything compiles.

## Acceptance Criteria

1. **Single task file runs successfully**
   - Given a valid `.code-task.md` file exists at `.ody/tasks/my-task.code-task.md`
   - When the user runs `ody run .ody/tasks/my-task.code-task.md`
   - Then the agent processes only that task, marks it complete, and exits

2. **Invalid file path is rejected**
   - Given no file exists at the specified path
   - When the user runs `ody run .ody/tasks/nonexistent.code-task.md`
   - Then an error message is logged and the process exits with code 1

3. **Wrong file extension is rejected**
   - Given a file exists but does not end with `.code-task.md`
   - When the user runs `ody run README.md`
   - Then an error message is logged and the process exits with code 1

4. **Mutual exclusivity with --label**
   - Given the user provides both a task file and a label
   - When the user runs `ody run .ody/tasks/my-task.code-task.md --label cli`
   - Then an error message is logged explaining the options are mutually exclusive and the process exits with code 1

5. **Default behaviour preserved when no positional arg**
   - Given no positional argument is provided
   - When the user runs `ody run`
   - Then the command behaves exactly as before (loop mode, agent selects tasks)

6. **Iterations flag works with task file**
   - Given a valid task file path
   - When the user runs `ody run .ody/tasks/my-task.code-task.md -i 3`
   - Then the agent loop runs for up to 3 iterations for that single task

7. **Works with --once mode**
   - Given a valid task file path
   - When the user runs `ody run --once .ody/tasks/my-task.code-task.md`
   - Then the agent runs in PTY once mode with a prompt targeting only that task file

## Metadata
- **Complexity**: Medium
- **Labels**: cli, run-command, args, enhancement
