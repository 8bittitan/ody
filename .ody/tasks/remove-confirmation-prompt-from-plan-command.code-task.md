---
status: completed
created: 2026-02-11
started: 2026-02-10
completed: 2026-02-10
---
# Task: Remove Confirmation Prompt from Plan Command

## Description
Remove the confirmation prompt that displays plan details and asks "Proceed with these plan details?" from the `plan` CLI command. This confirmation step is unnecessary friction in the planning workflow - users have already described their task and want to proceed directly to generating the plan without an additional confirmation step.

## Background
The `plan` CLI command (`packages/cli/src/cmd/plan.ts`) currently follows this flow:
1. Prompt user to describe the task
2. Display task description in a formatted box with title "Plan details"
3. Ask user to confirm with "Proceed with these plan details?"
4. Generate the task plan

This confirmation step (steps 2-3) adds unnecessary overhead. Users who describe a task and submit it intend to generate a plan - the confirmation doesn't add meaningful value but slows down the workflow.

## Technical Requirements
1. Remove the `box()` call that displays the task description with "Plan details" title
2. Remove the `confirm()` prompt asking "Proceed with these plan details?"
3. Remove the cancellation handling for the confirmation step
4. Maintain the task description prompt and the loop continuation prompt
5. Keep all other functionality intact (dry-run, verbose mode, backend processing, file generation)

## Dependencies
- `packages/cli/src/cmd/plan.ts` - Main command file containing the plan command logic
- `@clack/prompts` - Used for text input, confirmation, and UI components
- `citty` - CLI framework for command definition

## Implementation Approach
1. Read `packages/cli/src/cmd/plan.ts` to understand the current implementation
2. Remove lines 50-62: the `log.message('')` call and `box()` call that displays the plan details
3. Remove lines 64-72: the `confirm()` prompt asking "Proceed with these plan details?" and associated cancellation handling (the `isCancel(confirmed)` check, `cancel()` call, and `process.exit(0)`)
4. The task description (`description` variable) is still needed for the `buildPlanPrompt()` call — do not remove it
5. Remove the `box` import from the `@clack/prompts` import line (it will no longer be used). Keep `confirm` since it is still used for the "Would you like to add another plan?" prompt. Also remove the `cancel` import since it is only used in the confirmation cancellation block being removed.
6. Run `bunx oxlint src` from `packages/cli` to verify no syntax errors or lint issues (note: the linter is `oxlint`, not `oxlinter`)
7. Run `bunx oxfmt -w src` from `packages/cli` to normalize formatting
8. Test by running `bun run src/index.ts plan` from `packages/cli` to ensure the flow works without the confirmation step

## Acceptance Criteria

1. **Confirmation Prompt Removed**
   - Given the user runs the plan command
   - When they enter a task description and submit it
   - Then the plan is generated immediately without showing a confirmation dialog

2. **Plan Details Box Removed**
   - Given the plan command is running
   - When the user submits their task description
   - Then no "Plan details" box is displayed before plan generation

3. **Other Prompts Intact**
   - Given the plan command is running
   - When a task plan has been generated
   - Then the "Would you like to add another plan?" prompt still appears

4. **Error Handling Maintained**
   - Given the user cancels at the initial description prompt
   - When they press Ctrl+C or similar
   - Then the command still exits gracefully with "Plan cancelled." message

5. **Functional Parity**
   - Given the plan command runs without the confirmation
   - When processing completes
   - Then the task file is still created in `.ody/tasks/` directory as before

## Metadata
- **Complexity**: Low
- **Labels**: cli, ux, refactoring, plan-command
