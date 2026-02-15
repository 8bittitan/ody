/// Task file parsing utilities for `.code-task.md` files.
///
/// Provides functions for parsing YAML frontmatter, extracting titles,
/// descriptions, and labels from task files, as well as scanning the
/// filesystem for task files filtered by label.
///
/// Ported from `packages/cli/src/util/task.ts`.
const std = @import("std");
const constants = @import("constants.zig");
const config = @import("../lib/config.zig");

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Parse YAML frontmatter between `---` delimiters into key-value pairs.
///
/// Given content like:
/// ```
/// ---
/// status: pending
/// created: 2026-01-01
/// ---
/// ```
/// Returns a `StringHashMap` with `"status" -> "pending"` and
/// `"created" -> "2026-01-01"`.
///
/// Returns an empty map if no valid frontmatter is found.
pub fn parseFrontmatter(allocator: std.mem.Allocator, content: []const u8) !std.StringHashMap([]const u8) {
    var map = std.StringHashMap([]const u8).init(allocator);
    errdefer map.deinit();

    // Frontmatter must start with "---\n"
    const opening = "---\n";
    if (!std.mem.startsWith(u8, content, opening)) return map;

    // Find the closing "---" delimiter (search after the opening)
    const after_opening = content[opening.len..];
    const closing_idx = std.mem.indexOf(u8, after_opening, "\n---") orelse return map;

    const frontmatter_body = after_opening[0..closing_idx];

    var lines = std.mem.splitScalar(u8, frontmatter_body, '\n');
    while (lines.next()) |line| {
        const trimmed = std.mem.trim(u8, line, " \t\r");
        if (trimmed.len == 0) continue;

        // Find the first colon separator
        const sep = std.mem.indexOfScalar(u8, trimmed, ':') orelse continue;

        const key = std.mem.trim(u8, trimmed[0..sep], " \t");
        const value = std.mem.trim(u8, trimmed[sep + 1 ..], " \t");

        if (key.len == 0) continue;

        try map.put(key, value);
    }

    return map;
}

/// Extract the task title from a `# Task: ...` or `# ...` heading.
///
/// Returns `null` if no suitable heading is found.
pub fn parseTitle(content: []const u8) ?[]const u8 {
    var lines = std.mem.splitScalar(u8, content, '\n');
    while (lines.next()) |line| {
        const trimmed = std.mem.trim(u8, line, " \t\r");

        // Check for "# Task: ..." first
        if (std.mem.startsWith(u8, trimmed, "# Task: ")) {
            const title = std.mem.trim(u8, trimmed["# Task: ".len..], " \t");
            if (title.len > 0) return title;
        }

        // Check for "# ..." (any level-1 heading)
        if (std.mem.startsWith(u8, trimmed, "# ") and !std.mem.startsWith(u8, trimmed, "## ")) {
            const title = std.mem.trim(u8, trimmed["# ".len..], " \t");
            if (title.len > 0) return title;
        }
    }
    return null;
}

/// Extract the `## Description` section content, condensed to 2-3 sentences.
///
/// Returns `null` if no `## Description` heading is found.
pub fn parseDescription(allocator: std.mem.Allocator, content: []const u8) !?[]const u8 {
    // Find "## Description" heading
    const heading = "## Description";
    const heading_idx = findHeading(content, heading) orelse return null;

    // Extract content from after the heading line to the next ## heading
    const after_heading = content[heading_idx + heading.len ..];

    // Skip the rest of the heading line (past the newline)
    const body_start_idx = std.mem.indexOfScalar(u8, after_heading, '\n') orelse return null;
    const body_start = after_heading[body_start_idx + 1 ..];

    // Find the end: next "## " heading or end of content
    const body_end = findNextSection(body_start) orelse body_start.len;
    const raw_body = std.mem.trim(u8, body_start[0..body_end], " \t\r\n");

    if (raw_body.len == 0) return null;

    // Condense to 2-3 sentences
    return try condenseSentences(allocator, raw_body, 3);
}

/// Extract comma-separated labels from the `**Labels**: ...` metadata line.
///
/// Returns an empty slice if no labels are found.
pub fn parseLabels(allocator: std.mem.Allocator, content: []const u8) ![][]const u8 {
    const marker = "**Labels**:";

    // Search for the labels marker
    const marker_idx = std.mem.indexOf(u8, content, marker) orelse return &.{};

    const after_marker = content[marker_idx + marker.len ..];

    // Get rest of the line
    const eol = std.mem.indexOfScalar(u8, after_marker, '\n') orelse after_marker.len;
    const labels_text = std.mem.trim(u8, after_marker[0..eol], " \t\r");

    if (labels_text.len == 0) return &.{};

    // Split by comma and trim each label
    var labels: std.ArrayList([]const u8) = .{};
    errdefer labels.deinit(allocator);

    var parts = std.mem.splitScalar(u8, labels_text, ',');
    while (parts.next()) |part| {
        const label = std.mem.trim(u8, part, " \t\r");
        if (label.len > 0) {
            try labels.append(allocator, label);
        }
    }

    return labels.toOwnedSlice(allocator);
}

