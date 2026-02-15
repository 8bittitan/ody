/// ANSI terminal helpers for colored output, cursor control, spinner
/// animations, and styled box/framing.
///
/// Replaces `@clack/prompts` from the TypeScript implementation with
/// zero-dependency terminal rendering using raw ANSI escape codes.
///
/// All style functions accept any `std.io.GenericWriter` (or the concrete
/// `Writer` alias below) so output can be directed to stdout, a buffer,
/// or a test writer.  When the underlying fd is not a TTY, escape codes
/// are suppressed automatically.
const std = @import("std");

// -----------------------------------------------------------------------
// Public type aliases
// -----------------------------------------------------------------------

/// Convenience alias for the stdout file type.
pub const Writer = std.fs.File;

// -----------------------------------------------------------------------
// ANSI escape code constants
// -----------------------------------------------------------------------

const ESC = "\x1b[";

const RESET = ESC ++ "0m";
const BOLD = ESC ++ "1m";
const DIM = ESC ++ "2m";

const FG_RED = ESC ++ "31m";
const FG_GREEN = ESC ++ "32m";
const FG_YELLOW = ESC ++ "33m";
const FG_CYAN = ESC ++ "36m";
const FG_GRAY = ESC ++ "90m";

const HIDE_CURSOR = ESC ++ "?25l";
const SHOW_CURSOR = ESC ++ "?25h";
const CLEAR_LINE = "\r" ++ ESC ++ "2K";
const MOVE_UP_ONE = ESC ++ "1A";

// Braille spinner frames.
const SPINNER_FRAMES = [_][]const u8{
    "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏",
};

// Spinner tick interval in nanoseconds (~80 ms).
const SPINNER_INTERVAL_NS: u64 = 80 * std.time.ns_per_ms;

// -----------------------------------------------------------------------
// TTY detection & terminal dimensions
// -----------------------------------------------------------------------

/// Returns `true` when the given file descriptor refers to an interactive
/// terminal (as opposed to a pipe or file redirect).
pub fn isTty(handle: std.posix.fd_t) bool {
    return std.posix.isatty(handle);
}

/// Query the terminal column width via POSIX `ioctl` with `TIOCGWINSZ`.
/// Returns a sensible fallback (80 columns) when the ioctl fails or
/// stdout is not a TTY.
pub fn getTerminalWidth() u16 {
    var wsz: std.posix.winsize = undefined;
    const rc = std.posix.system.ioctl(std.posix.STDOUT_FILENO, std.posix.T.IOCGWINSZ, @intFromPtr(&wsz));
    if (rc == 0 and wsz.col > 0) {
        return wsz.col;
    }
    return 80;
}

/// Compute the number of visual terminal rows a line of `content_len`
/// characters occupies given a terminal of `term_width` columns.
/// Always returns at least 1 (even for zero-length content).
pub fn computeVisualRows(content_len: usize, term_width: u16) u16 {
    if (term_width == 0) return 1;
    if (content_len == 0) return 1;
    const tw: usize = @intCast(term_width);
    return @intCast((content_len + tw - 1) / tw);
}

/// Move the cursor up to the first of `prev_rows` visual rows, then
/// clear each row from top to bottom.  Leaves the cursor on the first
/// (top) row, ready for fresh output.
pub fn clearMultipleLines(writer: anytype, prev_rows: u16, is_tty: bool) !void {
    if (!is_tty or prev_rows <= 1) {
        // Single row or non-TTY: the existing clearLine is sufficient.
        try clearLine(writer, is_tty);
        try writer.writeAll("\r");
        return;
    }
    // Move up to the first row.
    try moveCursorUp(writer, prev_rows - 1, is_tty);
    // Clear each row from top to bottom.
    var i: u16 = 0;
    while (i < prev_rows) : (i += 1) {
        try clearLine(writer, is_tty);
        if (i + 1 < prev_rows) {
            try writer.writeAll("\n");
        }
    }
    // Move back up to the first row.
    if (prev_rows > 1) {
        try moveCursorUp(writer, prev_rows - 1, is_tty);
    }
    try writer.writeAll("\r");
}

// -----------------------------------------------------------------------
// Style helpers – write coloured / styled text
// -----------------------------------------------------------------------

/// Write `text` wrapped in the given ANSI `code` (and a trailing reset).
/// When the writer is backed by a non-TTY fd, the text is written without
/// any escape sequences.
fn writeStyled(writer: anytype, code: []const u8, text: []const u8, is_tty: bool) !void {
    if (is_tty) {
        try writer.writeAll(code);
        try writer.writeAll(text);
        try writer.writeAll(RESET);
    } else {
        try writer.writeAll(text);
    }
}

