---
status: completed
created: 2026-02-15
started: 2026-02-15
completed: 2026-02-15
---
# Task: Align `run` Command Spinner Messaging with `plan` Command Pattern

## Description
The `run` command currently uses a single generic spinner message (`"Running agent loop"`) that starts once before the loop and stops once at the end, providing no per-iteration feedback. It should be updated to follow the `plan` command's pattern: starting and stopping the spinner within each iteration, reporting the current iteration number, displaying a success message after each iteration, and outputting the final iteration count at the end.

## Background
The `plan` command (`packages/cli/src/cmd/plan.ts`) implements a user-friendly spinner pattern that reports progress per iteration (e.g., `"Generating task plan 1 of 3"`, `"Task plan 1 of 3 generated"`) and ends with a dynamic summary (`"Task planning complete -- 2 task(s) generated"`). The `run` command (`packages/cli/src/cmd/run.ts`) lacks this per-iteration feedback. The spinner is created once before the loop, displays a static message, and the final `outro` is always the static string `"Agent loop complete"` regardless of how many iterations ran. This makes it difficult for users to gauge progress during longer runs.

## Technical Requirements
1. Move the spinner start/stop lifecycle inside the `run` command's `for` loop so each iteration gets its own start and stop message
2. Report the current iteration number when the spinner starts (e.g., `"Running iteration 1 of N"` or `"Running iteration 1"` when `maxIterations` is `0`/unlimited)
3. Display a success message when the spinner stops after each iteration (e.g., `"Iteration 1 of N complete"`)
4. Track the number of successfully completed iterations with a counter variable
5. Output the final iteration count in the `outro` message (e.g., `"Agent loop complete -- 3 iteration(s) run"`)
6. Handle the failure case by stopping the spinner with an error message that includes the iteration number
7. Handle the early completion case (when `<woof>COMPLETE</woof>` is detected) by stopping the spinner with a success message before breaking
8. Preserve the existing conditional spinner creation for verbose mode (no spinner when `--verbose` is set)
9. Preserve existing notification behavior (`individual` and `all` modes)

## Dependencies
- `packages/cli/src/cmd/run.ts` -- the file to modify (lines 104-168 contain the loop logic)
- `packages/cli/src/cmd/plan.ts` -- reference implementation for the spinner pattern (lines 67-112)
- `@clack/prompts` -- provides `spinner()`, `log`, and `outro` used for messaging

## Implementation Approach
1. Add a `let completed = 0;` counter variable before the loop, mirroring the `plan` command's `let generated = 0;` pattern
2. Move `agentSpinner?.start(...)` inside the `for` loop body, updating the message to include the iteration number and total (e.g., `"Running iteration ${i + 1} of ${maxIterations}"`) -- when `maxIterations` is `0` (unlimited), omit the total and show only the current iteration number (e.g., `"Running iteration ${i + 1}"`)
3. After each successful iteration (both normal and early-completion cases), call `agentSpinner?.stop(...)` with a per-iteration success message (e.g., `"Iteration ${i + 1} complete"`) and increment the `completed` counter
4. In the early-completion (`completed` flag / break) path, stop the spinner with a success message before breaking out of the loop
5. In the `catch` block, stop the spinner with an error message that includes the iteration number (e.g., `"Iteration ${i + 1} failed: ${message}"`)
6. Update the final `outro` call to include the completed count: `"Agent loop complete -- ${completed} iteration(s) run"`
7. Rename the inner `completed` boolean flag (used for the `<woof>COMPLETE</woof>` marker detection) to `tasksDone` or `allTasksComplete` to avoid shadowing the new outer `completed` counter

## Acceptance Criteria

1. **Per-iteration spinner start message**
   - Given the `run` command is executing with `maxIterations` > 0
   - When each iteration of the agent loop begins
   - Then the spinner displays `"Running iteration X of Y"` where X is the current iteration and Y is the max

2. **Unlimited mode spinner start message**
   - Given the `run` command is executing with `maxIterations` set to 0 (unlimited)
   - When each iteration of the agent loop begins
   - Then the spinner displays `"Running iteration X"` without a total count

3. **Per-iteration success message**
   - Given an iteration of the agent loop completes successfully
   - When the spinner stops for that iteration
   - Then it displays a success message including the iteration number

4. **Early completion message**
   - Given the `<woof>COMPLETE</woof>` marker is detected during an iteration
   - When the spinner stops
   - Then it displays a completion message indicating all tasks are finished, including the iteration number

5. **Error message includes iteration number**
   - Given an iteration of the agent loop throws an error
   - When the spinner stops with the error
   - Then the message includes which iteration failed

6. **Final summary includes iteration count**
   - Given the agent loop has finished (normally or via early completion)
   - When the `outro` message is displayed
   - Then it includes the number of iterations that were successfully completed

7. **Verbose mode unchanged**
   - Given the `--verbose` flag is set
   - When the agent loop runs
   - Then no spinner is created and output streams directly to stdout as before

8. **Notification behavior preserved**
   - Given notification settings are configured
   - When iterations complete
   - Then `individual` and `all` notifications fire at the same points as before

## Metadata
- **Complexity**: Low
- **Labels**: cli, ux, spinner, run-command
