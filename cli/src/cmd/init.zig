/// `ody init` command – interactive wizard for setting up an Ody project.
///
/// Creates the `.ody/` directory, detects available backends, and walks the
/// user through configuring all project settings. Supports flag overrides
/// for non-interactive usage and a `--dry-run` mode.
///
/// Replaces the TypeScript implementation in `packages/cli/src/cmd/init.ts`.
const std = @import("std");

const config_mod = @import("../lib/config.zig");
const constants = @import("../util/constants.zig");
const detect = @import("../backend/detect.zig");
const prompt = @import("../util/prompt.zig");
const terminal = @import("../util/terminal.zig");
const types = @import("../types.zig");

const OdyConfig = types.OdyConfig;
const NotifySetting = types.NotifySetting;

/// CLI argument overrides passed from the command-line parser.
pub const InitArgs = struct {
    /// `-b` backend override.
    backend: ?[]const u8 = null,
    /// `-i` max iterations override.
    max_iterations: ?u32 = null,
    /// `-m` model override.
    model: ?[]const u8 = null,
    /// `-c` should commit override.
    should_commit: ?bool = null,
    /// `-a` agent profile override.
    agent: ?[]const u8 = null,
    /// `-n` notify override.
    notify: ?[]const u8 = null,
    /// `--dry-run` flag.
    dry_run: bool = false,
};

/// Run the init command.
pub fn run(allocator: std.mem.Allocator, args: InitArgs) !void {
    const stdout = std.fs.File.stdout();
    const is_tty = terminal.isTty(std.posix.STDOUT_FILENO);

    // Print intro.
    try terminal.intro(stdout, "Initializing Ody", is_tty);

    // Create .ody/ directory if it doesn't exist.
    std.fs.cwd().makePath(constants.BASE_DIR) catch |e| {
        try terminal.err(stdout, "Failed to create .ody/ directory", is_tty);
        return e;
    };

    // ---------------------------------------------------------------
    // 1. Backend selection
    // ---------------------------------------------------------------
    var backend: ?[]const u8 = args.backend;

    const available_backends = try detect.getAvailableBackends(allocator);
    defer allocator.free(available_backends);

    if (backend) |b| {
        // Validate the flag-provided backend is actually available.
        var found = false;
        for (available_backends) |ab| {
            if (std.mem.eql(u8, ab.value, b)) {
                found = true;
                break;
            }
        }
        if (!found) {
            var msg_buf: [256]u8 = undefined;
            const msg = std.fmt.bufPrint(&msg_buf, "Selected backend is not available on your system: {s}", .{b}) catch "Selected backend is not available";
            try terminal.warn(stdout, msg, is_tty);
            backend = null;
        }
    }

    if (backend == null) {
        if (available_backends.len == 0) {
            try terminal.err(stdout, "No backends found. Install claude, opencode, or codex first.", is_tty);
            return;
        }

        // Build autocomplete options from available backends.
        const OptionType = prompt.Option([]const u8);
        const opts = try allocator.alloc(OptionType, available_backends.len);
        defer allocator.free(opts);

        for (available_backends, 0..) |ab, i| {
            opts[i] = .{ .label = ab.label, .value = ab.value };
        }

        const choice = try prompt.autocomplete(
            []const u8,
            allocator,
            "Please select which backend to use:",
            opts,
        );

        if (choice == null) {
            try terminal.warn(stdout, "Cancelled. Must provide a backend to use.", is_tty);
            return;
        }

        backend = choice;
    }

    const selected_backend = backend orelse {
        try terminal.err(stdout, "Must provide a backend to use.", is_tty);
        return;
    };

    // ---------------------------------------------------------------
    // 2. Model
    // ---------------------------------------------------------------
    var model: ?[]const u8 = args.model;

    if (model == null) {
        const model_input = try prompt.text(
            allocator,
            "You can choose a model to use for your backend",
            "Leave blank to use default model set on backend",
            null,
        );

        if (model_input) |m| {
            if (m.len > 0) {
                model = m;
            } else {
                allocator.free(m);
            }
        }
        // null means cancelled — continue with no model (use default)
    }

    // ---------------------------------------------------------------
    // 3. Agent profile
    // ---------------------------------------------------------------
    var agent: []const u8 = args.agent orelse blk: {
        const agent_input = try prompt.text(
            allocator,
            "Agent profile/persona for the backend harness",
            "Leave blank to use default (build)",
            null,
        );

        if (agent_input) |a| {
            if (a.len > 0) {
                break :blk a;
            }
            allocator.free(a);
        }
        break :blk constants.DEFAULT_AGENT;
    };
    _ = &agent;

    // ---------------------------------------------------------------
    // 4. Max iterations
    // ---------------------------------------------------------------
    var max_iterations: u32 = args.max_iterations orelse blk: {
        const iter_input = try prompt.text(
            allocator,
            "Max number of loop iterations (0 = infinite)",
            "0",
            validateNumeric,
        );

        if (iter_input) |val| {
            defer allocator.free(val);
            if (val.len == 0) break :blk 0;
            break :blk std.fmt.parseInt(u32, val, 10) catch 0;
        }

        break :blk 0;
    };
    _ = &max_iterations;

    // ---------------------------------------------------------------
    // 5. Validator commands
    // ---------------------------------------------------------------
    var validator_list: std.ArrayList([]const u8) = .{};
    defer validator_list.deinit(allocator);

    const should_add_validators = try prompt.confirm(
        "Would you like to specify validation commands for the agent to run after making changes?",
        false,
    );

    if (should_add_validators != null and should_add_validators.?) {
        while (true) {
            const cmd_input = try prompt.text(
                allocator,
                "Enter a command for the agent to validate with (leave blank to finish)",
                prompt.getRandomValidatorPlaceholder(),
                null,
            );

            if (cmd_input) |cmd| {
                if (cmd.len == 0) {
                    allocator.free(cmd);
                    break;
                }
                try validator_list.append(allocator, cmd);
            } else {
                // Cancelled
                break;
            }
        }
    }

    // ---------------------------------------------------------------
    // 6. Skip permissions (Claude-only)
    // ---------------------------------------------------------------
    var skip_permissions: bool = true;

    if (std.mem.eql(u8, selected_backend, "claude")) {
        const skip_choice = try prompt.confirm(
            "Skip Claude Code permission checks? (bypasses safety system)",
            true,
        );

        if (skip_choice) |val| {
            skip_permissions = val;
        }
    }

    // ---------------------------------------------------------------
    // 7. Notification preference
    // ---------------------------------------------------------------
    var notify_setting: NotifySetting = .disabled;

    if (args.notify) |notify_str| {
        if (std.mem.eql(u8, notify_str, "false") or
            std.mem.eql(u8, notify_str, "off") or
            std.mem.eql(u8, notify_str, "none") or
            std.mem.eql(u8, notify_str, "disabled"))
        {
            notify_setting = .disabled;
        } else if (std.mem.eql(u8, notify_str, "all") or
            std.mem.eql(u8, notify_str, "true"))
        {
            notify_setting = .all;
        } else if (std.mem.eql(u8, notify_str, "individual")) {
            notify_setting = .individual;
        }
    } else {
        const NotifyOption = prompt.Option(NotifySetting);
        const notify_opts = [_]NotifyOption{
            .{ .label = "Disabled", .value = .disabled },
            .{ .label = "On completion (all)", .value = .all },
            .{ .label = "Per iteration (individual)", .value = .individual },
        };

        const notify_choice = try prompt.selectPrompt(
            NotifySetting,
            "When should OS notifications be sent?",
            &notify_opts,
        );

        if (notify_choice) |val| {
            notify_setting = val;
        }
    }

    // ---------------------------------------------------------------
    // 8. Assemble and validate config
    // ---------------------------------------------------------------
    const should_commit = args.should_commit orelse false;

    const cfg = OdyConfig{
        .backend = selected_backend,
        .max_iterations = max_iterations,
        .should_commit = should_commit,
        .validator_commands = validator_list.items,
        .model = model,
        .skip_permissions = skip_permissions,
        .agent = agent,
        .notify = notify_setting,
    };

    config_mod.validate(cfg) catch |e| {
        switch (e) {
            error.InvalidBackend => try terminal.err(stdout, "Invalid backend selected.", is_tty),
            error.EmptyAgent => try terminal.err(stdout, "Agent profile cannot be empty.", is_tty),
            error.EmptyTasksDir => try terminal.err(stdout, "Tasks directory cannot be empty.", is_tty),
        }
        return;
    };

    // ---------------------------------------------------------------
    // 9. Dry run — print config and exit
    // ---------------------------------------------------------------
    if (args.dry_run) {
        const json_cfg = config_mod.convertToJsonConfig(cfg);
        const json_bytes = try std.json.Stringify.valueAlloc(allocator, json_cfg, .{
            .whitespace = .indent_2,
        });
        defer allocator.free(json_bytes);

        try terminal.log(stdout, "Configuration (dry run):", is_tty);
        try stdout.writeAll(json_bytes);
        try stdout.writeAll("\n");
        try terminal.outro(stdout, "Dry run complete", is_tty);
        return;
    }

    // ---------------------------------------------------------------
    // 10. Write config to disk
    // ---------------------------------------------------------------
    try terminal.log(stdout, "Saving configuration...", is_tty);

    const config_path = constants.BASE_DIR ++ "/" ++ constants.ODY_FILE;
    try config_mod.writeConfig(allocator, cfg, config_path);

    try terminal.log(stdout, "Configuration saved.", is_tty);
    try terminal.outro(stdout, "Ody initialized", is_tty);
}