pub fn red(writer: anytype, text: []const u8, is_tty: bool) !void {
    try writeStyled(writer, FG_RED, text, is_tty);
}

pub fn green(writer: anytype, text: []const u8, is_tty: bool) !void {
    try writeStyled(writer, FG_GREEN, text, is_tty);
}

pub fn yellow(writer: anytype, text: []const u8, is_tty: bool) !void {
    try writeStyled(writer, FG_YELLOW, text, is_tty);
}

pub fn cyan(writer: anytype, text: []const u8, is_tty: bool) !void {
    try writeStyled(writer, FG_CYAN, text, is_tty);
}

pub fn gray(writer: anytype, text: []const u8, is_tty: bool) !void {
    try writeStyled(writer, FG_GRAY, text, is_tty);
}

pub fn bold(writer: anytype, text: []const u8, is_tty: bool) !void {
    try writeStyled(writer, BOLD, text, is_tty);
}

pub fn dim(writer: anytype, text: []const u8, is_tty: bool) !void {
    try writeStyled(writer, DIM, text, is_tty);
}

/// Write text that is both bold and a specific colour.
pub fn boldColor(writer: anytype, color_code: []const u8, text: []const u8, is_tty: bool) !void {
    if (is_tty) {
        try writer.writeAll(BOLD);
        try writer.writeAll(color_code);
        try writer.writeAll(text);
        try writer.writeAll(RESET);
    } else {
        try writer.writeAll(text);
    }
}

// -----------------------------------------------------------------------
// Cursor control
// -----------------------------------------------------------------------

pub fn hideCursor(writer: anytype, is_tty: bool) !void {
    if (is_tty) try writer.writeAll(HIDE_CURSOR);
}

pub fn showCursor(writer: anytype, is_tty: bool) !void {
    if (is_tty) try writer.writeAll(SHOW_CURSOR);
}

pub fn clearLine(writer: anytype, is_tty: bool) !void {
    if (is_tty) try writer.writeAll(CLEAR_LINE);
}

pub fn moveCursorUp(writer: anytype, n: u32, is_tty: bool) !void {
    if (!is_tty or n == 0) return;
    if (n == 1) {
        try writer.writeAll(MOVE_UP_ONE);
    } else {
        var num_buf: [32]u8 = undefined;
        const seq = std.fmt.bufPrint(&num_buf, ESC ++ "{d}A", .{n}) catch return;
        try writer.writeAll(seq);
    }
}

// -----------------------------------------------------------------------
// Box / framing – styled intro & outro similar to @clack/prompts
// -----------------------------------------------------------------------

/// Default frame width (characters) used when terminal width is unknown.
const DEFAULT_WIDTH: usize = 50;

pub fn groupLine(writer: anytype, is_tty: bool) !void {
    if (is_tty) {
        try writer.writeAll(FG_GRAY);
        try writer.writeAll("│  ");
        try writer.writeAll(RESET);
    } else {
        try writer.writeAll("  ");
    }
}

/// Print a styled intro header.
///
/// ```
/// ┌  Ody
/// │
/// ```
pub fn intro(writer: anytype, title: []const u8, is_tty: bool) !void {
    try writer.writeAll("\n");
    if (is_tty) {
        try writer.writeAll(FG_GRAY);
        try writer.writeAll("┌  ");
        try writer.writeAll(RESET);
        try writer.writeAll(BOLD);
        try writer.writeAll(title);
        try writer.writeAll(RESET);
        try writer.writeAll("\n");
        try writer.writeAll(FG_GRAY);
        try writer.writeAll("│");
        try writer.writeAll(RESET);
        try writer.writeAll("\n");
    } else {
        try writer.writeAll("  ");
        try writer.writeAll(title);
        try writer.writeAll("\n\n");
    }
}

/// Print a styled outro footer.
///
/// ```
/// │
/// └  message
/// ```
pub fn outro(writer: anytype, message: []const u8, is_tty: bool) !void {
    try groupLine(writer, is_tty);

    if (is_tty) {
        try writer.writeAll("\n");
        try writer.writeAll(FG_GRAY);
        try writer.writeAll("└  ");
        try writer.writeAll(RESET);
        try writer.writeAll(message);
        try writer.writeAll("\n");
    } else {
        try writer.writeAll("\n  ");
        try writer.writeAll(message);
        try writer.writeAll("\n");
    }
    try writer.writeAll("\n");
}

/// Print a styled log line (indented under the box frame).
///
/// ```
/// │  message
/// ```
pub fn log(writer: anytype, message: []const u8, is_tty: bool) !void {
    try groupLine(writer, is_tty);
    try writer.writeAll(message);
    try writer.writeAll("\n");
}

