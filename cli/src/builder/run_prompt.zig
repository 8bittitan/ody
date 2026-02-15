/// Run prompt builder for the agent execution loop.
///
/// Constructs templated prompt strings for both loop mode (scan tasks dir
/// for pending tasks) and single-task mode (operate on a specific file).
/// Replaces `packages/cli/src/builders/runPrompt.ts`.
const std = @import("std");
const config = @import("../lib/config.zig");
const constants = @import("../util/constants.zig");
const task_util = @import("../util/task.zig");
const replace = @import("replace.zig").replacePlaceholder;

const loop_prompt = @embedFile("./prompts/loop-prompt.md");
const single_task_prompt = @embedFile("./prompts/single_task_prompt.md");

const PROGRESS_FILE = ".ody/progress.txt";

// -----------------------------------------------------------------------
// Options
// -----------------------------------------------------------------------

/// Options for building a run prompt.
pub const RunPromptOptions = struct {
    /// When set, use the single-task prompt for this specific file.
    task_file: ?[]const u8 = null,

    /// When set and non-empty, append a label filter section listing
    /// only these task filenames.
    task_files: ?[]const []const u8 = null,
};

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Build the run prompt string with all placeholders substituted.
///
/// Selects between `SINGLE_TASK_PROMPT` (when `options.task_file` is set)
/// and `LOOP_PROMPT` (otherwise). When `options.task_files` is non-empty,
/// a label filter section is appended listing the allowed filenames.
///
/// The caller owns the returned slice and must free it via `allocator`.
pub fn buildRunPrompt(allocator: std.mem.Allocator, options: RunPromptOptions) ![]const u8 {
    const cfg = config.all() orelse {
        // Fallback: use defaults if config is not loaded.
        return buildWithValues(allocator, options, constants.TASKS_DIR, &.{}, false);
    };

    return buildWithValues(
        allocator,
        options,
        cfg.tasks_dir,
        cfg.validator_commands,
        cfg.should_commit,
    );
}

// -----------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------

fn buildWithValues(
    allocator: std.mem.Allocator,
    options: RunPromptOptions,
    tasks_dir_name: []const u8,
    validator_commands: []const []const u8,
    should_commit: bool,
) ![]const u8 {
    // Resolve full tasks path (e.g. ".ody/tasks").
    const tasks_dir = task_util.resolveTasksDir();

    // Build the comma-separated validation commands string.
    const validation_str = try joinCommaSep(allocator, validator_commands);
    defer allocator.free(validation_str);
    _ = tasks_dir_name;

    const commit_str: []const u8 = if (should_commit) "true" else "false";

    // Select the base template.
    var prompt: []const u8 = if (options.task_file != null)
        single_task_prompt
    else
        loop_prompt;

    // --- Placeholder substitutions ---

    // {TASK_FILE} (single-task mode only)
    if (options.task_file) |tf| {
        const next = try replace(allocator, prompt, "{TASK_FILE}", tf);
        prompt = next;
    }

    // {TASKS_DIR} (appears multiple times in loop prompt)
    {
        const next = try replaceAll(allocator, prompt, "{TASKS_DIR}", tasks_dir);
        if (prompt.ptr != loop_prompt.ptr and prompt.ptr != single_task_prompt.ptr) allocator.free(@constCast(prompt));
        prompt = next;
    }

    // {VALIDATION_COMMANDS}
    {
        const next = try replace(allocator, prompt, "{VALIDATION_COMMANDS}", validation_str);
        allocator.free(@constCast(prompt));
        prompt = next;
    }

    // {PROGRESS_FILE}
    {
        const next = try replace(allocator, prompt, "{PROGRESS_FILE}", PROGRESS_FILE);
        allocator.free(@constCast(prompt));
        prompt = next;
    }

    // {SHOULD_COMMIT}
    {
        const next = try replace(allocator, prompt, "{SHOULD_COMMIT}", commit_str);
        allocator.free(@constCast(prompt));
        prompt = next;
    }

    // --- Optional label filter ---
    if (options.task_files) |files| {
        if (files.len > 0) {
            const label_section = try buildLabelFilter(allocator, files);
            defer allocator.free(label_section);

            const combined = try std.mem.concat(allocator, u8, &.{ prompt, label_section });
            allocator.free(@constCast(prompt));
            prompt = combined;
        }
    }

    return prompt;
}

