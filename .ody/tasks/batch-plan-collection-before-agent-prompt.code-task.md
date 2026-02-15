---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Batch Plan Collection Before Agent Prompting

## Description
Refactor the `plan` CLI command so that it collects all task descriptions from the user upfront before invoking the backend agent. Currently, the command prompts the user for a description, immediately spawns the agent to generate a task file, and then asks if they want to add another plan — repeating this cycle. The new behavior should collect all descriptions first in a loop, then iterate through the collected descriptions and invoke the agent once per description to generate the corresponding task files.

## Background
The current `plan` command in `packages/cli/src/cmd/plan.ts` uses a `while (true)` loop that interleaves user input with agent invocation. Each iteration collects a single description via `@clack/prompts` `text()`, builds a prompt with `buildPlanPrompt()`, spawns the backend agent process, waits for it to complete (watching for the `<woof>COMPLETE</woof>` marker), and then asks the user if they want to add another plan via `confirm()`. This means the user must wait for each agent invocation to finish before they can enter their next plan description. Batching the collection phase allows the user to submit all their ideas in one uninterrupted flow, and then the agent processes them sequentially afterward.

## Technical Requirements
1. The user input collection loop must gather all plan descriptions into an array before any agent invocation occurs.
2. Each collected description must still result in its own separate agent invocation and its own `.code-task.md` file — do not combine multiple descriptions into a single prompt or task file.
3. The `confirm()` prompt between plans should ask something like `"Add another plan?"` during the collection phase, not after agent processing.
4. After collection is complete, the command should iterate through all descriptions sequentially, invoking the agent for each one with the same `buildPlanPrompt()` → `backend.buildCommand()` → `Bun.spawn()` → `Stream.toOutput()` flow that exists today.
5. The `--dry-run` flag must continue to work — when active, it should print each prompt without spawning the agent, for all collected descriptions.
6. The spinner and log messaging should clearly indicate progress through the batch (e.g., `"Generating task plan 2 of 5"`).
7. If the user cancels during the collection phase (via Ctrl+C on the `text()` or `confirm()` prompt), the command should exit gracefully without processing any plans.
8. If the agent fails or errors during processing of one plan, the command should log the error and continue to the next plan rather than aborting the entire batch.

## Dependencies
- `packages/cli/src/cmd/plan.ts` — the primary file to modify
- `packages/cli/src/builders/planPrompt.ts` — no changes expected, but must remain compatible
- `@clack/prompts` — `text()`, `confirm()`, `spinner()`, `log`, `outro`, `isCancel` APIs
- `packages/cli/src/util/stream.ts` — `Stream.toOutput()` for reading agent output
- `packages/cli/src/backends/backend.ts` — `Backend` class for building and dispatching commands

## Implementation Approach
1. **Refactor the main loop into two phases.** Replace the single `while (true)` loop with a collection phase and a processing phase. The collection phase loops on `text()` + `confirm()` to accumulate an array of description strings. The processing phase iterates over the array and runs the existing agent invocation logic for each entry.
2. **Add a descriptions array.** Declare `const descriptions: string[] = []` before the collection loop. Push each valid description onto it. Break out of the collection loop when the user declines to add more or cancels.
3. **Handle cancellation during collection.** If `isCancel()` is true on either the `text()` or `confirm()` prompt, call `outro("Plan cancelled.")` and return immediately — no plans should be processed.
4. **Guard against empty collection.** After the collection loop, if `descriptions` is empty (user cancelled on the first prompt), exit gracefully.
5. **Process descriptions sequentially.** Use a `for` loop with index over `descriptions`. For each description: build the prompt, handle `--dry-run`, ensure the tasks directory exists, build and spawn the command, stream output, and log completion.
6. **Update spinner messages for batch progress.** Change the spinner start message to include the current index and total count, e.g., `s.start(\`Generating task plan ${i + 1} of ${descriptions.length}\`)` and the stop message to `s.stop(\`Task plan ${i + 1} of ${descriptions.length} generated\`)`.
7. **Wrap each agent invocation in try/catch.** If an individual plan fails, log the error with `log.error()` and continue to the next description instead of throwing.
8. **Update the final outro message.** After all plans are processed, call `outro()` with a summary like `"Task planning complete — N tasks generated"`.

## Acceptance Criteria

1. **All descriptions collected before processing**
   - Given the user runs `ody plan`
   - When they enter multiple task descriptions and confirm adding more each time, then decline
   - Then no agent process is spawned until after the user finishes entering all descriptions

2. **Each description produces its own task file**
   - Given the user enters 3 plan descriptions
   - When the processing phase runs
   - Then 3 separate `.code-task.md` files are created in `.ody/tasks/`, one per description

3. **Cancellation during collection aborts cleanly**
   - Given the user is entering plan descriptions
   - When they press Ctrl+C on any `text()` or `confirm()` prompt
   - Then the command exits with `"Plan cancelled."` and no agent processes are spawned

4. **Dry-run prints all prompts without spawning agents**
   - Given the user runs `ody plan --dry-run`
   - When they enter 2 descriptions and finish collection
   - Then both prompts are printed to the terminal and no agent processes are spawned

5. **Progress is indicated during batch processing**
   - Given the user submitted 3 plans
   - When the agent is generating task files
   - Then the spinner shows `"Generating task plan 1 of 3"`, `"Generating task plan 2 of 3"`, etc.

6. **Single agent failure does not abort the batch**
   - Given the user submitted 3 plans and the agent errors on plan 2
   - When the processing phase runs
   - Then plans 1 and 3 still produce task files and the error for plan 2 is logged

## Metadata
- **Complexity**: Low
- **Labels**: cli, plan, ux, refactor