/// Print a styled warning line.
pub fn warn(writer: anytype, message: []const u8, is_tty: bool) !void {
    try groupLine(writer, is_tty);

    if (is_tty) {
        try writer.writeAll(FG_YELLOW);
        try writer.writeAll(message);
        try writer.writeAll(RESET);
    } else {
        try writer.writeAll("  WARN: ");
        try writer.writeAll(message);
    }
    try writer.writeAll("\n");
}

/// Print a styled error line.
pub fn err(writer: anytype, message: []const u8, is_tty: bool) !void {
    try groupLine(writer, is_tty);

    if (is_tty) {
        try writer.writeAll(FG_RED);
        try writer.writeAll(message);
        try writer.writeAll(RESET);
    } else {
        try writer.writeAll("  ERROR: ");
        try writer.writeAll(message);
    }
    try writer.writeAll("\n");
}

// -----------------------------------------------------------------------
// Spinner
// -----------------------------------------------------------------------

/// A thread-based braille spinner that animates on the terminal while a
/// long-running operation is in progress.
///
/// Usage:
/// ```zig
/// var spinner = Spinner.init(writer, is_tty);
/// spinner.start("Loading...");
/// // ... do work ...
/// spinner.stop("Done.");
/// ```
pub const Spinner = struct {
    file: std.fs.File,
    is_tty: bool,
    running: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    thread: ?std.Thread = null,
    message: []const u8 = "",

    pub fn init(file: std.fs.File, is_tty: bool) Spinner {
        return .{
            .file = file,
            .is_tty = is_tty,
        };
    }

    /// Begin the spinner animation with the given status message.
    pub fn start(self: *Spinner, message: []const u8) void {
        self.message = message;
        self.running.store(true, .release);

        if (!self.is_tty) {
            // Non-TTY: just print the message once, no animation.
            self.file.writeAll("  ") catch {};
            self.file.writeAll(message) catch {};
            self.file.writeAll("\n") catch {};
            return;
        }

        hideCursor(self.file, true) catch {};

        self.thread = std.Thread.spawn(.{}, animateLoop, .{self}) catch null;
    }

    /// Stop the spinner, clear its line, and print `final_message`.
    pub fn stop(self: *Spinner, final_message: []const u8) void {
        self.running.store(false, .release);

        if (self.thread) |t| {
            t.join();
            self.thread = null;
        }

        if (self.is_tty) {
            clearLine(self.file, true) catch {};
            showCursor(self.file, true) catch {};
        }

        // Print the final line in the framed log style.
        log(self.file, final_message, self.is_tty) catch {};
    }

    /// Update the spinner's message while it's running.
    pub fn setMessage(self: *Spinner, message: []const u8) void {
        self.message = message;
    }

    fn animateLoop(self: *Spinner) void {
        var frame_idx: usize = 0;
        while (self.running.load(.acquire)) {
            const frame = SPINNER_FRAMES[frame_idx % SPINNER_FRAMES.len];

            clearLine(self.file, true) catch {};
            groupLine(self.file, self.is_tty) catch {};
            self.file.writeAll(FG_CYAN) catch {};
            self.file.writeAll(frame) catch {};
            self.file.writeAll(RESET) catch {};
            self.file.writeAll("  ") catch {};
            self.file.writeAll(self.message) catch {};

            frame_idx +%= 1;
            std.Thread.sleep(SPINNER_INTERVAL_NS);
        }
    }
};

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "red writes ANSI escape codes in TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try red(writer, "error", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, FG_RED) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "error") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, RESET) != null);
}

test "red writes plain text in non-TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try red(writer, "error", false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("error", output);
}

test "green writes ANSI escape codes in TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try green(writer, "success", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, FG_GREEN) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "success") != null);
}

test "yellow writes plain text in non-TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try yellow(writer, "warning", false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("warning", output);
}

test "bold writes ANSI escape codes in TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try bold(writer, "important", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, BOLD) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "important") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, RESET) != null);
}

test "dim writes plain text in non-TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try dim(writer, "subtle", false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("subtle", output);
}

test "cyan writes ANSI escape codes in TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try cyan(writer, "info", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, FG_CYAN) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "info") != null);
}

test "hideCursor emits escape code on TTY" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try hideCursor(writer, true);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings(HIDE_CURSOR, output);
}

test "hideCursor is no-op on non-TTY" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try hideCursor(writer, false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("", output);
}

test "showCursor emits escape code on TTY" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try showCursor(writer, true);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings(SHOW_CURSOR, output);
}

test "clearLine emits escape code on TTY" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try clearLine(writer, true);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings(CLEAR_LINE, output);
}

test "moveCursorUp emits correct escape for n=1" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try moveCursorUp(writer, 1, true);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings(MOVE_UP_ONE, output);
}

