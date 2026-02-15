/// Interactive stdin prompt utilities for text input, confirmation dialogs,
/// selection menus, and autocomplete filtering.
///
/// Replaces `@clack/prompts` interactive functions from the TypeScript
/// implementation with raw-mode terminal I/O built on `std.posix`.
///
/// All prompts switch the terminal to raw mode (disabling canonical mode
/// and echo) and restore the original settings on exit via `defer`.
/// Returning `null` from any prompt signals that the user cancelled
/// (Ctrl+C or Escape).
const std = @import("std");
const terminal = @import("terminal.zig");

// -----------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------

/// A label/value pair used by `select` and `autocomplete`.
pub fn Option(comptime T: type) type {
    return struct {
        label: []const u8,
        value: T,
    };
}

// -----------------------------------------------------------------------
// Terminal raw-mode helpers
// -----------------------------------------------------------------------

/// Saved terminal state that can be restored later.
const SavedTermios = std.posix.termios;

/// Switch stdin to raw mode and return the original termios so the
/// caller (or a `defer`) can restore it.
fn enableRawMode() !SavedTermios {
    const fd = std.posix.STDIN_FILENO;
    const orig = try std.posix.tcgetattr(fd);

    var raw = orig;

    // Disable canonical mode (line buffering) and echo.
    raw.lflag.ECHO = false;
    raw.lflag.ICANON = false;
    raw.lflag.ISIG = false;

    // Read returns after each byte.
    raw.cc[@intFromEnum(std.posix.system.V.MIN)] = 1;
    raw.cc[@intFromEnum(std.posix.system.V.TIME)] = 0;

    try std.posix.tcsetattr(fd, .NOW, raw);
    return orig;
}

/// Restore previously saved terminal attributes.
fn restoreMode(orig: SavedTermios) void {
    std.posix.tcsetattr(std.posix.STDIN_FILENO, .NOW, orig) catch {};
}

// -----------------------------------------------------------------------
// Internal key reading
// -----------------------------------------------------------------------

const Key = enum {
    char,
    enter,
    backspace,
    up,
    down,
    escape,
    ctrl_c,
};

const KeyEvent = struct {
    key: Key,
    /// The raw byte for `char` events; 0 otherwise.
    byte: u8,
};

/// Read a single key event from stdin, handling multi-byte escape sequences
/// for arrow keys.
fn readKey() !KeyEvent {
    const stdin = std.fs.File.stdin();
    var buf: [1]u8 = undefined;
    const n = try stdin.read(&buf);
    if (n == 0) return KeyEvent{ .key = .ctrl_c, .byte = 0 };

    const c = buf[0];

    return switch (c) {
        3 => KeyEvent{ .key = .ctrl_c, .byte = 0 }, // Ctrl+C
        13, 10 => KeyEvent{ .key = .enter, .byte = 0 }, // Enter / LF
        127, 8 => KeyEvent{ .key = .backspace, .byte = 0 }, // Backspace / DEL
        27 => blk: {
            // Possible escape sequence – try to read `[` and the direction byte.
            var seq: [2]u8 = undefined;
            const r = stdin.read(&seq) catch 0;
            if (r == 2 and seq[0] == '[') {
                break :blk switch (seq[1]) {
                    'A' => KeyEvent{ .key = .up, .byte = 0 },
                    'B' => KeyEvent{ .key = .down, .byte = 0 },
                    else => KeyEvent{ .key = .escape, .byte = 0 },
                };
            }
            break :blk KeyEvent{ .key = .escape, .byte = 0 };
        },
        else => {
            if (c >= 32 and c < 127) {
                return KeyEvent{ .key = .char, .byte = c };
            }
            // Non-printable – treat as no-op and recurse.
            return readKey();
        },
    };
}

// -----------------------------------------------------------------------
// Validator placeholders
// -----------------------------------------------------------------------

const PLACEHOLDER_VALIDATOR_COMMANDS = [_][]const u8{
    "bun run lint",
    "make test",
    "npm run typecheck",
    "pylint",
    "go test ./...",
    "rubocop --lint",
};

