/// Edit plan prompt builder for revising existing task files.
///
/// Constructs the prompt template that instructs the AI backend to edit
/// an existing `.code-task.md` file in place.
/// Replaces `packages/cli/src/builders/editPlanPrompt.ts`.
const std = @import("std");
const replace = @import("replace.zig").replacePlaceholder;

const edit_plan_prompt = @embedFile("./prompts/edit-plan-prompt.md");

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Build the edit plan prompt with file path and content substituted.
///
/// The caller owns the returned slice and must free it via `allocator`.
pub fn buildEditPlanPrompt(
    allocator: std.mem.Allocator,
    file_path: []const u8,
    file_content: []const u8,
) ![]const u8 {
    // {FILE_PATH}
    var prompt = try replace(allocator, edit_plan_prompt, "{FILE_PATH}", file_path);

    // {FILE_CONTENT}
    {
        const next = try replace(allocator, prompt, "{FILE_CONTENT}", file_content);
        allocator.free(prompt);
        prompt = next;
    }

    return prompt;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "buildEditPlanPrompt substitutes placeholders" {
    const allocator = std.testing.allocator;

    const prompt = try buildEditPlanPrompt(
        allocator,
        ".ody/tasks/my-task.code-task.md",
        "---\nstatus: pending\n---\n# Task: My Task",
    );
    defer allocator.free(prompt);

    // Should contain the file path.
    try std.testing.expect(std.mem.indexOf(u8, prompt, ".ody/tasks/my-task.code-task.md") != null);
    // Should contain the file content.
    try std.testing.expect(std.mem.indexOf(u8, prompt, "# Task: My Task") != null);
    // Should NOT have unreplaced placeholders.
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{FILE_PATH}") == null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{FILE_CONTENT}") == null);
    // Should end with the completion marker instruction.
    try std.testing.expect(std.mem.indexOf(u8, prompt, "<woof>COMPLETE</woof>") != null);
}

test "buildEditPlanPrompt preserves content with special characters" {
    const allocator = std.testing.allocator;

    const content = "Has `backticks` and **bold** and {BRACES}";
    const prompt = try buildEditPlanPrompt(allocator, "/tmp/test.md", content);
    defer allocator.free(prompt);

    try std.testing.expect(std.mem.indexOf(u8, prompt, content) != null);
}
