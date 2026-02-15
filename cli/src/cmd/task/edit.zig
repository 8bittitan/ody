/// `ody task edit` command – select and revise an existing pending task.
///
/// Scans `.code-task.md` files in the configured tasks directory, filters
/// for pending tasks, presents a selection menu, then spawns the AI backend
/// with the edit plan prompt to revise the selected task in place.
///
/// Supports `--dry-run` and `--verbose` flags.
const std = @import("std");

const config_mod = @import("../../lib/config.zig");
const constants = @import("../../util/constants.zig");
const edit_plan_prompt = @import("../../builder/edit_plan_prompt.zig");
const harness_mod = @import("../../backend/harness.zig");
const prompt = @import("../../util/prompt.zig");
const spawn_mod = @import("../../util/spawn.zig");
const stream_mod = @import("../../util/stream.zig");
const task_util = @import("../../util/task.zig");
const terminal = @import("../../util/terminal.zig");

// -----------------------------------------------------------------------
// CLI argument overrides
// -----------------------------------------------------------------------

/// CLI arguments parsed from the command-line for the `task edit` command.
pub const EditArgs = struct {
    /// `--dry-run`: print the constructed prompt without spawning the backend.
    dry_run: bool = false,

    /// `--verbose`: print backend output in real-time.
    verbose: bool = false,
};

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Run the `ody task edit` command.
pub fn run(allocator: std.mem.Allocator, args: EditArgs) !void {
    const stdout = std.fs.File.stdout();
    const writer = stdout;
    const is_tty = terminal.isTty(stdout.handle);

    const cfg = config_mod.all() orelse {
        try terminal.err(writer, "No configuration found. Run `ody init` first.", is_tty);
        return;
    };

    try terminal.intro(writer, "Edit an existing task plan", is_tty);

    const tasks_path = task_util.resolveTasksDir();

    // Open the tasks directory.
    var dir = std.fs.cwd().openDir(tasks_path, .{ .iterate = true }) catch |open_err| {
        switch (open_err) {
            error.FileNotFound => {
                try terminal.warn(writer, "Tasks directory not found. Run `ody plan` to create tasks.", is_tty);
                return;
            },
            else => return open_err,
        }
    };
    defer dir.close();

    // Collect pending tasks.
    var candidates: std.ArrayList(TaskCandidate) = .{};
    defer {
        for (candidates.items) |c| {
            allocator.free(c.filename);
        }
        candidates.deinit(allocator);
    }

    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        if (entry.kind != .file) continue;
        if (!std.mem.endsWith(u8, entry.name, constants.TASK_FILE_EXT)) continue;

        // Read file content to parse frontmatter.
        const content = dir.readFileAlloc(allocator, entry.name, 1024 * 1024) catch continue;
        defer allocator.free(content);

        var frontmatter = try task_util.parseFrontmatter(allocator, content);
        defer frontmatter.deinit();

        const status = frontmatter.get("status") orelse continue;
        if (!std.mem.eql(u8, status, "pending")) continue;

        // Parse the title for display.
        const title = task_util.parseTitle(content) orelse "(untitled)";

        const filename_copy = try allocator.dupe(u8, entry.name);
        errdefer allocator.free(filename_copy);

        // Build label: "Title  (filename.code-task.md)"
        const label = try std.fmt.allocPrint(allocator, "{s}  ({s})", .{ title, entry.name });
        errdefer allocator.free(label);

        try candidates.append(allocator, .{
            .filename = filename_copy,
            .label = label,
        });
    }

    // Sort candidates alphabetically by filename for stable order.
    std.mem.sort(TaskCandidate, candidates.items, {}, struct {
        fn lessThan(_: void, a: TaskCandidate, b: TaskCandidate) bool {
            return std.mem.lessThan(u8, a.filename, b.filename);
        }
    }.lessThan);

    if (candidates.items.len == 0) {
        try terminal.log(writer, "No pending tasks to edit.", is_tty);
        return;
    }

    // Build select options from candidates.
    // We use the index as the value type so we can look up the filename after selection.
    var options = try allocator.alloc(prompt.Option(usize), candidates.items.len);
    defer allocator.free(options);

    for (candidates.items, 0..) |c, i| {
        options[i] = .{ .label = c.label, .value = i };
    }

    const selected = try prompt.selectPrompt(
        usize,
        "Select a task plan to edit",
        options,
    );

    if (selected == null) {
        try terminal.outro(writer, "Edit cancelled.", is_tty);
        return;
    }

    const sel_idx = selected.?;
    const sel_filename = candidates.items[sel_idx].filename;

    // Read the full content of the selected file.
    const file_content = dir.readFileAlloc(allocator, sel_filename, 1024 * 1024) catch |read_err| {
        try terminal.err(writer, "Failed to read selected task file.", is_tty);
        return read_err;
    };
    defer allocator.free(file_content);

    // Build the full file path for the prompt (tasks_path/filename).
    const file_path = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ tasks_path, sel_filename });
    defer allocator.free(file_path);

    // Build the edit plan prompt.
    const prompt_text = try edit_plan_prompt.buildEditPlanPrompt(allocator, file_path, file_content);
    defer allocator.free(prompt_text);

    // Dry-run mode.
    if (args.dry_run) {
        try terminal.log(writer, "Prompt (dry run):", is_tty);
        try writer.writeAll(prompt_text);
        try writer.writeAll("\n");
        try terminal.outro(writer, "Dry run complete", is_tty);
        return;
    }

    // Build backend command.
    const backend = harness_mod.Backend.fromConfig(cfg);
    const cmd_args = try backend.buildOnceCommand(allocator, prompt_text);
    defer {
        if (cmd_args.len > 0) allocator.free(cmd_args[cmd_args.len - 1]);
        allocator.free(cmd_args);
    }

    // Start spinner (unless verbose).
    var spinner: ?terminal.Spinner = null;
    if (!args.verbose) {
        spinner = terminal.Spinner.init(writer, is_tty);
        spinner.?.start("Running editor agent");
    }

    // Stream options with completion marker detection.
    const stdout_options = stream_mod.StreamOptions{
        .should_print = args.verbose,
        .on_chunk = &checkCompletion,
    };

    const stderr_options = stream_mod.StreamOptions{
        .should_print = args.verbose,
    };

    // Spawn and run the backend process.
    const result = spawn_mod.runPipedCommand(
        allocator,
        cmd_args,
        stdout_options,
        stderr_options,
    ) catch {
        if (spinner) |*s| {
            s.stop("Backend process failed");
        } else {
            try terminal.err(writer, "Backend process failed.", is_tty);
        }
        return;
    };
    defer result.deinit(allocator);

    // Stop spinner.
    if (spinner) |*s| {
        s.stop("Task plan updated");
    }

    if (!result.succeeded()) {
        try terminal.err(writer, "Failed to edit task.", is_tty);
        return;
    }

    try terminal.outro(writer, "Edit complete", is_tty);
}

// -----------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------

const TaskCandidate = struct {
    filename: []const u8,
    /// Display label for the select prompt (title + filename).
    /// Owned by the same allocator as `filename`.
    label: []const u8,
};

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/// Callback for stream draining: stop when the completion marker is found.
fn checkCompletion(accumulated: []const u8) bool {
    return stream_mod.containsCompletionMarker(accumulated);
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "EditArgs defaults are sensible" {
    const args = EditArgs{};
    try std.testing.expect(!args.dry_run);
    try std.testing.expect(!args.verbose);
}

test "checkCompletion detects marker" {
    try std.testing.expect(checkCompletion("output <woof>COMPLETE</woof> trailing"));
    try std.testing.expect(checkCompletion("<woof>COMPLETE</woof>"));
}

test "checkCompletion returns false without marker" {
    try std.testing.expect(!checkCompletion("just some output"));
    try std.testing.expect(!checkCompletion(""));
}
