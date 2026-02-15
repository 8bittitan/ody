const std = @import("std");
const clap = @import("clap");
const build_options = @import("build_options");

// Public module re-exports so the build system can discover them.
pub const constants = @import("util/constants.zig");
pub const terminal = @import("util/terminal.zig");
pub const stream = @import("util/stream.zig");
pub const spawn = @import("util/spawn.zig");
pub const task_util = @import("util/task.zig");
pub const prompt = @import("util/prompt.zig");
pub const types = @import("types.zig");
pub const config = @import("lib/config.zig");
pub const notify = @import("lib/notify.zig");
pub const harness = @import("backend/harness.zig");
pub const builder = @import("builder/prompt.zig");
pub const config_cmd = @import("cmd/config.zig");
pub const init_cmd = @import("cmd/init.zig");
pub const run_cmd = @import("cmd/run.zig");
pub const plan_cmd = @import("cmd/plan.zig");
pub const task_list_cmd = @import("cmd/task/list.zig");
pub const task_compact_cmd = @import("cmd/task/compact.zig");
pub const task_edit_cmd = @import("cmd/task/edit.zig");

// -----------------------------------------------------------------------
// Subcommand enums
// -----------------------------------------------------------------------

const Command = enum {
    init,
    config,
    run,
    plan,
    task,
};

const TaskSubcommand = enum {
    list,
    compact,
    edit,
};

// -----------------------------------------------------------------------
// Top-level parameter spec
// -----------------------------------------------------------------------

const main_params = clap.parseParamsComptime(
    \\-h, --help     Display this help and exit.
    \\-v, --version  Output version information and exit.
    \\<command>
    \\
);

const main_parsers = .{
    .command = clap.parsers.enumeration(Command),
};

// -----------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------

pub fn main() !void {
    var gpa_state: std.heap.DebugAllocator(.{}) = .{};
    defer _ = gpa_state.deinit();
    const allocator = gpa_state.allocator();

    var iter = try std.process.ArgIterator.initWithAllocator(allocator);
    defer iter.deinit();

    // Skip the executable name.
    _ = iter.next();

    var diag: clap.Diagnostic = .{};
    var res = clap.parseEx(clap.Help, &main_params, main_parsers, &iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
        .terminating_positional = 0,
    }) catch |err| {
        diag.reportToFile(.stderr(), err) catch {};
        return;
    };
    defer res.deinit();

    const stdout_file = std.fs.File.stdout();
    var buf: [4096]u8 = undefined;
    var w = stdout_file.writer(&buf);

    // --help
    if (res.args.help != 0) {
        printUsage(&w.interface);
        try w.interface.flush();
        return;
    }

    // --version
    if (res.args.version != 0) {
        try w.interface.print("ody v{s}\n", .{build_options.version});
        try w.interface.flush();
        return;
    }

    const command = res.positionals[0] orelse {
        printUsage(&w.interface);
        try w.interface.flush();
        return;
    };

    // Load config for commands that need it (all except init).
    if (command != .init) {
        config.load(allocator) catch {};
    }
    defer config.deinit();

    switch (command) {
        .init => try runInit(allocator, &iter),
        .config => try config_cmd.run(allocator),
        .run => try runRun(allocator, &iter),
        .plan => try runPlan(allocator, &iter),
        .task => try runTask(allocator, &iter),
    }
}

// -----------------------------------------------------------------------
// `ody init` argument parsing
// -----------------------------------------------------------------------

const init_params = clap.parseParamsComptime(
    \\-h, --help                  Display this help and exit.
    \\-b, --backend <str>         Backend to use (opencode, claude, codex).
    \\-i, --iterations <usize>    Max loop iterations (0 = unlimited).
    \\-m, --model <str>           Model identifier for the backend.
    \\-c, --commit                Enable git commit behavior.
    \\-a, --agent <str>           Agent profile/persona.
    \\-n, --notify <str>          Notification setting (disabled, all, individual).
    \\    --dry-run               Print config without saving.
    \\
);

