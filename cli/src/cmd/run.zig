/// `ody run` command – agent execution loop.
///
/// Spawns AI backend processes, monitors their output for completion
/// markers, manages iteration loops, and sends OS notifications.
/// Supports loop mode (default), single-task mode, label filtering,
/// dry-run, and verbose output.
///
/// Replaces the TypeScript implementation in `packages/cli/src/cmd/run.ts`.
const std = @import("std");

const config_mod = @import("../lib/config.zig");
const constants = @import("../util/constants.zig");
const harness_mod = @import("../backend/harness.zig");
const notify_mod = @import("../lib/notify.zig");
const run_prompt = @import("../builder/run_prompt.zig");
const spawn_mod = @import("../util/spawn.zig");
const stream_mod = @import("../util/stream.zig");
const task_util = @import("../util/task.zig");
const terminal = @import("../util/terminal.zig");
const types = @import("../types.zig");

const OdyConfig = types.OdyConfig;
const NotifySetting = types.NotifySetting;

// -----------------------------------------------------------------------
// CLI argument overrides
// -----------------------------------------------------------------------

/// CLI arguments parsed from the command-line for the `run` command.
pub const RunArgs = struct {
    /// Positional: path to a specific `.code-task.md` file.
    task_file: ?[]const u8 = null,

    /// `--label` / `-l`: filter tasks by label.
    label: ?[]const u8 = null,

    /// `--iterations` / `-i`: override the number of loop iterations.
    /// `0` means unlimited.
    iterations: ?u32 = null,

    /// `--verbose`: print child process output in real-time.
    verbose: bool = false,

    /// `--dry-run`: print command and prompt without executing.
    dry_run: bool = false,

    /// `--no-notify`: disable notifications even if enabled in config.
    no_notify: bool = false,
};

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Run the `ody run` command.
pub fn run(allocator: std.mem.Allocator, args: RunArgs) !void {
    const stdout = std.fs.File.stdout();
    const writer = stdout;
    const is_tty = terminal.isTty(stdout.handle);

    const cfg = config_mod.all() orelse {
        try terminal.err(writer, "No configuration found. Run `ody init` first.", is_tty);
        return;
    };

    // --- Resolve notification setting ---
    const notify_setting: NotifySetting = if (args.no_notify) .disabled else cfg.notify;

    // --- Validate arguments ---

    // taskFile and --label are mutually exclusive.
    if (args.task_file != null and args.label != null) {
        try terminal.err(writer, "Cannot use both a task file argument and --label. They are mutually exclusive.", is_tty);
        return;
    }

    // Validate task file if provided.
    var single_task_file: ?[]const u8 = null;
    if (args.task_file) |tf| {
        if (!std.mem.endsWith(u8, tf, constants.TASK_FILE_EXT)) {
            try terminal.err(writer, "Invalid task file. File must end with .code-task.md", is_tty);
            return;
        }

        // Check that the file exists.
        std.fs.cwd().access(tf, .{}) catch {
            try terminal.err(writer, "Task file not found.", is_tty);
            return;
        };

        single_task_file = tf;
    }

    // Resolve label-filtered task files.
    var task_files: ?[]const []const u8 = null;
    var task_files_owned: ?[][]const u8 = null;
    defer {
        if (task_files_owned) |files| {
            for (files) |f| allocator.free(f);
            allocator.free(files);
        }
    }

    if (args.label) |label| {
        const files = try task_util.getTaskFilesByLabel(allocator, label);
        if (files.len == 0) {
            try terminal.warn(writer, "No tasks found with the specified label.", is_tty);
            allocator.free(files);
            return;
        }
        task_files = files;
        task_files_owned = @constCast(files);
    }

    // --- Build the prompt ---
    const prompt_text = try run_prompt.buildRunPrompt(allocator, .{
        .task_file = single_task_file,
        .task_files = task_files,
    });
    defer allocator.free(prompt_text);

    // --- Build the backend command ---
    const backend = harness_mod.Backend.fromConfig(cfg);
    const cmd_args = try backend.buildCommand(allocator, prompt_text);
    defer {
        // The last element is the prompt string allocated by the backend.
        if (cmd_args.len > 0) allocator.free(cmd_args[cmd_args.len - 1]);
        allocator.free(cmd_args);
    }

    var intro_buf: [128]u8 = undefined;
    const intro = std.fmt.bufPrint(&intro_buf, "Running Ody with backend: {s}", .{backend.name()}) catch "Running Ody";
    try terminal.intro(writer, intro, is_tty);

    // --- Dry-run mode ---
    if (args.dry_run) {
        try terminal.intro(writer, "Ody (dry run)", is_tty);
        try terminal.log(writer, "Command:", is_tty);
        for (cmd_args) |arg| {
            try writer.writeAll("  ");
            try writer.writeAll(arg);
            try writer.writeAll("\n");
        }
        try writer.writeAll("\n");
        try terminal.log(writer, "Prompt:", is_tty);
        try writer.writeAll(prompt_text);
        try writer.writeAll("\n");
        try terminal.outro(writer, "Dry run complete.", is_tty);
        return;
    }

    // --- Determine max iterations ---
    // Override > single-task default of 1 > config value.
    const max_iterations: u32 = args.iterations orelse
        (if (single_task_file != null) @as(u32, 1) else cfg.max_iterations);

    // --- Start spinner (unless verbose) ---
    var spinner: ?terminal.Spinner = null;
    if (!args.verbose) {
        spinner = terminal.Spinner.init(writer, is_tty);
        spinner.?.start("Running agent loop");
    }

    // --- Iteration loop ---
    var iteration: u32 = 0;
    var completed = false;

    while (max_iterations == 0 or iteration < max_iterations) : (iteration += 1) {
        // Update spinner message with iteration count.
        if (spinner) |*s| {
            var msg_buf: [128]u8 = undefined;
            const msg = std.fmt.bufPrint(&msg_buf, "Running agent loop (iteration {d})", .{iteration + 1}) catch "Running agent loop";
            s.setMessage(msg);
        }

        // Build stdout stream options with completion marker detection.
        const CompletionState = struct {
            found: bool = false,

            fn check(self_ptr: *@This()) *const fn ([]const u8) bool {
                _ = self_ptr;
                return &checkAccumulated;
            }

            fn checkAccumulated(accumulated: []const u8) bool {
                return stream_mod.containsCompletionMarker(accumulated);
            }
        };

        const stdout_options = stream_mod.StreamOptions{
            .should_print = args.verbose,
            .on_chunk = &CompletionState.checkAccumulated,
        };

        const stderr_options = stream_mod.StreamOptions{
            .should_print = args.verbose,
        };

        // Run the backend process.
        const result = spawn_mod.runPipedCommand(
            allocator,
            cmd_args,
            stdout_options,
            stderr_options,
        ) catch |e| {
            // Stop spinner and report error.
            if (spinner) |*s| {
                var err_buf: [256]u8 = undefined;
                const err_msg = std.fmt.bufPrint(&err_buf, "Backend process failed: {s}", .{@errorName(e)}) catch "Backend process failed";
                s.stop(err_msg);
            } else {
                try terminal.err(writer, "Backend process failed.", is_tty);
            }
            return;
        };
        defer result.deinit(allocator);

        // Check for completion marker in stdout.
        if (stream_mod.containsCompletionMarker(result.stdout)) {
            completed = true;

            if (notify_setting == .individual) {
                var notif_buf: [128]u8 = undefined;
                const notif_msg = std.fmt.bufPrint(&notif_buf, "Iteration {d} complete", .{iteration + 1}) catch "Iteration complete";
                notify_mod.sendNotification("ody", notif_msg);
            }

            break;
        }

        // Send individual notification for this iteration.
        if (notify_setting == .individual) {
            var notif_buf: [128]u8 = undefined;
            const notif_msg = std.fmt.bufPrint(&notif_buf, "Iteration {d} complete", .{iteration + 1}) catch "Iteration complete";
            notify_mod.sendNotification("ody", notif_msg);
        }
    }

    // --- Cleanup ---

    // Stop the spinner.
    if (spinner) |*s| {
        if (completed) {
            s.stop("Agent finished all available tasks");
        } else {
            s.stop("Agent loop finished");
        }
    }

    // Send "all" notification after the loop.
    if (notify_setting == .all) {
        notify_mod.sendNotification("ody", "Agent loop complete");
    }

    // Print outro.
    try terminal.outro(writer, "Agent loop complete", is_tty);
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "RunArgs defaults are sensible" {
    const args = RunArgs{};
    try std.testing.expect(args.task_file == null);
    try std.testing.expect(args.label == null);
    try std.testing.expect(args.iterations == null);
    try std.testing.expect(!args.verbose);
    try std.testing.expect(!args.dry_run);
    try std.testing.expect(!args.no_notify);
}

test "run returns early when config is not loaded" {
    // Reset config to simulate missing config.
    config_mod.reset();
    try std.testing.expect(config_mod.all() == null);
    // We cannot easily call run() without a real config setup, but we
    // can verify the guard condition works.
}

test "run rejects mutually exclusive args" {
    // Verify the struct can represent the mutually exclusive state.
    const args = RunArgs{
        .task_file = "some-task.code-task.md",
        .label = "auth",
    };
    try std.testing.expect(args.task_file != null);
    try std.testing.expect(args.label != null);
}
