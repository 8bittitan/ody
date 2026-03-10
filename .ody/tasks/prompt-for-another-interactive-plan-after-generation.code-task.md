---
status: completed
created: 2026-03-09
started: 2026-03-10
completed: 2026-03-10
---
# Task: Prompt for Another Interactive Plan After Generation

## Description
Update the `ody plan --interactive` CLI flow so that after the interactive planning session completes and new `.code-task.md` file(s) have been created, the user is prompted to start another interactive plan instead of the command exiting immediately. This keeps interactive planning usable for back-to-back task creation without rerunning the command manually.

## Background
`packages/cli/src/cmd/plan.ts` currently has two distinct flows. The default non-interactive flow collects task descriptions in a loop and already asks `Add another plan?` before generating task files. The `--interactive` flow instead launches the backend in interactive mode with `buildInteractivePlanPrompt()`, waits for the subprocess to exit, and then exits the CLI with that status code. As a result, users who finish one interactive planning conversation must rerun `ody plan --interactive` to create a second plan.

The change should be scoped only to `--interactive`. The existing non-interactive prompt loop should remain unchanged. The new follow-up prompt needs to be integrated into the CLI control flow after the interactive subprocess returns, while preserving correct exit handling for cancellations and backend failures.

## Technical Requirements
1. Change the `--interactive` branch in `packages/cli/src/cmd/plan.ts` so the command can run multiple interactive planning sessions in one invocation.
2. After a successful interactive planning session returns control to the CLI, prompt the user to add another plan before deciding whether to launch the interactive harness again.
3. Do not add this new post-generation prompt to the non-interactive or batch planning flows.
4. If the interactive backend exits with a failure status, the CLI must stop and propagate that failure instead of prompting for another plan.
5. If the user declines or cancels the new follow-up prompt, the command must exit cleanly without launching another interactive session.
6. Preserve the existing interactive planning prompt content from `buildInteractivePlanPrompt()`; this task is about CLI flow control, not prompt wording.
7. Keep compatibility with the existing backend and model resolution path used by `ody plan --interactive`.

## Dependencies
- `packages/cli/src/cmd/plan.ts` — contains the current branching logic for batch, interactive, and non-interactive plan modes.
- `@clack/prompts` confirm/outro/log behavior — used for the existing CLI confirmation prompts and user-facing termination messages.
- `internal/builders/src/planPrompt.ts` — supplies the interactive planning system prompt, but should not require behavioral changes for this task.

## Implementation Approach
1. Refactor the `args.interactive` branch in `packages/cli/src/cmd/plan.ts` from a single launch-and-exit path into a loop that can invoke `backend.buildInteractiveCommand(...)` more than once.
2. After each interactive subprocess exits successfully, prompt the user with a confirmation such as `Add another plan?` and only relaunch the interactive harness when the user confirms.
3. Handle cancellation and negative confirmation as normal, successful exits from the command, and keep non-zero subprocess exits as immediate failures.
4. Reuse the already resolved backend, config, and model values rather than duplicating setup work inside the loop.
5. Add or update CLI tests if there is an existing practical place to cover interactive branch control flow; otherwise document the manual verification path.
6. Run targeted validation for the CLI package so the refactor does not regress command behavior or typing.

## Acceptance Criteria

1. **Interactive Success Can Chain**
   - Given the user runs `ody plan --interactive`
   - When one interactive planning session completes successfully
   - Then the CLI asks whether to add another plan before exiting

2. **Repeat Interactive Session**
   - Given the user confirms they want another plan after a successful interactive session
   - When the confirmation is accepted
   - Then the CLI launches a new interactive planning session without requiring a new `ody plan --interactive` invocation

3. **Decline Exits Cleanly**
   - Given the user declines or cancels the post-generation follow-up prompt
   - When the current interactive planning session has already completed successfully
   - Then the CLI exits successfully and does not start another interactive session

4. **Failures Still Stop Immediately**
   - Given the interactive backend process exits with a non-zero status
   - When control returns to the CLI
   - Then the command exits with that failure status and does not prompt for another plan

5. **Other Plan Modes Unchanged**
   - Given the user runs `ody plan` without `--interactive` or uses the batch `planFile` path
   - When task planning completes
   - Then those flows behave as before, with no new post-generation repeat prompt added

## Metadata
- **Complexity**: Low
- **Labels**: cli, interactive, plan, ux