fn runInit(allocator: std.mem.Allocator, iter: *std.process.ArgIterator) !void {
    var diag: clap.Diagnostic = .{};
    var res = clap.parseEx(clap.Help, &init_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        diag.reportToFile(.stderr(), err) catch {};
        return;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        const f = std.fs.File.stdout();
        var buf_local: [4096]u8 = undefined;
        var wr = f.writer(&buf_local);
        try wr.interface.print("Usage: ody init [OPTIONS]\n\n", .{});
        try wr.interface.print("Initialize a new Ody project with an interactive wizard.\n\n", .{});
        try wr.interface.print("Options:\n", .{});
        try wr.interface.flush();
        try clap.helpToFile(f, clap.Help, &init_params, .{});
        return;
    }

    const max_iter: ?u32 = if (res.args.iterations) |n| @intCast(n) else null;

    try init_cmd.run(allocator, .{
        .backend = res.args.backend,
        .max_iterations = max_iter,
        .model = res.args.model,
        .should_commit = if (res.args.commit != 0) true else null,
        .agent = res.args.agent,
        .notify = res.args.notify,
        .dry_run = res.args.@"dry-run" != 0,
    });
}

// -----------------------------------------------------------------------
// `ody run` argument parsing
// -----------------------------------------------------------------------

const run_params = clap.parseParamsComptime(
    \\-h, --help               Display this help and exit.
    \\-l, --label <str>        Filter tasks by label.
    \\-i, --iterations <usize> Override max loop iterations (0 = unlimited).
    \\    --verbose             Print backend output in real-time.
    \\    --dry-run             Print command and prompt without executing.
    \\    --no-notify           Disable notifications.
    \\<str>
    \\
);

fn runRun(allocator: std.mem.Allocator, iter: *std.process.ArgIterator) !void {
    var diag: clap.Diagnostic = .{};
    var res = clap.parseEx(clap.Help, &run_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        diag.reportToFile(.stderr(), err) catch {};
        return;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        const f = std.fs.File.stdout();
        var buf_local: [4096]u8 = undefined;
        var wr = f.writer(&buf_local);
        try wr.interface.print("Usage: ody run [OPTIONS] [TASK_FILE]\n\n", .{});
        try wr.interface.print("Run the agent execution loop.\n\n", .{});
        try wr.interface.print("Options:\n", .{});
        try wr.interface.flush();
        try clap.helpToFile(f, clap.Help, &run_params, .{});
        return;
    }

    const max_iter: ?u32 = if (res.args.iterations) |n| @intCast(n) else null;

    try run_cmd.run(allocator, .{
        .task_file = res.positionals[0],
        .label = res.args.label,
        .iterations = max_iter,
        .verbose = res.args.verbose != 0,
        .dry_run = res.args.@"dry-run" != 0,
        .no_notify = res.args.@"no-notify" != 0,
    });
}

// -----------------------------------------------------------------------
// `ody plan` — leaf command (runs plan-new logic directly)
// -----------------------------------------------------------------------

const plan_params = clap.parseParamsComptime(
    \\-h, --help     Display this help and exit.
    \\    --dry-run  Print prompt without executing.
    \\    --verbose  Print backend output in real-time.
    \\
);

fn runPlan(allocator: std.mem.Allocator, iter: *std.process.ArgIterator) !void {
    var diag: clap.Diagnostic = .{};
    var res = clap.parseEx(clap.Help, &plan_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        diag.reportToFile(.stderr(), err) catch {};
        return;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        const f = std.fs.File.stdout();
        var buf_local: [4096]u8 = undefined;
        var wr = f.writer(&buf_local);
        try wr.interface.print("Usage: ody plan [OPTIONS]\n\n", .{});
        try wr.interface.print("Generate a new code-task plan.\n\n", .{});
        try wr.interface.print("Options:\n", .{});
        try wr.interface.flush();
        try clap.helpToFile(f, clap.Help, &plan_params, .{});
        return;
    }

    try plan_cmd.run(allocator, .{
        .dry_run = res.args.@"dry-run" != 0,
        .verbose = res.args.verbose != 0,
    });
}

// -----------------------------------------------------------------------
// `ody task` subcommand routing
// -----------------------------------------------------------------------

const task_params = clap.parseParamsComptime(
    \\-h, --help  Display this help and exit.
    \\<command>
    \\
);

const task_parsers = .{
    .command = clap.parsers.enumeration(TaskSubcommand),
};

fn runTask(allocator: std.mem.Allocator, iter: *std.process.ArgIterator) !void {
    var diag: clap.Diagnostic = .{};
    var res = clap.parseEx(clap.Help, &task_params, task_parsers, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
        .terminating_positional = 0,
    }) catch |err| {
        diag.reportToFile(.stderr(), err) catch {};
        return;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        printTaskUsage();
        return;
    }

    const sub = res.positionals[0] orelse {
        printTaskUsage();
        return;
    };

    switch (sub) {
        .list => try runTaskList(allocator, iter),
        .compact => try task_compact_cmd.run(allocator),
        .edit => try runTaskEdit(allocator, iter),
    }
}