// -------------------------------------------------------------------------
// Validators
// -------------------------------------------------------------------------

/// Validate that input is either empty or a valid non-negative integer.
fn validateNumeric(input: []const u8) ?[]const u8 {
    if (input.len == 0) return null; // empty is fine (defaults to 0)
    _ = std.fmt.parseInt(u32, input, 10) catch {
        return "Please enter a valid number.";
    };
    return null;
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test "validateNumeric accepts empty string" {
    try std.testing.expect(validateNumeric("") == null);
}

test "validateNumeric accepts valid numbers" {
    try std.testing.expect(validateNumeric("0") == null);
    try std.testing.expect(validateNumeric("5") == null);
    try std.testing.expect(validateNumeric("100") == null);
}

test "validateNumeric rejects non-numeric input" {
    try std.testing.expect(validateNumeric("abc") != null);
    try std.testing.expect(validateNumeric("-1") != null);
    try std.testing.expect(validateNumeric("3.5") != null);
}

test "InitArgs defaults" {
    const args = InitArgs{};
    try std.testing.expect(args.backend == null);
    try std.testing.expect(args.max_iterations == null);
    try std.testing.expect(args.model == null);
    try std.testing.expect(args.should_commit == null);
    try std.testing.expect(args.agent == null);
    try std.testing.expect(args.notify == null);
    try std.testing.expect(!args.dry_run);
}