/// Return a randomly-selected validator command placeholder string.
pub fn getRandomValidatorPlaceholder() []const u8 {
    const idx = std.crypto.random.intRangeLessThan(
        usize,
        0,
        PLACEHOLDER_VALIDATOR_COMMANDS.len,
    );
    return PLACEHOLDER_VALIDATOR_COMMANDS[idx];
}

// -----------------------------------------------------------------------
// text()
// -----------------------------------------------------------------------

/// Display a text input prompt.  Returns the entered string, or `null` if
/// the user cancels (Ctrl+C / Escape).
///
/// `validate` is an optional callback; when it returns a non-null slice the
/// value is treated as an error message and the user must correct the input.
pub fn text(
    allocator: std.mem.Allocator,
    message: []const u8,
    placeholder: []const u8,
    validate: ?*const fn ([]const u8) ?[]const u8,
) !?[]const u8 {
    const stdout = std.fs.File.stdout();
    const is_tty = terminal.isTty(std.posix.STDOUT_FILENO);

    // Print the prompt label.
    try terminal.log(stdout, message, is_tty);

    const orig = try enableRawMode();
    defer restoreMode(orig);

    var buf: std.ArrayList(u8) = .{};
    defer buf.deinit(allocator);

    // Track the number of visual rows the current render occupies.
    var prev_rows: u16 = 1;

    // Show placeholder initially.
    if (placeholder.len != 0) {
        prev_rows = try renderTextLine(stdout, buf.items, placeholder, is_tty, prev_rows);
    } else {
        try terminal.groupLine(stdout, is_tty);
    }

    while (true) {
        const ev = try readKey();

        switch (ev.key) {
            .ctrl_c, .escape => {
                // Clear all wrapped rows before exiting.
                try terminal.clearMultipleLines(stdout, prev_rows, is_tty);
                try stdout.writeAll("\n");
                return null;
            },
            .enter => {
                const value = try allocator.dupe(u8, buf.items);
                // Validate if callback provided.
                if (validate) |vfn| {
                    if (vfn(value)) |err_msg| {
                        allocator.free(value);
                        // Clear all wrapped rows, show error, then re-render.
                        try terminal.clearMultipleLines(stdout, prev_rows, is_tty);
                        try terminal.err(stdout, err_msg, is_tty);
                        prev_rows = try renderTextLine(stdout, buf.items, placeholder, is_tty, 1);
                        continue;
                    }
                }
                // Finished – clear all wrapped rows and show the confirmed value.
                try terminal.clearMultipleLines(stdout, prev_rows, is_tty);
                if (value.len > 0) {
                    try terminal.log(stdout, value, is_tty);
                } else {
                    try stdout.writeAll("\n");
                }
                return value;
            },
            .backspace => {
                if (buf.items.len > 0) {
                    _ = buf.pop();
                    prev_rows = try renderTextLine(stdout, buf.items, placeholder, is_tty, prev_rows);
                }
            },
            .char => {
                try buf.append(allocator, ev.byte);
                prev_rows = try renderTextLine(stdout, buf.items, placeholder, is_tty, prev_rows);
            },
            .up, .down => {},
        }
    }
}

/// The visible width of the groupLine prefix ("│  ") — the "│" character
/// occupies 1 column and is followed by 2 spaces, totalling 3 visible columns.
/// (The ANSI colour escapes around it are zero-width.)
const GROUP_LINE_VISIBLE_WIDTH: usize = 3;

