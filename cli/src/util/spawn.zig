/// Process spawning utilities for piped and interactive modes.
///
/// Provides convenience wrappers around `std.process.Child` for the two
/// main spawning patterns used by the Ody CLI:
///
/// * **Piped mode** (`spawnPiped`, `runPipedCommand`): stdin is closed,
///   stdout and stderr are piped and drained concurrently.  Used by the
///   default `ody run` loop, `ody plan`, and `ody task edit`.
///
/// * **Interactive/PTY mode** (`spawnInteractive`): deferred for the
///   initial Zig rewrite -- a stub is provided that spawns with inherited
///   stdio as a simpler fallback for `ody run --once`.
const std = @import("std");
const stream_mod = @import("stream.zig");

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

/// Result of running a piped command to completion.
pub const CommandResult = struct {
    /// Captured stdout output.  Owned by the caller's allocator.
    stdout: []const u8,
    /// Captured stderr output.  Owned by the caller's allocator.
    stderr: []const u8,
    /// The child's exit status as returned by `wait()`.
    term: std.process.Child.Term,

    /// Returns `true` when the child exited cleanly with code 0.
    pub fn succeeded(self: CommandResult) bool {
        return self.term == .Exited and self.term.Exited == 0;
    }

    /// Free both output buffers.
    pub fn deinit(self: CommandResult, allocator: std.mem.Allocator) void {
        if (self.stdout.len > 0) allocator.free(self.stdout);
        if (self.stderr.len > 0) allocator.free(self.stderr);
    }
};

/// Options for `spawnPiped` controlling stderr behaviour.
pub const SpawnOptions = struct {
    /// When `true`, stderr is inherited (written directly to the
    /// terminal) rather than piped.  Useful for `--verbose` mode.
    inherit_stderr: bool = false,
};

// -----------------------------------------------------------------------
// Piped mode
// -----------------------------------------------------------------------

/// Spawn a child process with stdin closed and stdout piped.
///
/// Stderr is piped by default; set `opts.inherit_stderr` to have it
/// written to the terminal instead.  Returns the running `Child` handle.
/// The caller is responsible for:
///   1. Draining the piped streams (via `stream.drainStream`)
///   2. Calling `child.wait()` after streams are drained
pub fn spawnPiped(
    allocator: std.mem.Allocator,
    argv: []const []const u8,
    opts: SpawnOptions,
) !std.process.Child {
    var child = std.process.Child.init(argv, allocator);
    child.stdin_behavior = .Close;
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = if (opts.inherit_stderr) .Inherit else .Pipe;

    try child.spawn();
    return child;
}

/// Thread context for draining a pipe in a background thread.
const DrainCtx = struct {
    allocator: std.mem.Allocator,
    file: std.fs.File,
    options: stream_mod.StreamOptions,
    result: ?[]const u8 = null,
    err: ?anyerror = null,
};

fn drainThread(ctx: *DrainCtx) void {
    ctx.result = stream_mod.drainStream(ctx.allocator, ctx.file, ctx.options) catch |e| {
        ctx.err = e;
        return;
    };
}

/// Spawn a piped child process and run it to completion, draining stdout
/// and stderr concurrently on separate threads.
///
/// Returns a `CommandResult` with the captured outputs and exit status.
/// The caller owns the `stdout` and `stderr` slices and should call
/// `result.deinit(allocator)` when done.
pub fn runPipedCommand(
    allocator: std.mem.Allocator,
    argv: []const []const u8,
    stdout_options: stream_mod.StreamOptions,
    stderr_options: stream_mod.StreamOptions,
) !CommandResult {
    var child = try spawnPiped(allocator, argv, .{
        // When stderr has should_print, we still pipe it so we can capture
        // it -- the drainStream function handles the printing.
        .inherit_stderr = false,
    });

    // Set up drain contexts for concurrent pipe reading.
    var stdout_ctx = DrainCtx{
        .allocator = allocator,
        .file = child.stdout.?,
        .options = stdout_options,
    };

    var stderr_ctx = DrainCtx{
        .allocator = allocator,
        .file = child.stderr.?,
        .options = stderr_options,
    };

    // Spawn a background thread for stderr; drain stdout on this thread.
    const stderr_thread = try std.Thread.spawn(.{}, drainThread, .{&stderr_ctx});

    // Drain stdout on the current thread.
    drainThread(&stdout_ctx);

    // Wait for stderr thread to finish.
    stderr_thread.join();

    // Check for drain errors.
    if (stdout_ctx.err) |e| return e;
    if (stderr_ctx.err) |e| return e;

    // Wait for the child process to exit.
    const term = try child.wait();

    return CommandResult{
        .stdout = stdout_ctx.result orelse "",
        .stderr = stderr_ctx.result orelse "",
        .term = term,
    };
}

// -----------------------------------------------------------------------
// Interactive / PTY mode (deferred -- simple fallback)
// -----------------------------------------------------------------------

/// Spawn a child process with inherited stdio for interactive use.
///
/// This is a simplified fallback for `ody run --once`.  It does **not**
/// create a PTY; the child shares the parent's terminal directly.
/// Because stdio is inherited, output cannot be captured or inspected
/// for completion markers -- the process simply runs until it exits.
///
/// A full PTY implementation (using `std.posix.openpty` / `forkpty`) can
/// be added later when interactive completion detection is required.
pub fn spawnInteractive(
    allocator: std.mem.Allocator,
    argv: []const []const u8,
) !std.process.Child {
    var child = std.process.Child.init(argv, allocator);
    child.stdin_behavior = .Inherit;
    child.stdout_behavior = .Inherit;
    child.stderr_behavior = .Inherit;

    try child.spawn();
    return child;
}

