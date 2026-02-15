/// `ody task list` command – list task files filtered by status.
///
/// Scans `.code-task.md` files in the configured tasks directory, parses
/// their YAML frontmatter to extract status, and displays matching tasks
/// with their titles and filenames.
const std = @import("std");

const constants = @import("../../util/constants.zig");
const task_util = @import("../../util/task.zig");
const terminal = @import("../../util/terminal.zig");

// -----------------------------------------------------------------------
// CLI argument overrides
// -----------------------------------------------------------------------

/// CLI arguments parsed from the command-line for the `task list` command.
pub const ListArgs = struct {
    /// `--status` / `-s`: filter tasks by status (default: "pending").
    status: []const u8 = "pending",
};

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Run the `ody task list` command.
pub fn run(allocator: std.mem.Allocator, args: ListArgs) !void {
    const stdout = std.fs.File.stdout();
    const writer = stdout;
    const is_tty = terminal.isTty(stdout.handle);

    const tasks_path = task_util.resolveTasksDir();
    const status_filter = args.status;

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

    // Collect matching tasks
    var matches: std.ArrayList(TaskEntry) = .{};
    defer {
        for (matches.items) |entry| {
            allocator.free(entry.filename);
            allocator.free(entry.content);
        }
        matches.deinit(allocator);
    }

    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        if (entry.kind != .file) continue;
        if (!std.mem.endsWith(u8, entry.name, constants.TASK_FILE_EXT)) continue;

        const content = dir.readFileAlloc(allocator, entry.name, 1024 * 1024) catch continue;
        errdefer allocator.free(content);

        var frontmatter = try task_util.parseFrontmatter(allocator, content);
        defer frontmatter.deinit();

        const file_status = frontmatter.get("status") orelse continue;
        if (!std.mem.eql(u8, file_status, status_filter)) {
            allocator.free(content);
            continue;
        }

        const filename_copy = try allocator.dupe(u8, entry.name);
        errdefer allocator.free(filename_copy);

        try matches.append(allocator, .{
            .filename = filename_copy,
            .content = content,
        });
    }

    // Sort matches alphabetically by filename for stable output
    std.mem.sort(TaskEntry, matches.items, {}, struct {
        fn lessThan(_: void, a: TaskEntry, b: TaskEntry) bool {
            return std.mem.lessThan(u8, a.filename, b.filename);
        }
    }.lessThan);

    if (matches.items.len == 0) {
        var msg_buf: [128]u8 = undefined;
        const msg = std.fmt.bufPrint(&msg_buf, "No {s} tasks.", .{status_filter}) catch "No matching tasks.";
        try terminal.log(writer, msg, is_tty);
        return;
    }

    // Print header
    var header_buf: [128]u8 = undefined;
    const header = std.fmt.bufPrint(&header_buf, "Found {d} {s} task{s}", .{
        matches.items.len,
        status_filter,
        if (matches.items.len == 1) "" else "s",
    }) catch "Tasks:";
    try terminal.log(writer, header, is_tty);
    try writer.writeAll("\n");

    // Print each matching task
    for (matches.items) |entry| {
        const title = task_util.parseTitle(entry.content) orelse "(untitled)";

        // Print: "  title  (filename)"
        try writer.writeAll("  ");
        try terminal.bold(writer, title, is_tty);
        try writer.writeAll("  ");
        try terminal.dim(writer, entry.filename, is_tty);
        try writer.writeAll("\n");
    }
}

// -----------------------------------------------------------------------
// Internal types
// -----------------------------------------------------------------------

const TaskEntry = struct {
    filename: []const u8,
    content: []const u8,
};

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "ListArgs has sensible defaults" {
    const args = ListArgs{};
    try std.testing.expectEqualStrings("pending", args.status);
}
