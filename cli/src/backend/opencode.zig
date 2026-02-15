/// OpenCode backend.
///
/// Builds CLI argument arrays for the `opencode` command.
/// Ported from `packages/cli/src/backends/opencode.ts`.
const std = @import("std");
const constants = @import("../util/constants.zig");
const types = @import("../types.zig");

const CommandOptions = types.CommandOptions;

/// Build the piped-mode command for OpenCode.
///
/// Produces an argv like:
///   opencode [--agent <agent>] [-m <model>] run "@.ody/tasks <prompt>"
pub fn buildCommand(
    allocator: std.mem.Allocator,
    prompt: []const u8,
    opts: CommandOptions,
    _: anytype,
) ![]const []const u8 {
    var args: std.ArrayList([]const u8) = .{};
    errdefer args.deinit(allocator);

    try args.append(allocator, "opencode");

    if (opts.agent) |agent| {
        try args.append(allocator, "--agent");
        try args.append(allocator, agent);
    }

    if (opts.model) |model| {
        try args.append(allocator, "-m");
        try args.append(allocator, model);
    }

    try args.append(allocator, "run");

    // Build the prompt with the tasks directory prefix.
    const tasks_path = constants.BASE_DIR ++ "/" ++ constants.TASKS_DIR;
    const full_prompt = try std.fmt.allocPrint(allocator, "@{s} {s}", .{ tasks_path, prompt });
    try args.append(allocator, full_prompt);

    return args.toOwnedSlice(allocator);
}

/// Build the interactive (once) mode command for OpenCode.
///
/// Same as piped mode for OpenCode.
pub fn buildOnceCommand(
    allocator: std.mem.Allocator,
    prompt: []const u8,
    opts: CommandOptions,
    extra: anytype,
) ![]const []const u8 {
    return buildCommand(allocator, prompt, opts, extra);
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test "buildCommand with agent and model" {
    const allocator = std.testing.allocator;
    const args = try buildCommand(allocator, "implement feature", .{
        .agent = "build",
        .model = "anthropic/claude-opus-4-6",
    }, {});
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("opencode", args[0]);
    try std.testing.expectEqualStrings("--agent", args[1]);
    try std.testing.expectEqualStrings("build", args[2]);
    try std.testing.expectEqualStrings("-m", args[3]);
    try std.testing.expectEqualStrings("anthropic/claude-opus-4-6", args[4]);
    try std.testing.expectEqualStrings("run", args[5]);
    try std.testing.expect(std.mem.endsWith(u8, args[6], "implement feature"));
}

test "buildCommand without agent and model" {
    const allocator = std.testing.allocator;
    const args = try buildCommand(allocator, "simple task", .{}, {});
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("opencode", args[0]);
    try std.testing.expectEqualStrings("run", args[1]);
    try std.testing.expect(std.mem.endsWith(u8, args[2], "simple task"));
}

test "buildCommand with only agent" {
    const allocator = std.testing.allocator;
    const args = try buildCommand(allocator, "task", .{
        .agent = "deploy",
    }, {});
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("opencode", args[0]);
    try std.testing.expectEqualStrings("--agent", args[1]);
    try std.testing.expectEqualStrings("deploy", args[2]);
    try std.testing.expectEqualStrings("run", args[3]);
}
