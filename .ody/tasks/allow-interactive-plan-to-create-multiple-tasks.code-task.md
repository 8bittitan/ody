---
status: completed
created: 2026-03-09
started: 2026-03-09
completed: 2026-03-09
---
# Task: Allow Interactive Plan Mode to Create Multiple Task Files

## Description
The `ody plan -i` interactive mode is currently restricted to creating exactly one `.code-task.md` file per session. This change updates the interactive plan prompt so the agent can create as many task files as needed to fulfill the user's plan, matching the flexibility already available in batch mode (`ody plan <file>`).

## Background
The CLI has three plan modes: default (one task per description in a loop), batch (N tasks from a planning document), and interactive (collaborative conversation). The interactive mode's system prompt (`INTERACTIVE_PLAN_PROMPT` in `internal/builders/src/planPrompt.ts`) explicitly says "create exactly one" and instructs the agent to narrow broad initiatives down to a single task. This is overly restrictive — when a user describes a multi-faceted plan interactively, the agent should be able to produce multiple discrete task files, just like batch mode does. The prompt needs to be rewritten to remove single-task constraints while preserving the collaborative, question-driven workflow that makes interactive mode valuable.

## Technical Requirements
1. Rewrite the `INTERACTIVE_PLAN_PROMPT` constant in `internal/builders/src/planPrompt.ts` (lines 59-152) to remove all single-task restrictions
2. Replace language like "exactly one", "a single task", "one task for this file", and "keep the task scoped to one discrete piece of work" with language allowing multiple tasks
3. Add guidance for the agent to decompose broad plans into multiple discrete, well-scoped task files — similar to the batch prompt's instruction to "create as many task files as needed"
4. Preserve the interactive mode's collaborative workflow: restating the user's request, asking clarifying questions, summarizing before writing
5. Preserve the quality bar: each individual task must still be specific, actionable, and follow the exact file format
6. Preserve all existing behavioral rules that are not related to the single-task constraint (conciseness, no implementation code unless asked, no `<woof>COMPLETE</woof>` in files, etc.)
7. Add instruction to order tasks logically (dependencies first), consistent with the batch prompt
8. The `buildInteractivePlanPrompt` function signature and return type must remain unchanged

## Dependencies
- `internal/builders/src/planPrompt.ts` — the file containing the `INTERACTIVE_PLAN_PROMPT` constant and `buildInteractivePlanPrompt` export
- `internal/builders/src/shared.ts` — the `TASK_FILE_FORMAT` template (no changes needed, but the interactive prompt should reference the same file structure)
- `packages/cli/src/cmd/plan.ts` — the plan command that calls `buildInteractivePlanPrompt()` on line 105; no changes should be needed here since the function signature is unchanged

## Implementation Approach
1. Open `internal/builders/src/planPrompt.ts` and locate the `INTERACTIVE_PLAN_PROMPT` constant (lines 59-152)
2. Rewrite the opening sentence from "helping the user create exactly one valid `.code-task.md` file" to "helping the user create one or more valid `.code-task.md` files"
3. Update the "Objectives" section: change "define a single implementation task" to "define one or more implementation tasks", remove the instruction to "keep the task scoped to one discrete piece of work" as a hard constraint, and replace the narrowing instruction ("help them choose one task for this file") with a decomposition instruction ("help them decompose it into discrete, well-scoped tasks")
4. Update the "Required output" section from "Produce exactly one Markdown task file" to "Produce one or more Markdown task files — one per discrete, actionable task"
5. Add a rule about logical ordering of tasks (dependencies first, dependent tasks later)
6. Update the "Workflow" section to account for multi-task output: after gathering information, the agent should summarize the planned tasks (plural), confirm the decomposition with the user, then produce all files
7. Ensure the "Quality bar" section applies per-task rather than assuming a single output
8. Verify the `buildInteractivePlanPrompt` function still exports correctly with no signature change
9. Run `bun typecheck` to confirm no type errors
10. Run `bun lint` and `bun fmt` to ensure code quality

## Acceptance Criteria

1. **Multiple tasks from broad initiative**
   - Given a user describes a broad initiative in interactive mode (e.g., "add user authentication with registration, login, and password reset")
   - When the agent finishes the interactive conversation
   - Then multiple `.code-task.md` files are produced, one per discrete task, each following the required format

2. **Single task still works**
   - Given a user describes a single, well-scoped task in interactive mode
   - When the agent finishes the interactive conversation
   - Then exactly one `.code-task.md` file is produced, as before

3. **Collaborative workflow preserved**
   - Given a user starts an interactive plan session
   - When the agent begins the conversation
   - Then it restates the request, asks clarifying questions, and summarizes the plan before writing any files

4. **Task ordering is logical**
   - Given the agent creates multiple task files from an interactive session
   - When the tasks have dependencies on each other
   - Then tasks are ordered with dependencies first and dependent tasks later

5. **No breaking changes**
   - Given the updated `buildInteractivePlanPrompt` function
   - When imported and called by `packages/cli/src/cmd/plan.ts`
   - Then it returns a string with no signature or type changes, and `bun typecheck` passes

## Metadata
- **Complexity**: Low
- **Labels**: cli, builders, interactive, plan, prompt