test "moveCursorUp emits correct escape for n>1" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try moveCursorUp(writer, 5, true);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings(ESC ++ "5A", output);
}

test "moveCursorUp is no-op for n=0" {
    var buf: [64]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try moveCursorUp(writer, 0, true);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("", output);
}

test "intro writes styled output on TTY" {
    var buf: [512]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try intro(writer, "Ody", true);

    const output = fbs.getWritten();
    // Should contain the box drawing char, the title, and ANSI codes
    try std.testing.expect(std.mem.indexOf(u8, output, "┌") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "Ody") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "│") != null);
}

test "intro writes plain text on non-TTY" {
    var buf: [512]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try intro(writer, "Ody", false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("\n  Ody\n\n", output);
}

test "outro writes styled output on TTY" {
    var buf: [512]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try outro(writer, "Goodbye", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "└") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "Goodbye") != null);
}

test "outro writes plain text on non-TTY" {
    var buf: [512]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try outro(writer, "Goodbye", false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("\n  Goodbye\n\n", output);
}

test "log writes framed message on TTY" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try log(writer, "hello", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "│") != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "hello") != null);
}

test "log writes plain indented text on non-TTY" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try log(writer, "hello", false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("  hello\n", output);
}

test "warn writes yellow message on TTY" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try warn(writer, "careful", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, FG_YELLOW) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "careful") != null);
}

test "err writes red message on TTY" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try err(writer, "failed", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, FG_RED) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "failed") != null);
}

test "isTty returns false for invalid fd" {
    // fd -1 is never a valid TTY
    try std.testing.expect(!isTty(-1));
}

test "gray writes ANSI escape codes in TTY mode" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try gray(writer, "muted", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, FG_GRAY) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "muted") != null);
}

test "boldColor writes combined bold+color on TTY" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try boldColor(writer, FG_GREEN, "title", true);

    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, BOLD) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, FG_GREEN) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "title") != null);
}

test "boldColor writes plain text on non-TTY" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try boldColor(writer, FG_GREEN, "title", false);

    const output = fbs.getWritten();
    try std.testing.expectEqualStrings("title", output);
}

test "getTerminalWidth returns a positive value" {
    const width = getTerminalWidth();
    try std.testing.expect(width > 0);
}

test "computeVisualRows returns 1 for empty content" {
    try std.testing.expectEqual(@as(u16, 1), computeVisualRows(0, 80));
}

test "computeVisualRows returns 1 for content shorter than terminal width" {
    try std.testing.expectEqual(@as(u16, 1), computeVisualRows(40, 80));
}

test "computeVisualRows returns 1 for content exactly equal to terminal width" {
    try std.testing.expectEqual(@as(u16, 1), computeVisualRows(80, 80));
}

test "computeVisualRows returns 2 for content one char over terminal width" {
    try std.testing.expectEqual(@as(u16, 2), computeVisualRows(81, 80));
}

test "computeVisualRows returns correct value for multiple wraps" {
    try std.testing.expectEqual(@as(u16, 3), computeVisualRows(200, 80));
}

test "computeVisualRows handles zero terminal width gracefully" {
    try std.testing.expectEqual(@as(u16, 1), computeVisualRows(50, 0));
}

test "clearMultipleLines single row emits clearLine" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try clearMultipleLines(writer, 1, true);

    const output = fbs.getWritten();
    // Should contain the clear-line escape and a carriage return
    try std.testing.expect(std.mem.indexOf(u8, output, CLEAR_LINE) != null);
    try std.testing.expect(std.mem.indexOf(u8, output, "\r") != null);
}

test "clearMultipleLines multi-row emits cursor-up and multiple clears" {
    var buf: [1024]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try clearMultipleLines(writer, 3, true);

    const output = fbs.getWritten();
    // Should have moved cursor up (ESC[2A for 2 lines up)
    try std.testing.expect(std.mem.indexOf(u8, output, ESC ++ "2A") != null);
    // Should contain multiple clear-line sequences
    var count: usize = 0;
    var pos: usize = 0;
    while (std.mem.indexOfPos(u8, output, pos, CLEAR_LINE)) |idx| {
        count += 1;
        pos = idx + CLEAR_LINE.len;
    }
    try std.testing.expectEqual(@as(usize, 3), count);
}

test "clearMultipleLines non-TTY emits no escape codes" {
    var buf: [256]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buf);
    const writer = fbs.writer();

    try clearMultipleLines(writer, 3, false);

    const output = fbs.getWritten();
    // Non-TTY should not contain any ESC sequences
    try std.testing.expect(std.mem.indexOf(u8, output, "\x1b[") == null);
}
