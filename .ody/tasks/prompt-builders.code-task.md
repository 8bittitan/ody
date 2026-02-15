---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: Prompt Builders

## Description
Implement the three prompt builder modules that construct templated prompt strings for the AI backends: `src/builder/run_prompt.zig` (run loop and single-task prompts), `src/builder/plan_prompt.zig` (plan creation prompt), and `src/builder/edit_plan_prompt.zig` (plan edit prompt). These replace the TypeScript prompt builders in `packages/cli/src/builders/`.

## Background
The TypeScript implementation uses template literal strings with placeholder substitution (`{TASKS_DIR}`, `{VALIDATION_COMMANDS}`, `{CURRENT_DATE}`, etc.) to build prompts that instruct the AI backend on what to do. The Zig version will store these templates as comptime string constants and perform runtime substitution using `std.fmt.allocPrint` or manual string replacement. The prompts can optionally be embedded from markdown files at comptime for easier editing.

## Technical Requirements
1. **Run prompt** (`src/builder/run_prompt.zig`):
   - Port `LOOP_PROMPT` and `SINGLE_TASK_PROMPT` templates as comptime string literals
   - Implement `buildRunPrompt(allocator, options) ![]const u8` with substitution for `{TASKS_DIR}`, `{VALIDATION_COMMANDS}`, etc.
   - Port the label filter appendage logic (conditionally appending label-specific instructions)
   - Handle the distinction between loop mode and single-task mode prompt selection
2. **Plan prompt** (`src/builder/plan_prompt.zig`):
   - Port `PLAN_PROMPT` template with `{TASK_DESCRIPTION}`, `{CURRENT_DATE}`, `{TASKS_DIR}` placeholders
   - Implement `buildPlanPrompt(allocator, description) ![]const u8`
3. **Edit plan prompt** (`src/builder/edit_plan_prompt.zig`):
   - Port `EDIT_PLAN_PROMPT` template with `{FILE_PATH}` and `{FILE_CONTENT}` placeholders
   - Implement `buildEditPlanPrompt(allocator, file_path, file_content) ![]const u8`
4. Use `std.mem.replace` or manual find-and-replace for placeholder substitution
5. All returned strings are allocated and owned by the caller
6. Date formatting for `{CURRENT_DATE}` uses `YYYY-MM-DD` format

## Dependencies
- Config module (`src/lib/config.zig`) for `tasks_dir` and `validator_commands` config values
- Constants module (`src/util/constants.zig`) for `BASE_DIR`, `TASKS_DIR`
- Zig standard library (`std.fmt`, `std.mem`, `std.time`)

## Implementation Approach
1. Review the TypeScript prompt templates in `packages/cli/src/builders/` to extract exact template text
2. Define each template as a comptime `[]const u8` constant in the respective module
3. Implement a shared `replacePlaceholder(allocator, template, placeholder, value) ![]const u8` helper function
4. Chain multiple replacements for templates with multiple placeholders
5. For `buildRunPrompt()`, implement options struct that captures: tasks_dir, validation_commands, label filter, is_single_task
6. For date formatting, use `std.time.epoch` to get current time and format as `YYYY-MM-DD`
7. Ensure all returned strings are allocated with the provided allocator

## Acceptance Criteria

1. **Run Prompt Substitution**
   - Given a tasks dir of `.ody/tasks` and validator commands `["bun test", "bun lint"]`
   - When building the run prompt
   - Then the template has all placeholders replaced with actual values

2. **Plan Prompt Date**
   - Given today's date
   - When building the plan prompt with description "Add login"
   - Then `{CURRENT_DATE}` is replaced with today's date in `YYYY-MM-DD` format

3. **Edit Plan Prompt Content**
   - Given a file path and file content
   - When building the edit plan prompt
   - Then `{FILE_PATH}` and `{FILE_CONTENT}` are replaced with the provided values

4. **Label Filter Appended**
   - Given a label filter "auth"
   - When building the run prompt with a label
   - Then the label-specific instructions are appended to the prompt

5. **Single Task vs Loop**
   - Given a single task file is specified
   - When building the run prompt
   - Then the `SINGLE_TASK_PROMPT` template is used instead of `LOOP_PROMPT`

## Metadata
- **Complexity**: Low
- **Labels**: zig-rewrite, phase-4, prompt-builder
