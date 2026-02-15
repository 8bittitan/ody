---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Add File Argument to Plan Command for Batch Task Generation

## Description
Allow the `plan` command to accept an optional positional argument that is a path to a planning document or file. When provided, the command should skip the interactive description collection loop and instead instruct the backend agent to read the referenced file and generate as many task files as needed based on its contents.

## Background
Currently the `plan` command in `packages/cli/src/cmd/plan.ts` collects task descriptions interactively one at a time via `@clack/prompts` prompts. Each description is sent to the agent individually to produce exactly one `.code-task.md` file. There is no way to feed in a pre-written planning document (e.g., a PDD, RFC, or feature spec) and have the agent decompose it into multiple tasks automatically. Adding a positional file argument enables this workflow: a user writes a planning doc, passes it to `ody plan ./docs/feature-spec.md`, and the agent reads the file and creates all necessary task files in one shot.

## Technical Requirements
1. Add an optional positional argument `planFile` to the `plan` command's `args` definition using `type: 'positional'` (following the same pattern as `taskFile` in the `run` command).
2. When `planFile` is provided, validate that the file exists (using `Bun.file().exists()`). Exit with an error if it does not.
3. When `planFile` is provided, skip the interactive description collection loop entirely.
4. Create a new prompt builder function (e.g., `buildBatchPlanPrompt`) in `packages/cli/src/builders/planPrompt.ts` that instructs the agent to read the given file path, analyze its contents, and generate as many `.code-task.md` files as needed — each following the existing task file format specification.
5. When `planFile` is provided, invoke the agent exactly once with the batch plan prompt instead of looping over individual descriptions.
6. When `planFile` is NOT provided, the existing interactive behavior must remain completely unchanged.
7. The `--dry-run` and `--verbose` flags must work with the file argument in the same way they work today.

## Dependencies
- `packages/cli/src/cmd/plan.ts` — the plan command implementation that needs modification.
- `packages/cli/src/builders/planPrompt.ts` — the prompt builder that needs a new `buildBatchPlanPrompt` function (or equivalent).
- `packages/cli/src/cmd/run.ts` — reference for the positional argument pattern with `citty`.
- `packages/cli/src/util/constants.ts` — `BASE_DIR` and `TASKS_DIR` constants used in prompt building.
- `packages/cli/src/lib/config.ts` — `Config.get('tasksDir')` for the configurable tasks directory.

## Implementation Approach
1. **Add positional argument to plan command**: In `packages/cli/src/cmd/plan.ts`, add a `planFile` arg with `type: 'positional'` and `required: false` to the `args` object.
2. **Validate the file path**: At the start of the `run` function, if `args.planFile` is defined, use `Bun.file(args.planFile).exists()` to verify the file exists. If it does not, log an error with `log.error` and call `process.exit(1)`.
3. **Create `buildBatchPlanPrompt` function**: Add a new exported function in `packages/cli/src/builders/planPrompt.ts`. The prompt should:
   - Instruct the agent to read the file at the given path.
   - Analyze the planning document and break it down into discrete, actionable tasks.
   - Create one `.code-task.md` file per task in the configured tasks directory.
   - Follow the same file format specification already defined in the existing `PLAN_PROMPT`.
   - End with the `<woof>COMPLETE</woof>` completion marker when all tasks are written.
4. **Branch the run logic**: In the plan command's `run` function, add an early branch: if `args.planFile` is truthy, build the batch prompt, invoke the agent once (respecting `--dry-run` and `--verbose`), and then call `outro` with an appropriate completion message. Otherwise, fall through to the existing interactive loop.
5. **Ensure mkdir is called**: Before spawning the agent in the file-argument path, call `mkdir(path.join(BASE_DIR, TASKS_DIR), { recursive: true })` to ensure the tasks directory exists, matching the existing behavior.
6. **Spinner and logging**: Use the same spinner pattern as the existing plan command. The message should indicate that batch task generation is in progress (e.g., `"Generating task plans from file..."`).

## Acceptance Criteria

1. **File argument accepted**
   - Given the user runs `ody plan ./docs/feature-spec.md`
   - When the file `./docs/feature-spec.md` exists
   - Then the command reads the file path, builds a batch plan prompt, and invokes the agent once

2. **File not found error**
   - Given the user runs `ody plan ./nonexistent.md`
   - When the file does not exist
   - Then the command logs an error message and exits with code 1

3. **Interactive mode preserved**
   - Given the user runs `ody plan` with no positional argument
   - When the command starts
   - Then the existing interactive description collection loop runs as before

4. **Dry run with file argument**
   - Given the user runs `ody plan --dry-run ./docs/feature-spec.md`
   - When dry-run is enabled
   - Then the generated batch prompt is printed to the console instead of being sent to the agent

5. **Verbose mode with file argument**
   - Given the user runs `ody plan --verbose ./docs/feature-spec.md`
   - When verbose is enabled
   - Then agent output is streamed to the terminal in real time

6. **Multiple tasks generated from document**
   - Given a planning document with multiple features or steps
   - When the agent processes the batch plan prompt
   - Then the prompt instructs the agent to create one `.code-task.md` file per discrete task, all in the configured tasks directory

## Metadata
- **Complexity**: Medium
- **Labels**: cli, plan, enhancement
