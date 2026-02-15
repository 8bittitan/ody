/// `ody task compact` command – archive completed tasks.
///
/// Scans `.code-task.md` files in the configured tasks directory, finds
/// completed tasks with a completion date, generates a markdown archive
/// document in `.ody/history/`, and deletes the original task files.
const std = @import("std");

const constants = @import("../../util/constants.zig");
const task_util = @import("../../util/task.zig");
const terminal = @import("../../util/terminal.zig");
const types = @import("../../types.zig");

const CompletedTask = types.CompletedTask;

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Run the `ody task compact` command.
pub fn run(allocator: std.mem.Allocator) !void {
    const stdout = std.fs.File.stdout();
    const writer = stdout;
    const is_tty = terminal.isTty(stdout.handle);

    const tasks_path = task_util.resolveTasksDir();

    var dir = std.fs.cwd().openDir(tasks_path, .{ .iterate = true }) catch |open_err| {
        switch (open_err) {
            error.FileNotFound => {
                try terminal.warn(writer, "Tasks directory not found. Nothing to compact.", is_tty);
                return;
            },
            else => return open_err,
        }
    };
    defer dir.close();

    // Collect completed tasks
    var completed_tasks: std.ArrayList(CompletedTask) = .{};
    defer {
        for (completed_tasks.items) |t| {
            allocator.free(t.filename);
            allocator.free(t.title);
            allocator.free(t.description);
            allocator.free(t.completed);
        }
        completed_tasks.deinit(allocator);
    }

    // Track file contents separately for cleanup
    var file_contents: std.ArrayList([]const u8) = .{};
    defer {
        for (file_contents.items) |content| allocator.free(content);
        file_contents.deinit(allocator);
    }

    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        if (entry.kind != .file) continue;
        if (!std.mem.endsWith(u8, entry.name, constants.TASK_FILE_EXT)) continue;

        const content = dir.readFileAlloc(allocator, entry.name, 1024 * 1024) catch continue;
        errdefer allocator.free(content);

        var frontmatter = try task_util.parseFrontmatter(allocator, content);
        defer frontmatter.deinit();

        const file_status = frontmatter.get("status") orelse {
            allocator.free(content);
            continue;
        };
        if (!std.mem.eql(u8, file_status, "completed")) {
            allocator.free(content);
            continue;
        }

        const completed_date = frontmatter.get("completed") orelse {
            allocator.free(content);
            continue;
        };
        // Skip tasks where completed is "null" (not actually completed)
        if (std.mem.eql(u8, completed_date, "null")) {
            allocator.free(content);
            continue;
        }

        const title_raw = task_util.parseTitle(content) orelse "(untitled)";
        const desc_raw = task_util.parseDescription(allocator, content) catch null;

        // Dupe all strings since frontmatter values point into content
        const filename_owned = try allocator.dupe(u8, entry.name);
        errdefer allocator.free(filename_owned);
        const title_owned = try allocator.dupe(u8, title_raw);
        errdefer allocator.free(title_owned);
        const completed_owned = try allocator.dupe(u8, completed_date);
        errdefer allocator.free(completed_owned);
        const desc_owned = if (desc_raw) |d| d else try allocator.dupe(u8, "No description.");

        try completed_tasks.append(allocator, .{
            .filename = filename_owned,
            .title = title_owned,
            .description = desc_owned,
            .completed = completed_owned,
        });

        // Keep content alive until we're done using frontmatter values
        try file_contents.append(allocator, content);
    }

    if (completed_tasks.items.len == 0) {
        try terminal.log(writer, "No completed tasks to archive.", is_tty);
        return;
    }

    // Sort by completion date (ascending)
    std.mem.sort(CompletedTask, completed_tasks.items, {}, struct {
        fn lessThan(_: void, a: CompletedTask, b: CompletedTask) bool {
            return std.mem.lessThan(u8, a.completed, b.completed);
        }
    }.lessThan);

    // Build the archive markdown document
    var archive: std.ArrayList(u8) = .{};
    defer archive.deinit(allocator);

    const archive_writer = archive.writer(allocator);
    try archive_writer.writeAll("# Archived Tasks\n\n");
    try archive_writer.writeAll("Tasks archived by `ody task compact`.\n\n");
    try archive_writer.writeAll("---\n\n");

    for (completed_tasks.items) |t| {
        try archive_writer.writeAll("## ");
        try archive_writer.writeAll(t.title);
        try archive_writer.writeAll("\n\n");
        try archive_writer.writeAll("- **File**: `");
        try archive_writer.writeAll(t.filename);
        try archive_writer.writeAll("`\n");
        try archive_writer.writeAll("- **Completed**: ");
        try archive_writer.writeAll(t.completed);
        try archive_writer.writeAll("\n\n");
        try archive_writer.writeAll(t.description);
        try archive_writer.writeAll("\n\n---\n\n");
    }

    // Generate archive filename with today's date
    const date_str = todayDateStr();
    var archive_filename_buf: [64]u8 = undefined;
    const archive_filename = std.fmt.bufPrint(&archive_filename_buf, "archive-{s}.md", .{date_str}) catch "archive.md";

    // Create .ody/history/ directory
    const history_path = constants.BASE_DIR ++ "/" ++ constants.HISTORY_DIR;
    std.fs.cwd().makePath(history_path) catch |make_err| {
        try terminal.err(writer, "Failed to create history directory.", is_tty);
        return make_err;
    };

    // Write archive file
    var archive_path_buf: [256]u8 = undefined;
    const archive_path = std.fmt.bufPrint(&archive_path_buf, "{s}/{s}", .{ history_path, archive_filename }) catch {
        try terminal.err(writer, "Archive path too long.", is_tty);
        return;
    };

    const cwd = std.fs.cwd();
    const archive_file = cwd.createFile(archive_path, .{}) catch |create_err| {
        try terminal.err(writer, "Failed to create archive file.", is_tty);
        return create_err;
    };
    defer archive_file.close();
    archive_file.writeAll(archive.items) catch |write_err| {
        try terminal.err(writer, "Failed to write archive content.", is_tty);
        return write_err;
    };

    // Delete original completed task files
    var deleted: usize = 0;
    for (completed_tasks.items) |t| {
        dir.deleteFile(t.filename) catch continue;
        deleted += 1;
    }

    // Print summary
    var summary_buf: [256]u8 = undefined;
    const summary = std.fmt.bufPrint(&summary_buf, "Archived {d} completed task{s} to {s}", .{
        deleted,
        if (deleted == 1) "" else "s",
        archive_path,
    }) catch "Tasks archived.";
    try terminal.log(writer, summary, is_tty);
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/// Return today's date as a YYYY-MM-DD string using a static buffer.
fn todayDateStr() []const u8 {
    const epoch_secs: u64 = @intCast(std.time.timestamp());
    const epoch_seconds = std.time.epoch.EpochSeconds{ .secs = epoch_secs };
    const epoch_day = epoch_seconds.getEpochDay();
    const year_day = epoch_day.calculateYearDay();
    const month_day = year_day.calculateMonthDay();

    const date_buf = struct {
        var buf: [10]u8 = undefined;
    };

    _ = std.fmt.bufPrint(&date_buf.buf, "{d:0>4}-{d:0>2}-{d:0>2}", .{
        year_day.year,
        @as(u9, @intFromEnum(month_day.month)),
        @as(u9, month_day.day_index + 1),
    }) catch {};

    return &date_buf.buf;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "todayDateStr returns valid date format" {
    const date = todayDateStr();
    try std.testing.expectEqual(@as(usize, 10), date.len);
    // Should be in YYYY-MM-DD format
    try std.testing.expect(date[4] == '-');
    try std.testing.expect(date[7] == '-');
}