/// Render the current text-input line, clearing all `prev_rows` visual rows
/// from the previous render before redrawing.  Returns the number of visual
/// rows the new render occupies so the caller can track it.
fn renderTextLine(
    writer: anytype,
    input: []const u8,
    placeholder: []const u8,
    is_tty: bool,
    prev_rows: u16,
) !u16 {
    // Clear all visual rows occupied by the previous render.
    try terminal.clearMultipleLines(writer, prev_rows, is_tty);

    try terminal.groupLine(writer, is_tty);

    const display_text = if (input.len == 0 and placeholder.len > 0) placeholder else input;

    if (input.len == 0 and placeholder.len > 0) {
        try terminal.dim(writer, placeholder, is_tty);
    } else {
        try writer.writeAll(input);
    }

    // Compute how many visual rows this render occupies.
    if (!is_tty) return 1;
    const term_width = terminal.getTerminalWidth();
    const content_width = GROUP_LINE_VISIBLE_WIDTH + display_text.len;
    return terminal.computeVisualRows(content_width, term_width);
}

// -----------------------------------------------------------------------
// confirm()
// -----------------------------------------------------------------------

/// Display a yes/no confirmation prompt.  Returns `true` for yes, `false`
/// for no, or `null` on cancel.
pub fn confirm(
    message: []const u8,
    default: bool,
) !?bool {
    const stdout = std.fs.File.stdout();
    const is_tty = terminal.isTty(std.posix.STDOUT_FILENO);

    // Build the label, e.g. "Continue? (Y/n)"
    const hint: []const u8 = if (default) " (Y/n)" else " (y/N)";

    // Print using log-style framing.
    try terminal.clearLine(stdout, is_tty);
    try stdout.writeAll("\r");
    if (is_tty) {
        const FG_GRAY = "\x1b[90m";
        const RESET = "\x1b[0m";
        try stdout.writeAll(FG_GRAY);
        try stdout.writeAll("│  ");
        try stdout.writeAll(RESET);
    } else {
        try stdout.writeAll("  ");
    }
    try stdout.writeAll(message);
    try terminal.dim(stdout, hint, is_tty);

    const orig = try enableRawMode();
    defer restoreMode(orig);

    while (true) {
        const ev = try readKey();
        switch (ev.key) {
            .ctrl_c, .escape => {
                try stdout.writeAll("\n");
                return null;
            },
            .enter => {
                try stdout.writeAll("\n");
                return default;
            },
            .char => {
                if (ev.byte == 'y' or ev.byte == 'Y') {
                    try stdout.writeAll("\n");
                    return true;
                } else if (ev.byte == 'n' or ev.byte == 'N') {
                    try stdout.writeAll("\n");
                    return false;
                }
                // Ignore other characters.
            },
            else => {},
        }
    }
}

// -----------------------------------------------------------------------
// select()
// -----------------------------------------------------------------------

/// Display a selection menu.  The user navigates with arrow keys and
/// confirms with Enter.  Returns the `value` of the selected option, or
/// `null` on cancel.
pub fn selectPrompt(
    comptime T: type,
    message: []const u8,
    options: []const Option(T),
) !?T {
    if (options.len == 0) return null;

    const stdout = std.fs.File.stdout();
    const is_tty = terminal.isTty(std.posix.STDOUT_FILENO);

    try terminal.log(stdout, message, is_tty);

    const orig = try enableRawMode();
    defer restoreMode(orig);

    var cursor: usize = 0;

    // Initial draw.
    try renderSelectList(stdout, options, cursor, is_tty);

    while (true) {
        const ev = try readKey();
        switch (ev.key) {
            .ctrl_c, .escape => {
                // Clear the drawn list.
                try eraseLines(stdout, options.len, is_tty);
                return null;
            },
            .up => {
                if (cursor > 0) cursor -= 1;
                try eraseLines(stdout, options.len, is_tty);
                try renderSelectList(stdout, options, cursor, is_tty);
            },
            .down => {
                if (cursor + 1 < options.len) cursor += 1;
                try eraseLines(stdout, options.len, is_tty);
                try renderSelectList(stdout, options, cursor, is_tty);
            },
            .enter => {
                try eraseLines(stdout, options.len, is_tty);
                try terminal.log(stdout, options[cursor].label, is_tty);
                return options[cursor].value;
            },
            else => {},
        }
    }
}