/// Scan task files in the configured tasks directory and filter by label match.
///
/// Returns a list of filenames (not full paths) that contain the given label.
/// Comparison is case-insensitive.
pub fn getTaskFilesByLabel(allocator: std.mem.Allocator, label: []const u8) ![][]const u8 {
    var matching: std.ArrayList([]const u8) = .{};
    errdefer {
        for (matching.items) |item| allocator.free(item);
        matching.deinit(allocator);
    }

    const tasks_path = resolveTasksDir();

    var dir = std.fs.cwd().openDir(tasks_path, .{ .iterate = true }) catch |err| {
        switch (err) {
            error.FileNotFound => return matching.toOwnedSlice(allocator),
            else => return err,
        }
    };
    defer dir.close();

    // Convert label to lowercase for case-insensitive comparison
    var lower_label_buf: [256]u8 = undefined;
    const lower_label = toLowerBuf(label, &lower_label_buf) orelse return matching.toOwnedSlice(allocator);

    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        if (entry.kind != .file) continue;

        // Check for .code-task.md extension
        if (!std.mem.endsWith(u8, entry.name, constants.TASK_FILE_EXT)) continue;

        // Read the file content
        const file_content = dir.readFileAlloc(allocator, entry.name, 1024 * 1024) catch continue;
        defer allocator.free(file_content);

        // Parse labels from this file
        const file_labels = parseLabels(allocator, file_content) catch continue;
        defer allocator.free(file_labels);

        // Check if any label matches (case-insensitive)
        var found = false;
        for (file_labels) |file_label| {
            var lower_file_label_buf: [256]u8 = undefined;
            const lower_file_label = toLowerBuf(file_label, &lower_file_label_buf) orelse continue;
            if (std.mem.eql(u8, lower_label, lower_file_label)) {
                found = true;
                break;
            }
        }

        if (found) {
            const name_copy = try allocator.dupe(u8, entry.name);
            try matching.append(allocator, name_copy);
        }
    }

    return matching.toOwnedSlice(allocator);
}

