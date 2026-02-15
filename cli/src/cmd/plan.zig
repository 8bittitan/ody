/// `ody plan new` command – interactive task plan creation.
///
/// Prompts the user for a task description, builds a plan prompt, spawns
/// the AI backend to generate a `.code-task.md` file, and optionally
/// loops to create additional tasks.  Supports `--dry-run` and `--verbose`
/// flags.
///
/// Replaces the TypeScript implementation in `packages/cli/src/cmd/plan/new.ts`.
const std = @import("std");

const config_mod = @import("../lib/config.zig");
const constants = @import("../util/constants.zig");
const harness_mod = @import("../backend/harness.zig");
const plan_prompt = @import("../builder/plan_prompt.zig");
const prompt = @import("../util/prompt.zig");
const spawn_mod = @import("../util/spawn.zig");
const stream_mod = @import("../util/stream.zig");
const terminal = @import("../util/terminal.zig");

// -----------------------------------------------------------------------
// CLI argument overrides
// -----------------------------------------------------------------------

/// CLI arguments parsed from the command-line for the `plan new` command.
pub const NewArgs = struct {
    /// `--dry-run`: print the constructed prompt without spawning the backend.
    dry_run: bool = false,

    /// `--verbose`: print backend output in real-time.
    verbose: bool = false,
};

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/// Run the `ody plan new` command.
pub fn run(allocator: std.mem.Allocator, args: NewArgs) !void {
    const stdout = std.fs.File.stdout();
    const writer = stdout;
    const is_tty = terminal.isTty(stdout.handle);

    const cfg = config_mod.all() orelse {
        try terminal.err(writer, "No configuration found. Run `ody init` first.", is_tty);
        return;
    };

    try terminal.intro(writer, "Create a new task plan", is_tty);

    const backend = harness_mod.Backend.fromConfig(cfg);

    while (true) {
        // --- Prompt for task description ---
        const description = try prompt.text(
            allocator,
            "Describe the task you want to plan",
            "",
            validateNonEmpty,
        );

        if (description == null) {
            try terminal.outro(writer, "Plan cancelled.", is_tty);
            return;
        }

        const desc = description.?;
        defer allocator.free(desc);

        // --- Build the plan prompt ---
        const prompt_text = try plan_prompt.buildPlanPrompt(allocator, desc);
        defer allocator.free(prompt_text);

        // --- Dry-run mode ---
        if (args.dry_run) {
            try terminal.log(writer, "Prompt (dry run):", is_tty);
            try writer.writeAll(prompt_text);
            try writer.writeAll("\n");
        } else {
            // Ensure .ody/tasks/ directory exists.
            const tasks_path = @import("../util/task.zig").resolveTasksDir();
            std.fs.cwd().makePath(tasks_path) catch |e| {
                try terminal.err(writer, "Failed to create tasks directory.", is_tty);
                return e;
            };

            // Build backend command.
            const cmd_args = try backend.buildOnceCommand(allocator, prompt_text);
            defer {
                if (cmd_args.len > 0) allocator.free(cmd_args[cmd_args.len - 1]);
                allocator.free(cmd_args);
            }

            // Start spinner (unless verbose).
            var spinner: ?terminal.Spinner = null;
            if (!args.verbose) {
                spinner = terminal.Spinner.init(writer, is_tty);
                spinner.?.start("Generating task plan");
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
                s.stop("Task plan generated");
            }
        }

        try terminal.log(writer, "", is_tty);

        // --- Ask to continue ---
        const another = try prompt.confirm(
            "Would you like to add another plan?",
            false,
        );

        if (another == null or !another.?) {
            break;
        }
    }

    try terminal.outro(writer, "Task planning complete", is_tty);
}

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/// Validate that the text input is not empty or whitespace-only.
fn validateNonEmpty(input: []const u8) ?[]const u8 {
    if (input.len == 0) return "Please enter a task description.";
    // Check for whitespace-only
    for (input) |c| {
        if (c != ' ' and c != '\t' and c != '\n' and c != '\r') return null;
    }
    return "Please enter a task description.";
}

/// Callback for stream draining: stop when the completion marker is found.
fn checkCompletion(accumulated: []const u8) bool {
    return stream_mod.containsCompletionMarker(accumulated);
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "NewArgs defaults are sensible" {
    const args = NewArgs{};
    try std.testing.expect(!args.dry_run);
    try std.testing.expect(!args.verbose);
}

test "validateNonEmpty rejects empty string" {
    try std.testing.expect(validateNonEmpty("") != null);
}

test "validateNonEmpty rejects whitespace-only" {
    try std.testing.expect(validateNonEmpty("   ") != null);
    try std.testing.expect(validateNonEmpty("\t\n") != null);
}

test "validateNonEmpty accepts valid input" {
    try std.testing.expect(validateNonEmpty("add auth") == null);
    try std.testing.expect(validateNonEmpty("a") == null);
}

test "checkCompletion detects marker" {
    try std.testing.expect(checkCompletion("output <woof>COMPLETE</woof> trailing"));
    try std.testing.expect(checkCompletion("<woof>COMPLETE</woof>"));
}

test "checkCompletion returns false without marker" {
    try std.testing.expect(!checkCompletion("just some output"));
    try std.testing.expect(!checkCompletion(""));
}
