/// Codex backend.
///
/// Builds CLI argument arrays for the `codex` command.
/// Ported from `packages/cli/src/backends/codex.ts`.
const std = @import("std");
const constants = @import("../util/constants.zig");
const types = @import("../types.zig");

const CommandOptions = types.CommandOptions;

/// Build the piped-mode command for Codex.
///
/// Produces an argv like:
///   codex exec --full-auto [--skip-git-repo-check] "@.ody/tasks <prompt>"
pub fn buildCommand(
    allocator: std.mem.Allocator,
    prompt: []const u8,
    _: CommandOptions,
    should_commit: bool,
) ![]const []const u8 {
    var args: std.ArrayList([]const u8) = .{};
    errdefer args.deinit(allocator);

    try args.append(allocator, "codex");
    try args.append(allocator, "exec");
    try args.append(allocator, "--full-auto");

    if (!should_commit) {
        try args.append(allocator, "--skip-git-repo-check");
    }

    // Build the prompt with the tasks directory prefix.
    const tasks_path = constants.BASE_DIR ++ "/" ++ constants.TASKS_DIR;
    const full_prompt = try std.fmt.allocPrint(allocator, "@{s} {s}", .{ tasks_path, prompt });
    try args.append(allocator, full_prompt);

    return args.toOwnedSlice(allocator);
}

/// Build the interactive (once) mode command for Codex.
///
/// Same as piped mode for Codex (no separate interactive mode).
pub fn buildOnceCommand(
    allocator: std.mem.Allocator,
    prompt: []const u8,
    opts: CommandOptions,
    should_commit: bool,
) ![]const []const u8 {
    return buildCommand(allocator, prompt, opts, should_commit);
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test "buildCommand without shouldCommit adds skip-git-repo-check" {
    const allocator = std.testing.allocator;
    const args = try buildCommand(allocator, "fix bug", .{}, false);
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("codex", args[0]);
    try std.testing.expectEqualStrings("exec", args[1]);
    try std.testing.expectEqualStrings("--full-auto", args[2]);
    try std.testing.expectEqualStrings("--skip-git-repo-check", args[3]);
    try std.testing.expect(std.mem.endsWith(u8, args[4], "fix bug"));
}

test "buildCommand with shouldCommit omits skip-git-repo-check" {
    const allocator = std.testing.allocator;
    const args = try buildCommand(allocator, "add feature", .{}, true);
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("codex", args[0]);
    try std.testing.expectEqualStrings("exec", args[1]);
    try std.testing.expectEqualStrings("--full-auto", args[2]);
    // No --skip-git-repo-check
    try std.testing.expect(std.mem.endsWith(u8, args[3], "add feature"));
}