/// Draw the options list with a highlight on `cursor`.
fn renderSelectList(
    writer: anytype,
    options: anytype,
    cursor: usize,
    is_tty: bool,
) !void {
    for (options, 0..) |opt, i| {
        if (is_tty) {
            try writer.writeAll("  ");
        }
        if (i == cursor) {
            try terminal.cyan(writer, "> ", is_tty);
            try terminal.bold(writer, opt.label, is_tty);
        } else {
            try writer.writeAll("  ");
            try terminal.dim(writer, opt.label, is_tty);
        }
        try writer.writeAll("\n");
    }
}

/// Erase `n` previously printed lines by moving up and clearing each one.
fn eraseLines(writer: anytype, n: usize, is_tty: bool) !void {
    if (n == 0) return;
    var i: usize = 0;
    while (i < n) : (i += 1) {
        try terminal.moveCursorUp(writer, 1, is_tty);
        try terminal.clearLine(writer, is_tty);
    }
}

// -----------------------------------------------------------------------
// autocomplete()
// -----------------------------------------------------------------------

/// Display a filterable selection list.  As the user types, the visible
/// options are narrowed by case-insensitive substring match.  Arrow keys
/// navigate the filtered list and Enter confirms.
///
/// Returns the `value` of the selected option, or `null` on cancel.
pub fn autocomplete(
    comptime T: type,
    allocator: std.mem.Allocator,
    message: []const u8,
    options: []const Option(T),
) !?T {
    if (options.len == 0) return null;

    const stdout = std.fs.File.stdout();
    const is_tty = terminal.isTty(std.posix.STDOUT_FILENO);

    try terminal.log(stdout, message, is_tty);

    const orig = try enableRawMode();
    defer restoreMode(orig);

    var filter_buf: std.ArrayList(u8) = .{};
    defer filter_buf.deinit(allocator);

    // Indices into `options` that match the current filter.
    var filtered: std.ArrayList(usize) = .{};
    defer filtered.deinit(allocator);

    // Initialise with all indices.
    for (0..options.len) |idx| {
        try filtered.append(allocator, idx);
    }

    var cursor: usize = 0;

    // Compute how many lines the initial render occupies (input line + list).
    var drawn_lines: usize = 1 + filtered.items.len;
    try renderAutocomplete(stdout, filter_buf.items, options, filtered.items, cursor, is_tty);

    while (true) {
        const ev = try readKey();
        switch (ev.key) {
            .ctrl_c, .escape => {
                try eraseLines(stdout, drawn_lines, is_tty);
                return null;
            },
            .up => {
                if (cursor > 0) cursor -= 1;
                try eraseLines(stdout, drawn_lines, is_tty);
                drawn_lines = 1 + filtered.items.len;
                try renderAutocomplete(stdout, filter_buf.items, options, filtered.items, cursor, is_tty);
            },
            .down => {
                if (filtered.items.len > 0 and cursor + 1 < filtered.items.len) cursor += 1;
                try eraseLines(stdout, drawn_lines, is_tty);
                drawn_lines = 1 + filtered.items.len;
                try renderAutocomplete(stdout, filter_buf.items, options, filtered.items, cursor, is_tty);
            },
            .enter => {
                if (filtered.items.len > 0) {
                    const sel = filtered.items[cursor];
                    try eraseLines(stdout, drawn_lines, is_tty);
                    try terminal.log(stdout, options[sel].label, is_tty);
                    return options[sel].value;
                }
            },
            .backspace => {
                if (filter_buf.items.len > 0) {
                    _ = filter_buf.pop();
                    try rebuildFiltered(allocator, options, filter_buf.items, &filtered);
                    cursor = 0;
                    try eraseLines(stdout, drawn_lines, is_tty);
                    drawn_lines = 1 + filtered.items.len;
                    try renderAutocomplete(stdout, filter_buf.items, options, filtered.items, cursor, is_tty);
                }
            },
            .char => {
                try filter_buf.append(allocator, ev.byte);
                try rebuildFiltered(allocator, options, filter_buf.items, &filtered);
                cursor = 0;
                try eraseLines(stdout, drawn_lines, is_tty);
                drawn_lines = 1 + filtered.items.len;
                try renderAutocomplete(stdout, filter_buf.items, options, filtered.items, cursor, is_tty);
            },
        }
    }
}

