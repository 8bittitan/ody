/// Claude Code backend.
///
/// Builds CLI argument arrays for the `claude` command.
/// Ported from `packages/cli/src/backends/claude.ts`.
const std = @import("std");
const constants = @import("../util/constants.zig");
const types = @import("../types.zig");

const CommandOptions = types.CommandOptions;

/// Build the piped-mode command for Claude Code.
///
/// Produces an argv like:
///   claude [--dangerously-skip-permissions] --verbose --output-format stream-json -p "@.ody/tasks <prompt>"
pub fn buildCommand(
    allocator: std.mem.Allocator,
    prompt: []const u8,
    _: CommandOptions,
    skip_permissions: bool,
) ![]const []const u8 {
    var args: std.ArrayList([]const u8) = .{};
    errdefer args.deinit(allocator);

    try args.append(allocator, "claude");

    if (skip_permissions) {
        try args.append(allocator, "--dangerously-skip-permissions");
    }

    try args.append(allocator, "--verbose");
    try args.append(allocator, "--output-format");
    try args.append(allocator, "stream-json");
    try args.append(allocator, "-p");

    // Build the prompt with the tasks directory prefix.
    const tasks_path = constants.BASE_DIR ++ "/" ++ constants.TASKS_DIR;
    const full_prompt = try std.fmt.allocPrint(allocator, "@{s} {s}", .{ tasks_path, prompt });
    try args.append(allocator, full_prompt);

    return args.toOwnedSlice(allocator);
}

/// Build the interactive (once) mode command for Claude Code.
///
/// Produces an argv like:
///   claude [--dangerously-skip-permissions] -p "@.ody/tasks <prompt>"
pub fn buildOnceCommand(
    allocator: std.mem.Allocator,
    prompt: []const u8,
    _: CommandOptions,
    skip_permissions: bool,
) ![]const []const u8 {
    var args: std.ArrayList([]const u8) = .{};
    errdefer args.deinit(allocator);

    try args.append(allocator, "claude");

    if (skip_permissions) {
        try args.append(allocator, "--dangerously-skip-permissions");
    }

    try args.append(allocator, "-p");

    const tasks_path = constants.BASE_DIR ++ "/" ++ constants.TASKS_DIR;
    const full_prompt = try std.fmt.allocPrint(allocator, "@{s} {s}", .{ tasks_path, prompt });
    try args.append(allocator, full_prompt);

    return args.toOwnedSlice(allocator);
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test "buildCommand with skip_permissions" {
    const allocator = std.testing.allocator;
    const args = try buildCommand(allocator, "do the thing", .{}, true);
    defer {
        // Free the allocated prompt string (last element).
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("claude", args[0]);
    try std.testing.expectEqualStrings("--dangerously-skip-permissions", args[1]);
    try std.testing.expectEqualStrings("--verbose", args[2]);
    try std.testing.expectEqualStrings("--output-format", args[3]);
    try std.testing.expectEqualStrings("stream-json", args[4]);
    try std.testing.expectEqualStrings("-p", args[5]);
    try std.testing.expect(std.mem.startsWith(u8, args[6], "@.ody/tasks"));
    try std.testing.expect(std.mem.endsWith(u8, args[6], "do the thing"));
}

test "buildCommand without skip_permissions" {
    const allocator = std.testing.allocator;
    const args = try buildCommand(allocator, "test prompt", .{}, false);
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("claude", args[0]);
    // Should NOT have --dangerously-skip-permissions
    try std.testing.expectEqualStrings("--verbose", args[1]);
}

test "buildOnceCommand includes -p flag" {
    const allocator = std.testing.allocator;
    const args = try buildOnceCommand(allocator, "once prompt", .{}, true);
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("claude", args[0]);
    try std.testing.expectEqualStrings("--dangerously-skip-permissions", args[1]);
    try std.testing.expectEqualStrings("-p", args[2]);
    try std.testing.expect(std.mem.endsWith(u8, args[3], "once prompt"));
}
