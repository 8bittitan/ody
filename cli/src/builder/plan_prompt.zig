/// Plan prompt builder for generating new code task files.
///
/// Constructs the prompt template that instructs the AI backend to create
/// a structured `.code-task.md` file from a user-provided description.
/// Replaces `packages/cli/src/builders/planPrompt.ts`.
const std = @import("std");
const config = @import("../lib/config.zig");
const constants = @import("../util/constants.zig");
const task_util = @import("../util/task.zig");
const replace = @import("replace.zig").replacePlaceholder;

// -----------------------------------------------------------------------
// Template
// -----------------------------------------------------------------------

const PLAN_PROMPT =
    \\OVERVIEW
    \\This SOP generates structured code task files from rough descriptions, ideas, or PDD implementation plans. It automatically detects the input type and creates properly formatted code task files following the code task format specification. For PDD plans, it processes implementation steps one at a time to allow for learning and adaptation between steps.
    \\
    \\RULES
    \\- Create EXACTLY ONE task as a markdown file
    \\- The file MUST be written to the {TASKS_DIR} directory
    \\- The filename MUST use kebab-case and end with .code-task.md (e.g., {TASKS_DIR}/add-email-validation.code-task.md)
    \\- The filename should be descriptive of the task content
    \\- Take the user provided steps description and create your own detailed implementation approach
    \\- All sections in the template below are REQUIRED — do not skip any
    \\
    \\FILE FORMAT
    \\The file MUST follow this exact structure:
    \\
    \\```markdown
    \\---
    \\status: pending
    \\created: {CURRENT_DATE}
    \\started: null
    \\completed: null
    \\---
    \\# Task: [Concise Task Name]
    \\
    \\## Description
    \\[A clear description of what needs to be implemented and why]
    \\
    \\## Background
    \\[Relevant context and background information needed to understand the task]
    \\
    \\## Technical Requirements
    \\1. [First requirement]
    \\2. [Second requirement]
    \\3. [Third requirement]
    \\
    \\## Dependencies
    \\- [First dependency with details]
    \\- [Second dependency with details]
    \\
    \\## Implementation Approach
    \\1. [First implementation step or approach]
    \\2. [Second implementation step or approach]
    \\3. [Third implementation step or approach]
    \\
    \\## Acceptance Criteria
    \\
    \\1. **[Criterion Name]**
    \\   - Given [precondition]
    \\   - When [action]
    \\   - Then [expected result]
    \\
    \\2. **[Another Criterion]**
    \\   - Given [precondition]
    \\   - When [action]
    \\   - Then [expected result]
    \\
    \\## Metadata
    \\- **Complexity**: [Low/Medium/High]
    \\- **Labels**: [Comma-separated list of labels]
    \\```
    \\
    \\USER TASK DESCRIPTION
    \\{TASK_DESCRIPTION}
    \\
    \\OUTPUT
    \\When finished writing the task file, output the text: <woof>COMPLETE</woof>.
;

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Build the plan prompt with all placeholders substituted.
///
/// Substitutes `{TASK_DESCRIPTION}`, `{CURRENT_DATE}`, and `{TASKS_DIR}`
/// in the template.
///
/// The caller owns the returned slice and must free it via `allocator`.
pub fn buildPlanPrompt(allocator: std.mem.Allocator, description: []const u8) ![]const u8 {
    const tasks_dir = task_util.resolveTasksDir();
    const date = try currentDateString(allocator);
    defer allocator.free(date);

    // {TASKS_DIR} appears 3 times -- replace all.
    var prompt: []const u8 = try replaceAll(allocator, PLAN_PROMPT, "{TASKS_DIR}", tasks_dir);

    // {CURRENT_DATE}
    {
        const next = try replace(allocator, prompt, "{CURRENT_DATE}", date);
        allocator.free(@constCast(prompt));
        prompt = next;
    }

    // {TASK_DESCRIPTION}
    {
        const next = try replace(allocator, prompt, "{TASK_DESCRIPTION}", description);
        allocator.free(@constCast(prompt));
        prompt = next;
    }

    return prompt;
}

// -----------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------

/// Replace ALL occurrences of `placeholder` in `template`.
fn replaceAll(allocator: std.mem.Allocator, template: []const u8, placeholder: []const u8, value: []const u8) ![]const u8 {
    var result: []const u8 = try allocator.dupe(u8, template);
    while (std.mem.indexOf(u8, result, placeholder)) |_| {
        const next = try replace(allocator, result, placeholder, value);
        allocator.free(@constCast(result));
        result = next;
    }
    return result;
}

/// Return today's date as a "YYYY-MM-DD" string.
fn currentDateString(allocator: std.mem.Allocator) ![]const u8 {
    const ts = std.time.timestamp();
    const epoch_secs: u64 = @intCast(ts);
    const epoch_day = std.time.epoch.EpochDay{ .day = @intCast(epoch_secs / std.time.s_per_day) };
    const ymd = epoch_day.calculateYearDay().calculateMonthDay();
    const year: u16 = epoch_day.calculateYearDay().year;
    const month: u8 = @intCast(@intFromEnum(ymd.month));
    const day: u8 = @intCast(ymd.day_index + 1);

    return std.fmt.allocPrint(allocator, "{d:0>4}-{d:0>2}-{d:0>2}", .{
        year,
        month,
        day,
    });
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "buildPlanPrompt substitutes all placeholders" {
    const allocator = std.testing.allocator;
    config.reset();

    const prompt = try buildPlanPrompt(allocator, "Add login feature");
    defer allocator.free(prompt);

    // Should contain the description.
    try std.testing.expect(std.mem.indexOf(u8, prompt, "Add login feature") != null);
    // Should contain the tasks dir.
    try std.testing.expect(std.mem.indexOf(u8, prompt, ".ody/tasks") != null);
    // Should NOT have unreplaced placeholders.
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{TASK_DESCRIPTION}") == null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{CURRENT_DATE}") == null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{TASKS_DIR}") == null);
}

test "currentDateString format" {
    const allocator = std.testing.allocator;
    const date = try currentDateString(allocator);
    defer allocator.free(date);

    // Should be exactly 10 characters: YYYY-MM-DD.
    try std.testing.expectEqual(@as(usize, 10), date.len);
    try std.testing.expectEqual(@as(u8, '-'), date[4]);
    try std.testing.expectEqual(@as(u8, '-'), date[7]);
}