/// Re-filter `filtered` indices based on `query` (case-insensitive substring).
fn rebuildFiltered(
    allocator: std.mem.Allocator,
    options: anytype,
    query: []const u8,
    filtered: *std.ArrayList(usize),
) !void {
    filtered.clearRetainingCapacity();
    if (query.len == 0) {
        for (0..options.len) |idx| {
            try filtered.append(allocator, idx);
        }
        return;
    }
    // Build a lowercase copy of the query on the stack (reasonable length).
    var lower_query: [256]u8 = undefined;
    const qlen = @min(query.len, lower_query.len);
    for (0..qlen) |i| {
        lower_query[i] = std.ascii.toLower(query[i]);
    }
    const lq = lower_query[0..qlen];

    for (options, 0..) |opt, idx| {
        if (containsInsensitive(opt.label, lq)) {
            try filtered.append(allocator, idx);
        }
    }
}

/// Case-insensitive substring search.
fn containsInsensitive(haystack: []const u8, needle_lower: []const u8) bool {
    if (needle_lower.len == 0) return true;
    if (haystack.len < needle_lower.len) return false;
    const limit = haystack.len - needle_lower.len + 1;
    for (0..limit) |start| {
        var match = true;
        for (0..needle_lower.len) |j| {
            if (std.ascii.toLower(haystack[start + j]) != needle_lower[j]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

/// Render the autocomplete display: filter input line + filtered option list.
fn renderAutocomplete(
    writer: anytype,
    query: []const u8,
    options: anytype,
    filtered_indices: []const usize,
    cursor: usize,
    is_tty: bool,
) !void {
    // Input line.
    if (is_tty) {
        try writer.writeAll("  ");
    }
    if (query.len == 0) {
        try terminal.dim(writer, "Type to search", is_tty);
    } else {
        try writer.writeAll(query);
    }
    try writer.writeAll("\n");

    // Filtered options.
    for (filtered_indices, 0..) |opt_idx, i| {
        if (is_tty) {
            try writer.writeAll("  ");
        }
        if (i == cursor) {
            try terminal.cyan(writer, "> ", is_tty);
            try terminal.bold(writer, options[opt_idx].label, is_tty);
        } else {
            try writer.writeAll("  ");
            try terminal.dim(writer, options[opt_idx].label, is_tty);
        }
        try writer.writeAll("\n");
    }
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "Option generic struct can be instantiated" {
    const StringOpt = Option([]const u8);
    const opt = StringOpt{ .label = "Claude", .value = "claude" };
    try std.testing.expectEqualStrings("Claude", opt.label);
    try std.testing.expectEqualStrings("claude", opt.value);
}

test "Option with integer type" {
    const IntOpt = Option(u32);
    const opt = IntOpt{ .label = "Five", .value = 5 };
    try std.testing.expectEqualStrings("Five", opt.label);
    try std.testing.expectEqual(@as(u32, 5), opt.value);
}

test "getRandomValidatorPlaceholder returns a valid placeholder" {
    const placeholder = getRandomValidatorPlaceholder();
    try std.testing.expect(placeholder.len > 0);
    // Must be one of the known placeholders.
    var found = false;
    for (PLACEHOLDER_VALIDATOR_COMMANDS) |cmd| {
        if (std.mem.eql(u8, placeholder, cmd)) {
            found = true;
            break;
        }
    }
    try std.testing.expect(found);
}

test "containsInsensitive matches case-insensitively" {
    try std.testing.expect(containsInsensitive("Claude", "cl"));
    try std.testing.expect(containsInsensitive("claude", "cl"));
    try std.testing.expect(containsInsensitive("CLAUDE", "cl"));
    try std.testing.expect(containsInsensitive("OpenCode", "code"));
    try std.testing.expect(!containsInsensitive("codex", "zz"));
}

test "containsInsensitive empty needle matches everything" {
    try std.testing.expect(containsInsensitive("anything", ""));
    try std.testing.expect(containsInsensitive("", ""));
}

test "containsInsensitive needle longer than haystack returns false" {
    try std.testing.expect(!containsInsensitive("ab", "abc"));
}

test "enableRawMode and restoreMode round-trip" {
    // This test only verifies the API compiles and runs without error
    // when stdin is not a TTY (e.g. in CI).  On a non-TTY, tcgetattr
    // returns an error, which is fine – we just verify we handle it.
    if (enableRawMode()) |orig| {
        restoreMode(orig);
    } else |_| {
        // Expected in non-TTY environments (CI, piped stdin).
    }
}

test "renderSelectList writes output for TTY" {
    const StringOpt = Option([]const u8);
    const opts = [_]StringOpt{
        .{ .label = "alpha", .value = "a" },
        .{ .label = "beta", .value = "b" },
    };
    var buf: [2048]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try renderSelectList(writer, &opts, 0, true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "alpha") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "beta") != null);
}

test "renderSelectList writes output for non-TTY" {
    const StringOpt = Option([]const u8);
    const opts = [_]StringOpt{
        .{ .label = "alpha", .value = "a" },
        .{ .label = "beta", .value = "b" },
    };
    var buf: [2048]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try renderSelectList(writer, &opts, 1, false);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "alpha") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "beta") != null);
}