/// Run an interactive child process to completion and return its exit term.
pub fn runInteractive(
    allocator: std.mem.Allocator,
    argv: []const []const u8,
) !std.process.Child.Term {
    var child = try spawnInteractive(allocator, argv);
    return try child.wait();
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "spawnPiped spawns and captures stdout" {
    const allocator = std.testing.allocator;
    const argv: []const []const u8 = &.{ "echo", "hello world" };

    var child = try spawnPiped(allocator, argv, .{});

    const stdout_output = try stream_mod.drainStream(allocator, child.stdout.?, .{});
    defer allocator.free(stdout_output);

    // Also drain stderr to prevent pipe buffer deadlock.
    const stderr_output = try stream_mod.drainStream(allocator, child.stderr.?, .{});
    defer allocator.free(stderr_output);

    const term = try child.wait();

    try std.testing.expect(term == .Exited);
    try std.testing.expectEqual(@as(u32, 0), term.Exited);
    // echo adds a newline; check the trimmed content.
    try std.testing.expectEqualStrings("hello world\n", stdout_output);
}

test "spawnPiped captures stderr" {
    const allocator = std.testing.allocator;
    // Use sh -c to write to stderr explicitly.
    const argv: []const []const u8 = &.{ "sh", "-c", "echo error_msg >&2" };

    var child = try spawnPiped(allocator, argv, .{});

    const stdout_output = try stream_mod.drainStream(allocator, child.stdout.?, .{});
    defer allocator.free(stdout_output);

    const stderr_output = try stream_mod.drainStream(allocator, child.stderr.?, .{});
    defer allocator.free(stderr_output);

    const term = try child.wait();

    try std.testing.expect(term == .Exited);
    try std.testing.expectEqual(@as(u32, 0), term.Exited);
    try std.testing.expectEqualStrings("error_msg\n", stderr_output);
}

test "runPipedCommand captures stdout and exit code" {
    const allocator = std.testing.allocator;
    const argv: []const []const u8 = &.{ "echo", "piped output" };

    const result = try runPipedCommand(allocator, argv, .{}, .{});
    defer result.deinit(allocator);

    try std.testing.expect(result.succeeded());
    try std.testing.expectEqualStrings("piped output\n", result.stdout);
}

test "runPipedCommand captures non-zero exit code" {
    const allocator = std.testing.allocator;
    const argv: []const []const u8 = &.{ "sh", "-c", "exit 42" };

    const result = try runPipedCommand(allocator, argv, .{}, .{});
    defer result.deinit(allocator);

    try std.testing.expect(!result.succeeded());
    try std.testing.expect(result.term == .Exited);
    try std.testing.expectEqual(@as(u32, 42), result.term.Exited);
}

test "runPipedCommand drains both stdout and stderr concurrently" {
    const allocator = std.testing.allocator;
    // Write to both stdout and stderr.
    const argv: []const []const u8 = &.{
        "sh", "-c", "echo out_line && echo err_line >&2",
    };

    const result = try runPipedCommand(allocator, argv, .{}, .{});
    defer result.deinit(allocator);

    try std.testing.expect(result.succeeded());
    try std.testing.expectEqualStrings("out_line\n", result.stdout);
    try std.testing.expectEqualStrings("err_line\n", result.stderr);
}

test "runPipedCommand stops early via on_chunk callback" {
    const allocator = std.testing.allocator;
    // Generate output containing the completion marker.
    const marker = "<woof>COMPLETE</woof>";
    const argv: []const []const u8 = &.{
        "sh", "-c", "echo 'before'; echo '" ++ marker ++ "'; echo 'after'",
    };

    const S = struct {
        fn checkMarker(accumulated: []const u8) bool {
            return stream_mod.containsCompletionMarker(accumulated);
        }
    };

    const result = try runPipedCommand(
        allocator,
        argv,
        .{ .on_chunk = &S.checkMarker },
        .{},
    );
    defer result.deinit(allocator);

    // The callback should have fired; the accumulated output should contain the marker.
    try std.testing.expect(stream_mod.containsCompletionMarker(result.stdout));
}

test "CommandResult.succeeded returns true for exit code 0" {
    const result = CommandResult{
        .stdout = "",
        .stderr = "",
        .term = .{ .Exited = 0 },
    };
    try std.testing.expect(result.succeeded());
}

test "CommandResult.succeeded returns false for non-zero exit" {
    const result = CommandResult{
        .stdout = "",
        .stderr = "",
        .term = .{ .Exited = 1 },
    };
    try std.testing.expect(!result.succeeded());
}

test "CommandResult.succeeded returns false for signal termination" {
    const result = CommandResult{
        .stdout = "",
        .stderr = "",
        .term = .{ .Signal = 15 },
    };
    try std.testing.expect(!result.succeeded());
}

test "spawnPiped with inherit_stderr does not pipe stderr" {
    const allocator = std.testing.allocator;
    // When inherit_stderr is true, child.stderr should be null.
    const argv: []const []const u8 = &.{ "echo", "test" };
    var child = try spawnPiped(allocator, argv, .{ .inherit_stderr = true });

    // stderr should be null since it's inherited.
    try std.testing.expect(child.stderr == null);

    // Still need to drain stdout and wait.
    const stdout_output = try stream_mod.drainStream(allocator, child.stdout.?, .{});
    defer allocator.free(stdout_output);

    const term = try child.wait();
    try std.testing.expect(term == .Exited);
    try std.testing.expectEqual(@as(u32, 0), term.Exited);
}