/// Build the label filter section appended to the loop prompt.
fn buildLabelFilter(allocator: std.mem.Allocator, files: []const []const u8) ![]const u8 {
    var list: std.ArrayList(u8) = .{};
    errdefer list.deinit(allocator);

    try list.appendSlice(allocator, "\n\nLABEL FILTER\nOnly consider the following task files:\n");
    for (files) |f| {
        try list.appendSlice(allocator, "  - ");
        try list.appendSlice(allocator, f);
        try list.append(allocator, '\n');
    }

    return list.toOwnedSlice(allocator);
}

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

/// Join string slices with ", " separator. Returns an empty string for
/// an empty slice.
fn joinCommaSep(allocator: std.mem.Allocator, items: []const []const u8) ![]const u8 {
    if (items.len == 0) return try allocator.dupe(u8, "");

    var total: usize = 0;
    for (items, 0..) |item, i| {
        total += item.len;
        if (i < items.len - 1) total += 2; // ", "
    }

    const buf = try allocator.alloc(u8, total);
    var pos: usize = 0;
    for (items, 0..) |item, i| {
        @memcpy(buf[pos..][0..item.len], item);
        pos += item.len;
        if (i < items.len - 1) {
            buf[pos] = ',';
            buf[pos + 1] = ' ';
            pos += 2;
        }
    }

    return buf;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "buildRunPrompt loop mode produces valid prompt" {
    const allocator = std.testing.allocator;

    // Ensure config is not loaded so we get defaults.
    config.reset();

    const prompt = try buildRunPrompt(allocator, .{});
    defer allocator.free(prompt);

    // Should contain the default tasks dir.
    try std.testing.expect(std.mem.indexOf(u8, prompt, ".ody/tasks") != null);
    // Should contain the shouldCommit placeholder replaced with "false".
    try std.testing.expect(std.mem.indexOf(u8, prompt, "shouldCommit: false") != null);
    // Should contain the progress file.
    try std.testing.expect(std.mem.indexOf(u8, prompt, PROGRESS_FILE) != null);
    // Should NOT contain any unreplaced placeholders.
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{TASKS_DIR}") == null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{VALIDATION_COMMANDS}") == null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{SHOULD_COMMIT}") == null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{PROGRESS_FILE}") == null);
}

test "buildRunPrompt single-task mode uses task file template" {
    const allocator = std.testing.allocator;
    config.reset();

    const prompt = try buildRunPrompt(allocator, .{
        .task_file = ".ody/tasks/my-feature.code-task.md",
    });
    defer allocator.free(prompt);

    try std.testing.expect(std.mem.indexOf(u8, prompt, ".ody/tasks/my-feature.code-task.md") != null);
    // Should NOT mention scanning the tasks directory.
    try std.testing.expect(std.mem.indexOf(u8, prompt, "Look in the") == null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "{TASK_FILE}") == null);
}

test "buildRunPrompt with label filter appends section" {
    const allocator = std.testing.allocator;
    config.reset();

    const files = &[_][]const u8{ "auth-login.code-task.md", "auth-signup.code-task.md" };
    const prompt = try buildRunPrompt(allocator, .{
        .task_files = files,
    });
    defer allocator.free(prompt);

    try std.testing.expect(std.mem.indexOf(u8, prompt, "LABEL FILTER") != null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "  - auth-login.code-task.md") != null);
    try std.testing.expect(std.mem.indexOf(u8, prompt, "  - auth-signup.code-task.md") != null);
}

test "joinCommaSep empty" {
    const allocator = std.testing.allocator;
    const result = try joinCommaSep(allocator, &.{});
    defer allocator.free(result);
    try std.testing.expectEqualStrings("", result);
}

test "joinCommaSep multiple" {
    const allocator = std.testing.allocator;
    const items = &[_][]const u8{ "bun test", "bun lint" };
    const result = try joinCommaSep(allocator, items);
    defer allocator.free(result);
    try std.testing.expectEqualStrings("bun test, bun lint", result);
}
