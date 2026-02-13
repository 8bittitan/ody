---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Plan Edit Command Implementation

## Description
Implement the `ody plan edit` command in `src/cmd/plan/edit.zig` that allows users to select an existing pending task file and have the AI backend revise it based on the edit plan prompt template.

## Background
The TypeScript `ody plan edit` command scans for pending `.code-task.md` files, presents them in a selection menu, reads the selected file's content, builds an edit prompt that includes the file path and content, and spawns the backend to revise the task. This allows iterative refinement of task definitions before execution.

## Technical Requirements
1. Scan `.code-task.md` files in the configured tasks directory using `std.fs.Dir.iterate()`
2. Filter only for tasks with `status: pending` in their frontmatter
3. Read each matching file and parse its title using `task.parseTitle()`
4. Present a select prompt with task titles (and filenames for disambiguation)
5. Read the selected file's full content
6. Build the edit plan prompt via `edit_plan_prompt.buildEditPlanPrompt(allocator, file_path, file_content)`
7. If `--dry-run`, print the prompt and return
8. Start spinner, spawn backend with the edit prompt, drain with completion detection
9. Stop spinner on completion
10. Support `--verbose` flag for real-time output
11. Handle the case where no pending tasks exist (print message and return)

## Dependencies
- Task file parsing module (`src/util/task.zig`) for frontmatter parsing and title extraction
- Interactive prompts module (`src/util/prompt.zig`) for select prompt
- Edit plan prompt builder (`src/builder/edit_plan_prompt.zig`)
- Backend harness (`src/backend/harness.zig`)
- Stream processing (`src/util/stream.zig`)
- Terminal helpers (`src/util/terminal.zig`) for spinner
- Config module (`src/lib/config.zig`)

## Implementation Approach
1. Define the plan edit command handler: `pub fn run(allocator, args, config) !void`
2. Resolve the tasks directory path
3. Iterate over files matching `*.code-task.md`
4. For each file:
   a. Read content
   b. Parse frontmatter to check `status`
   c. If `status == "pending"`, parse title and add to candidate list
5. If no pending tasks found, print "No pending tasks to edit." and return
6. Build a select options list from the candidates (label = title, value = file path)
7. Show select prompt
8. If cancelled, return cleanly
9. Read the selected file's full content
10. Build the edit plan prompt
11. If `--dry-run`, print and return
12. Start spinner, spawn backend, drain output, stop spinner
13. Print success message

## Acceptance Criteria

1. **Pending Tasks Listed**
   - Given multiple `.code-task.md` files with mixed statuses
   - When the select prompt appears
   - Then only pending tasks are shown as options

2. **Task Selection**
   - Given the select prompt with pending tasks
   - When the user selects a task
   - Then the correct file is read for editing

3. **Edit Prompt Built**
   - Given a selected task file
   - When building the edit prompt
   - Then `{FILE_PATH}` and `{FILE_CONTENT}` are correctly substituted

4. **No Pending Tasks**
   - Given all tasks are completed or in-progress
   - When running `ody plan edit`
   - Then "No pending tasks to edit." is displayed

5. **Dry Run**
   - Given `--dry-run` flag
   - When a task is selected
   - Then the edit prompt is printed without spawning the backend

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-6, command, plan