/// Return the configured tasks directory path or the default.
///
/// The result is a path relative to the project root, e.g. `.ody/tasks`.
pub fn resolveTasksDir() []const u8 {
    const tasks_dir = if (config.isLoaded())
        if (config.all()) |cfg| cfg.tasks_dir else constants.TASKS_DIR
    else
        constants.TASKS_DIR;

    // Build the path: BASE_DIR/tasks_dir
    return buildTasksPath(tasks_dir);
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/// Find a heading (e.g. `## Description`) in the content. Returns the
/// byte index of the start of the heading text, or null.
fn findHeading(content: []const u8, heading: []const u8) ?usize {
    // Search for the heading at the start of a line
    var pos: usize = 0;
    while (pos < content.len) {
        // Check if current position is at start of a line or start of content
        if (pos == 0 or (pos > 0 and content[pos - 1] == '\n')) {
            const remaining = content[pos..];
            if (std.mem.startsWith(u8, remaining, heading)) {
                return pos;
            }
        }
        pos += 1;
    }
    return null;
}

/// Find the start of the next `## ` section heading in the content.
/// Returns the byte index relative to the start of `body`, or null
/// if no further section heading is found.
fn findNextSection(body: []const u8) ?usize {
    var pos: usize = 0;
    while (pos < body.len) {
        if (pos == 0 or (pos > 0 and body[pos - 1] == '\n')) {
            const remaining = body[pos..];
            if (std.mem.startsWith(u8, remaining, "## ") or
                std.mem.startsWith(u8, remaining, "---"))
            {
                return pos;
            }
        }
        pos += 1;
    }
    return null;
}

/// Condense text to at most `max_sentences` sentences.
///
/// Sentences are delimited by `.`, `!`, or `?` followed by optional
/// whitespace. If no sentence terminators are found, returns up to
/// 200 characters of the input.
fn condenseSentences(allocator: std.mem.Allocator, text: []const u8, max_sentences: usize) ![]const u8 {
    var sentences: std.ArrayList([]const u8) = .{};
    defer sentences.deinit(allocator);

    var start: usize = 0;
    var i: usize = 0;
    while (i < text.len) : (i += 1) {
        if (text[i] == '.' or text[i] == '!' or text[i] == '?') {
            // Include the terminator
            const sentence = std.mem.trim(u8, text[start .. i + 1], " \t\r\n");
            if (sentence.len > 0) {
                try sentences.append(allocator, sentence);
                if (sentences.items.len >= max_sentences) break;
            }
            // Skip trailing whitespace after the terminator
            start = i + 1;
            while (start < text.len and (text[start] == ' ' or text[start] == '\t' or text[start] == '\n' or text[start] == '\r')) {
                start += 1;
            }
            i = if (start > 0) start - 1 else 0;
        }
    }

    if (sentences.items.len == 0) {
        // No sentence terminators found; return up to 200 chars
        const end = @min(text.len, 200);
        return try allocator.dupe(u8, text[0..end]);
    }

    // Join sentences with a space
    var total_len: usize = 0;
    for (sentences.items, 0..) |s, idx| {
        total_len += s.len;
        if (idx < sentences.items.len - 1) total_len += 1; // space separator
    }

    const result = try allocator.alloc(u8, total_len);
    var pos: usize = 0;
    for (sentences.items, 0..) |s, idx| {
        @memcpy(result[pos .. pos + s.len], s);
        pos += s.len;
        if (idx < sentences.items.len - 1) {
            result[pos] = ' ';
            pos += 1;
        }
    }

    return result;
}

/// Convert a string to lowercase in a fixed buffer. Returns `null` if
/// the input doesn't fit in the buffer.
fn toLowerBuf(input: []const u8, buf: []u8) ?[]const u8 {
    if (input.len > buf.len) return null;
    for (input, 0..) |c, i| {
        buf[i] = std.ascii.toLower(c);
    }
    return buf[0..input.len];
}

/// Static buffer used by `resolveTasksDir` to build the tasks path.
var tasks_path_buf: [512]u8 = undefined;

/// Build a path like `.ody/tasks_dir` from the base directory and given
/// tasks subdirectory name.
fn buildTasksPath(tasks_dir: []const u8) []const u8 {
    const base = constants.BASE_DIR;
    const sep = "/";

    if (base.len + sep.len + tasks_dir.len > tasks_path_buf.len) {
        // Fallback: return the default
        return constants.BASE_DIR ++ "/" ++ constants.TASKS_DIR;
    }

    @memcpy(tasks_path_buf[0..base.len], base);
    @memcpy(tasks_path_buf[base.len .. base.len + sep.len], sep);
    @memcpy(tasks_path_buf[base.len + sep.len .. base.len + sep.len + tasks_dir.len], tasks_dir);

    return tasks_path_buf[0 .. base.len + sep.len + tasks_dir.len];
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "parseFrontmatter extracts key-value pairs" {
    const content =
        \\---
        \\status: pending
        \\created: 2026-01-01
        \\started: null
        \\---
        \\# Task: Test
    ;

    var map = try parseFrontmatter(std.testing.allocator, content);
    defer map.deinit();

    try std.testing.expectEqualStrings("pending", map.get("status").?);
    try std.testing.expectEqualStrings("2026-01-01", map.get("created").?);
    try std.testing.expectEqualStrings("null", map.get("started").?);
}

test "parseFrontmatter returns empty map for missing frontmatter" {
    const content = "# Just a heading\nSome text.";

    var map = try parseFrontmatter(std.testing.allocator, content);
    defer map.deinit();

    try std.testing.expectEqual(@as(u32, 0), map.count());
}

test "parseFrontmatter returns empty map for unclosed frontmatter" {
    const content =
        \\---
        \\status: pending
        \\no closing delimiter
    ;

    var map = try parseFrontmatter(std.testing.allocator, content);
    defer map.deinit();

    try std.testing.expectEqual(@as(u32, 0), map.count());
}

test "parseFrontmatter skips lines without colon" {
    const content =
        \\---
        \\status: pending
        \\no-colon-here
        \\created: 2026-01-01
        \\---
    ;

    var map = try parseFrontmatter(std.testing.allocator, content);
    defer map.deinit();

    try std.testing.expectEqual(@as(u32, 2), map.count());
    try std.testing.expectEqualStrings("pending", map.get("status").?);
    try std.testing.expectEqualStrings("2026-01-01", map.get("created").?);
}

test "parseTitle extracts Task: prefix" {
    const content =
        \\---
        \\status: pending
        \\---
        \\# Task: Add Email Validation
        \\
        \\## Description
    ;

    const title = parseTitle(content);
    try std.testing.expect(title != null);
    try std.testing.expectEqualStrings("Add Email Validation", title.?);
}

test "parseTitle extracts plain heading" {
    const content =
        \\# My Feature
        \\
        \\Some text
    ;

    const title = parseTitle(content);
    try std.testing.expect(title != null);
    try std.testing.expectEqualStrings("My Feature", title.?);
}

test "parseTitle returns null for no heading" {
    const content = "Just some text without a heading.";
    try std.testing.expect(parseTitle(content) == null);
}

test "parseDescription extracts and condenses" {
    const content =
        \\---
        \\status: pending
        \\---
        \\# Task: Test
        \\
        \\## Description
        \\This is the first sentence. This is the second sentence. This is the third sentence. This is the fourth sentence.
        \\
        \\## Background
        \\Some background info.
    ;

    const desc = try parseDescription(std.testing.allocator, content);
    defer if (desc) |d| std.testing.allocator.free(d);

    try std.testing.expect(desc != null);
    // Should have at most 3 sentences
    try std.testing.expect(std.mem.indexOf(u8, desc.?, "fourth") == null);
    try std.testing.expect(std.mem.indexOf(u8, desc.?, "first sentence.") != null);
}

test "parseDescription returns null for missing section" {
    const content =
        \\---
        \\status: pending
        \\---
        \\# Task: Test
        \\
        \\## Background
        \\Some background.
    ;

    const desc = try parseDescription(std.testing.allocator, content);
    try std.testing.expect(desc == null);
}

test "parseLabels extracts comma-separated labels" {
    const content =
        \\## Metadata
        \\- **Complexity**: Medium
        \\- **Labels**: auth, backend, validation
    ;

    const labels = try parseLabels(std.testing.allocator, content);
    defer std.testing.allocator.free(labels);

    try std.testing.expectEqual(@as(usize, 3), labels.len);
    try std.testing.expectEqualStrings("auth", labels[0]);
    try std.testing.expectEqualStrings("backend", labels[1]);
    try std.testing.expectEqualStrings("validation", labels[2]);
}

test "parseLabels returns empty for no labels" {
    const content = "# Task: Test\n## Description\nSome text.";

    const labels = try parseLabels(std.testing.allocator, content);
    defer std.testing.allocator.free(labels);

    try std.testing.expectEqual(@as(usize, 0), labels.len);
}

test "parseLabels handles single label" {
    const content = "**Labels**: auth\n";

    const labels = try parseLabels(std.testing.allocator, content);
    defer std.testing.allocator.free(labels);

    try std.testing.expectEqual(@as(usize, 1), labels.len);
    try std.testing.expectEqualStrings("auth", labels[0]);
}

test "resolveTasksDir returns default path" {
    // Config is not loaded in test context, so should fall back to default.
    config.reset();
    const dir = resolveTasksDir();
    try std.testing.expectEqualStrings(".ody/tasks", dir);
}

test "toLowerBuf converts to lowercase" {
    var buf: [32]u8 = undefined;
    const result = toLowerBuf("Hello WORLD", &buf);
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("hello world", result.?);
}

test "toLowerBuf returns null for oversized input" {
    var buf: [2]u8 = undefined;
    try std.testing.expect(toLowerBuf("long string", &buf) == null);
}

test "condenseSentences limits to max" {
    const text = "First. Second. Third. Fourth.";
    const result = try condenseSentences(std.testing.allocator, text, 2);
    defer std.testing.allocator.free(result);

    try std.testing.expectEqualStrings("First. Second.", result);
}

test "condenseSentences handles no terminators" {
    const text = "No sentence terminators here";
    const result = try condenseSentences(std.testing.allocator, text, 3);
    defer std.testing.allocator.free(result);

    try std.testing.expectEqualStrings("No sentence terminators here", result);
}

test "condenseSentences handles text with only one sentence" {
    const text = "Just one sentence.";
    const result = try condenseSentences(std.testing.allocator, text, 3);
    defer std.testing.allocator.free(result);

    try std.testing.expectEqualStrings("Just one sentence.", result);
}

test "findHeading finds heading at start" {
    const content = "## Description\nSome text";
    try std.testing.expectEqual(@as(?usize, 0), findHeading(content, "## Description"));
}

test "findHeading finds heading after newline" {
    const content = "Some text\n## Description\nMore text";
    try std.testing.expectEqual(@as(?usize, 10), findHeading(content, "## Description"));
}

test "findHeading returns null for missing heading" {
    const content = "No headings here";
    try std.testing.expect(findHeading(content, "## Description") == null);
}

test "buildTasksPath builds correct path" {
    const path = buildTasksPath("tasks");
    try std.testing.expectEqualStrings(".ody/tasks", path);
}

test "buildTasksPath builds custom path" {
    const path = buildTasksPath("my-tasks");
    try std.testing.expectEqualStrings(".ody/my-tasks", path);
}