test "eraseLines is no-op for zero lines" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try eraseLines(writer, 0, true);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("", output);
}

test "renderTextLine shows placeholder when input is empty" {
    var buf: [512]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    const rows = try renderTextLine(writer, "", "type here", true, 1);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "type here") != null);
    try std.testing.expect(rows >= 1);
}

test "renderTextLine shows input text when non-empty" {
    var buf: [512]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    const rows = try renderTextLine(writer, "hello", "placeholder", true, 1);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "hello") != null);
    // Placeholder should NOT appear when there is input.
    try std.testing.expect(std.mem.indexOf(u8, output, "placeholder") == null);
    try std.testing.expect(rows >= 1);
}

test "renderTextLine returns 1 row in non-TTY mode" {
    var buf: [512]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    const rows = try renderTextLine(writer, "some text", "", false, 1);

    try std.testing.expectEqual(@as(u16, 1), rows);
}

test "renderTextLine handles prev_rows > 1 without error" {
    var buf: [1024]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    // Simulate a previous render that occupied 3 rows.
    const rows = try renderTextLine(writer, "short", "", true, 3);
    try std.testing.expect(rows >= 1);
}

test "renderAutocomplete renders query and filtered options" {
    const StringOpt = Option([]const u8);
    const opts = [_]StringOpt{
        .{ .label = "claude", .value = "claude" },
        .{ .label = "codex", .value = "codex" },
        .{ .label = "opencode", .value = "opencode" },
    };
    const filtered = [_]usize{ 0, 1 };

    var buf: [4096]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try renderAutocomplete(writer, "c", &opts, &filtered, 0, true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "c") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "claude") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "codex") != null);
}

test "rebuildFiltered filters by substring" {
    const StringOpt = Option([]const u8);
    const opts = [_]StringOpt{
        .{ .label = "claude", .value = "claude" },
        .{ .label = "codex", .value = "codex" },
        .{ .label = "opencode", .value = "opencode" },
    };

    var filtered: std.ArrayList(usize) = .{};
    defer filtered.deinit(std.testing.allocator);

    try rebuildFiltered(std.testing.allocator, &opts, "cl", &filtered);
    try std.testing.expectEqual(@as(usize, 1), filtered.items.len);
    try std.testing.expectEqual(@as(usize, 0), filtered.items[0]); // "claude"

    try rebuildFiltered(std.testing.allocator, &opts, "code", &filtered);
    try std.testing.expectEqual(@as(usize, 2), filtered.items.len); // "codex" and "opencode"

    try rebuildFiltered(std.testing.allocator, &opts, "", &filtered);
    try std.testing.expectEqual(@as(usize, 3), filtered.items.len); // all
}