// -----------------------------------------------------------------------
// `ody task list` argument parsing
// -----------------------------------------------------------------------

const task_list_params = clap.parseParamsComptime(
    \\-h, --help          Display this help and exit.
    \\-s, --status <str>  Filter tasks by status (default: pending).
    \\
);

fn runTaskList(allocator: std.mem.Allocator, iter: *std.process.ArgIterator) !void {
    var diag: clap.Diagnostic = .{};
    var res = clap.parseEx(clap.Help, &task_list_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        diag.reportToFile(.stderr(), err) catch {};
        return;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        const f = std.fs.File.stdout();
        var buf_local: [4096]u8 = undefined;
        var wr = f.writer(&buf_local);
        try wr.interface.print("Usage: ody task list [OPTIONS]\n\n", .{});
        try wr.interface.print("List task files filtered by status.\n\n", .{});
        try wr.interface.print("Options:\n", .{});
        try wr.interface.flush();
        try clap.helpToFile(f, clap.Help, &task_list_params, .{});
        return;
    }

    try task_list_cmd.run(allocator, .{
        .status = res.args.status orelse "pending",
    });
}

// -----------------------------------------------------------------------
// `ody task edit` argument parsing
// -----------------------------------------------------------------------

const task_edit_params = clap.parseParamsComptime(
    \\-h, --help     Display this help and exit.
    \\    --dry-run  Print prompt without executing.
    \\    --verbose  Print backend output in real-time.
    \\
);

fn runTaskEdit(allocator: std.mem.Allocator, iter: *std.process.ArgIterator) !void {
    var diag: clap.Diagnostic = .{};
    var res = clap.parseEx(clap.Help, &task_edit_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        diag.reportToFile(.stderr(), err) catch {};
        return;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        const f = std.fs.File.stdout();
        var buf_local: [4096]u8 = undefined;
        var wr = f.writer(&buf_local);
        try wr.interface.print("Usage: ody task edit [OPTIONS]\n\n", .{});
        try wr.interface.print("Select and revise an existing pending task.\n\n", .{});
        try wr.interface.print("Options:\n", .{});
        try wr.interface.flush();
        try clap.helpToFile(f, clap.Help, &task_edit_params, .{});
        return;
    }

    try task_edit_cmd.run(allocator, .{
        .dry_run = res.args.@"dry-run" != 0,
        .verbose = res.args.verbose != 0,
    });
}

// -----------------------------------------------------------------------
// Help text
// -----------------------------------------------------------------------

fn printUsage(writer: *std.Io.Writer) void {
    writer.print("ody v{s} — AI agent orchestration CLI\n\n", .{build_options.version}) catch {};
    writer.print(
        \\Usage: ody [OPTIONS] <COMMAND>
        \\
        \\Commands:
        \\  init      Initialize a new Ody project
        \\  config    Display the current configuration
        \\  run       Run the agent execution loop
        \\  plan      Create a new task plan interactively
        \\  task      Manage tasks (list, edit, compact)
        \\
        \\Options:
        \\  -h, --help     Display this help and exit
        \\  -v, --version  Output version information and exit
        \\
        \\Run 'ody <COMMAND> --help' for more information on a command.
        \\
    , .{}) catch {};
}

fn printTaskUsage() void {
    const f = std.fs.File.stdout();
    var buf_local: [4096]u8 = undefined;
    var wr = f.writer(&buf_local);
    wr.interface.print(
        \\Usage: ody task <SUBCOMMAND>
        \\
        \\Manage tasks.
        \\
        \\Subcommands:
        \\  list     List tasks filtered by status
        \\  edit     Select and revise a pending task
        \\  compact  Archive completed tasks
        \\
        \\Run 'ody task <SUBCOMMAND> --help' for more information.
        \\
    , .{}) catch {};
    wr.interface.flush() catch {};
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "version string is non-empty" {
    const build_opts = @import("build_options");
    try std.testing.expect(build_opts.version.len > 0);
}

// Pull in tests from all sub-modules.
comptime {
    _ = constants;
    _ = terminal;
    _ = stream;
    _ = spawn;
    _ = task_util;
    _ = prompt;
    _ = types;
    _ = config;
    _ = notify;
    _ = harness;
    _ = builder;
    _ = config_cmd;
    _ = init_cmd;
    _ = run_cmd;
    _ = plan_cmd;
    _ = task_list_cmd;
    _ = task_compact_cmd;
    _ = task_edit_cmd;
}
