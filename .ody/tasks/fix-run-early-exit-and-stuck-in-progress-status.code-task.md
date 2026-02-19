---
status: completed
created: 2026-02-18
started: 2026-02-19
completed: 2026-02-19
---
# Task: Fix Early `ody run` Exit That Leaves Tasks Stuck in `in_progress`

## Description
The `ody run` command can report success and end the loop even when the backend process exits early or fails after setting a task to `in_progress` but before marking it `completed`. This leaves task files stuck in `in_progress` and causes follow-up iterations to skip them because the loop only targets `pending` tasks.

## Background
The current loop in `packages/cli/src/cmd/run.ts` kills the backend process as soon as `<woof>COMPLETE</woof>` appears anywhere in streamed stdout. It also does not validate the process exit code after `await proc.exited`; the iteration is counted as complete regardless of whether the process exited cleanly. Combined, this creates a false-success path where the CLI stops while the task file remains unfinished. Since the run prompt explicitly tells the agent to select only tasks with `status: pending`, a task stranded in `in_progress` will not be picked up on subsequent iterations.

## Technical Requirements
1. In `packages/cli/src/cmd/run.ts`, treat non-zero backend exit codes as failures and do not increment the success counter for failed iterations.
2. Do not rely on a naive substring search across the full accumulated stream for completion detection; detect `<woof>COMPLETE</woof>` only when it appears as a standalone output marker.
3. Prevent premature `proc.kill()` on incidental marker mentions (for example echoed prompt text or explanatory output).
4. In single-task mode (`ody run <taskFile>`), verify the target file ends in `status: completed` before reporting success; if not, surface an error and exit non-zero.
5. In loop mode, before breaking on "all tasks complete", re-check task files in the target set and confirm there are no `pending` or `in_progress` tasks left unexpectedly.
6. Ensure failure messages clearly indicate whether termination was due to process exit failure, marker ambiguity, or post-run task state verification.
7. Keep current verbose behavior, spinner UX, and notification semantics unchanged except where needed for accurate success/failure reporting.

## Dependencies
- `packages/cli/src/cmd/run.ts` -- main execution loop, completion detection, and success/failure accounting.
- `packages/cli/src/util/stream.ts` -- stream chunk handling used for marker detection.
- `packages/cli/src/util/task.ts` -- frontmatter parsing and task file discovery helpers used for post-run state verification.
- `packages/cli/src/builders/runPrompt.ts` -- expected completion protocol and task-selection behavior.
- `README.md` command behavior notes for `ody run` (update only if behavior wording changes materially).

## Implementation Approach
1. **Add robust process outcome checks**: Capture `const exitCode = await proc.exited;` and branch on non-zero exit codes before marking iteration success.
2. **Harden marker detection**: Replace broad `accumulated.includes(...)` checks with stricter matching (line-based or boundary-aware) so only explicit completion markers trigger early termination.
3. **Gate process termination**: Kill the backend process only when strict marker criteria are met; otherwise allow the process to finish naturally.
4. **Add task-state verification for single-task mode**: After process completion, read the specified task file and ensure frontmatter `status` is `completed`; fail fast if it is still `pending` or `in_progress`.
5. **Add loop-level state validation**: When tasks appear complete, scan the relevant task set and validate no task remains in `in_progress` unexpectedly before breaking.
6. **Improve error reporting**: Emit actionable log messages that identify the failed validation stage (exit code, marker detection, or file status validation).
7. **Validate behavior manually**: Run representative scenarios (`ody run <taskFile>`, normal loop, and forced backend failure simulation) and confirm outcomes match expected statuses.

## Acceptance Criteria

1. **Non-zero exit code is treated as failure**
   - Given the backend process exits with a non-zero code
   - When `ody run` processes that iteration
   - Then the command reports failure, does not count the iteration as complete, and exits non-zero

2. **Incidental marker text does not terminate early**
   - Given backend output contains `<woof>COMPLETE</woof>` inside explanatory or echoed text
   - When the stream is processed
   - Then the process is not killed unless the marker matches the strict standalone completion format

3. **Single-task success requires completed frontmatter**
   - Given `ody run <taskFile>` is executed
   - When the backend exits
   - Then the command only reports success if the task file frontmatter status is `completed`

4. **Stuck `in_progress` task is surfaced as error**
   - Given a task transitions to `in_progress` but never reaches `completed`
   - When `ody run` finishes the iteration
   - Then the command reports a clear error about unresolved task state instead of reporting success

5. **Loop completion is validated before break**
   - Given loop mode indicates completion
   - When `ody run` is about to break
   - Then it verifies no unexpected `pending`/`in_progress` tasks remain in the applicable task set

6. **Existing UX behavior remains intact**
   - Given successful runs in verbose and non-verbose modes
   - When the command executes normally
   - Then spinner messaging and notification behavior remain functionally consistent with current behavior

## Metadata
- **Complexity**: Medium
- **Labels**: cli, run-command, reliability, task-lifecycle
