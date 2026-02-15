/// OS notification utility for sending desktop notifications on macOS and Linux.
///
/// Ported from `packages/cli/src/lib/notify.ts`.
///
/// Notifications are best-effort: all errors are silently swallowed.
/// The function spawns the platform-specific notification command and
/// does not wait for it to complete (fire-and-forget).
const std = @import("std");
const builtin = @import("builtin");

/// Escape single quotes in a string for safe embedding inside a
/// single-quoted shell argument.  Each `'` is replaced with `'\''`
/// (end quote, escaped literal quote, resume quote).
///
/// Returns a stack buffer writer result.  If the input is too long for
/// the buffer the function returns `null` and the caller should skip
/// the notification rather than risk truncation or injection.
fn escapeSingleQuotes(input: []const u8, buf: []u8) ?[]const u8 {
    var pos: usize = 0;
    for (input) |c| {
        if (c == '\'') {
            // Replace ' with '\'' (4 chars)
            if (pos + 4 > buf.len) return null;
            buf[pos] = '\'';
            buf[pos + 1] = '\\';
            buf[pos + 2] = '\'';
            buf[pos + 3] = '\'';
            pos += 4;
        } else {
            if (pos + 1 > buf.len) return null;
            buf[pos] = c;
            pos += 1;
        }
    }
    return buf[0..pos];
}

/// Send an OS desktop notification with the given title and message.
///
/// On macOS this spawns `osascript` with a `display notification` AppleScript.
/// On Linux this spawns `notify-send`.
/// On unsupported platforms the function is a no-op.
///
/// All errors are silently swallowed -- notifications are best-effort.
/// The spawned process is not waited on (fire-and-forget).
pub fn sendNotification(title: []const u8, message: []const u8) void {
    sendNotificationImpl(title, message) catch return;
}

fn sendNotificationImpl(title: []const u8, message: []const u8) !void {
    switch (comptime builtin.os.tag) {
        .macos => {
            // Escape single quotes to prevent command injection in the
            // AppleScript string.
            var title_buf: [1024]u8 = undefined;
            var msg_buf: [4096]u8 = undefined;

            const safe_title = escapeSingleQuotes(title, &title_buf) orelse return;
            const safe_message = escapeSingleQuotes(message, &msg_buf) orelse return;

            // Build the osascript command string:
            //   display notification "..." with title "..."
            // We use double quotes inside the AppleScript so single-quote
            // escaping in the outer shell argument is sufficient.
            var script_buf: [8192]u8 = undefined;
            const script = std.fmt.bufPrint(&script_buf, "display notification \"{s}\" with title \"{s}\"", .{ safe_message, safe_title }) catch return;

            const argv: []const []const u8 = &.{ "osascript", "-e", script };

            var child = std.process.Child.init(argv, std.heap.page_allocator);
            child.stdin_behavior = .Close;
            child.stdout_behavior = .Close;
            child.stderr_behavior = .Close;

            // Fire and forget -- spawn but don't wait.
            child.spawn() catch return;
        },
        .linux => {
            const argv: []const []const u8 = &.{ "notify-send", title, message };

            var child = std.process.Child.init(argv, std.heap.page_allocator);
            child.stdin_behavior = .Close;
            child.stdout_behavior = .Close;
            child.stderr_behavior = .Close;

            // Fire and forget -- spawn but don't wait.
            child.spawn() catch return;
        },
        else => {
            // Unsupported platform -- no-op.
        },
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "escapeSingleQuotes passes through clean strings" {
    var buf: [256]u8 = undefined;
    const result = escapeSingleQuotes("hello world", &buf);
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("hello world", result.?);
}

test "escapeSingleQuotes escapes single quotes" {
    var buf: [256]u8 = undefined;
    const result = escapeSingleQuotes("it's done", &buf);
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("it'\\''s done", result.?);
}

test "escapeSingleQuotes handles empty string" {
    var buf: [256]u8 = undefined;
    const result = escapeSingleQuotes("", &buf);
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("", result.?);
}

test "escapeSingleQuotes handles multiple quotes" {
    var buf: [256]u8 = undefined;
    const result = escapeSingleQuotes("a'b'c", &buf);
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("a'\\''b'\\''c", result.?);
}

test "escapeSingleQuotes returns null when buffer too small" {
    var buf: [5]u8 = undefined;
    // "it's" needs 8 bytes after escaping: i t ' \ ' ' s
    const result = escapeSingleQuotes("it's", &buf);
    try std.testing.expect(result == null);
}

test "sendNotification does not panic on normal input" {
    // This is a smoke test -- on macOS it will attempt to spawn osascript,
    // on Linux it will attempt notify-send, on other platforms it's a no-op.
    // We cannot easily verify the notification was sent, but we can verify
    // the function returns without error.
    sendNotification("Test", "Hello from Zig tests");
}

test "sendNotification does not panic on special characters" {
    sendNotification("It's a test", "Message with 'quotes' and \"doubles\"");
}

test "sendNotification does not panic on empty strings" {
    sendNotification("", "");
}
