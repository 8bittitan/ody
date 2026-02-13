---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Plan New Command Implementation

## Description
Implement the `ody plan new` command in `src/cmd/plan/new.zig` that interactively creates new code task files by prompting for a task description, building a plan prompt, spawning the AI backend to generate the task file, and optionally looping for additional tasks.

## Background
The TypeScript `ody plan new` command provides a loop-based interactive flow where the user describes a task, the AI backend generates a structured `.code-task.md` file following the plan prompt template, and then the user is asked if they want to create another task. The backend is spawned as a child process and monitored for the `<woof>COMPLETE</woof>` completion marker.

## Technical Requirements
1. Enter a loop that continues until the user declines to add more tasks
2. Prompt for task description using text input (validate non-empty)
3. Build the plan prompt via `plan_prompt.buildPlanPrompt(allocator, description)`
4. If `--dry-run`, print the constructed prompt and continue the loop
5. Ensure `.ody/tasks/` directory exists (create if missing)
6. Start a spinner while the backend is working
7. Build backend command via `backend.buildOnceCommand()` with the plan prompt
8. Spawn the backend process and drain output with completion marker detection
9. Stop spinner on completion
10. Prompt "Would you like to add another plan?" (confirm prompt)
11. If yes, continue loop; if no or cancel, break and show outro
12. Support `--verbose` flag for real-time output

## Dependencies
- Interactive prompts module (`src/util/prompt.zig`) for text and confirm prompts
- Plan prompt builder (`src/builder/plan_prompt.zig`)
- Backend harness (`src/backend/harness.zig`)
- Stream processing (`src/util/stream.zig`)
- Terminal helpers (`src/util/terminal.zig`) for spinner
- Config module (`src/lib/config.zig`)

## Implementation Approach
1. Define the plan new command handler: `pub fn run(allocator, args, config) !void`
2. Print intro message
3. Enter the main loop:
   a. Prompt for description with `prompt.text("Describe the task", ...)`
   b. If null (cancelled), break
   c. Build plan prompt string
   d. If `--dry-run`, print the prompt and continue
   e. Ensure `.ody/tasks/` exists with `std.fs.cwd().makePath()`
   f. Start spinner
   g. Build and spawn backend command
   h. Drain stdout with completion marker callback
   i. Stop spinner with success message
   j. Ask "Add another plan?" with `prompt.confirm()`
   k. If false or null, break
4. Print outro message

## Acceptance Criteria

1. **Task Description Prompt**
   - Given the command is running
   - When prompted for a description
   - Then the user can enter free-form text

2. **Task File Created**
   - Given a valid description is provided
   - When the backend finishes (completion marker detected)
   - Then a new `.code-task.md` file exists in `.ody/tasks/`

3. **Loop Continues**
   - Given the user confirms "add another plan"
   - When the confirmation is "yes"
   - Then the description prompt appears again

4. **Dry Run**
   - Given `--dry-run` flag
   - When a description is entered
   - Then the plan prompt is printed without spawning the backend

5. **Cancellation**
   - Given the user presses Ctrl+C during description input
   - When cancellation is detected
   - Then the loop exits cleanly

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-6, command, plan
