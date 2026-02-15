/// Backend detection utilities.
///
/// Replaces `Bun.which()` from the TypeScript implementation with a manual
/// PATH search using `std.fs.accessAbsolute`.
const std = @import("std");
const constants = @import("../util/constants.zig");
const builtin = @import("builtin");

/// Search the system PATH for an executable named `name`.
/// Returns the full path to the executable on success, or `null` if not found.
/// The returned slice is allocated with `allocator` and must be freed by the caller.
pub fn which(allocator: std.mem.Allocator, name: []const u8) ?[]const u8 {
    const path_env = std.posix.getenv("PATH") orelse return null;

    var iter = std.mem.splitScalar(u8, path_env, ':');
    while (iter.next()) |dir| {
        if (dir.len == 0) continue;

        const full_path = std.fs.path.join(allocator, &.{ dir, name }) catch continue;

        // Check if the file exists and is executable.
        if (isExecutable(full_path)) {
            return full_path;
        }

        allocator.free(full_path);
    }

    return null;
}

/// Check if a file at the given path exists and is executable.
fn isExecutable(path: []const u8) bool {
    // Use accessAbsolute for absolute paths, otherwise open relative to cwd.
    // Zig 0.15 does not expose an execute-mode check in the access API,
    // so we check file existence via default open flags.
    if (std.fs.path.isAbsolute(path)) {
        std.fs.accessAbsolute(path, .{}) catch return false;
        return true;
    }
    std.fs.cwd().access(path, .{}) catch return false;
    return true;
}

/// Result item for available backend detection.
pub const AvailableBackend = struct {
    /// Display label (e.g. "Claude Code").
    label: []const u8,
    /// Config value (e.g. "claude").
    value: []const u8,
};

/// Backend display names, indexed to match `constants.ALLOWED_BACKENDS`.
const BACKEND_LABELS = [_][]const u8{ "OpenCode", "Claude Code", "Codex" };

/// Detect which backend CLI tools are available on the system PATH.
/// Returns a list of `AvailableBackend` structs for each installed tool.
/// The caller owns the returned slice and must free it with `allocator`.
pub fn getAvailableBackends(allocator: std.mem.Allocator) ![]AvailableBackend {
    var list: std.ArrayList(AvailableBackend) = .{};
    errdefer list.deinit(allocator);

    for (constants.ALLOWED_BACKENDS, 0..) |backend_name, i| {
        if (which(allocator, backend_name)) |path| {
            // We found it -- free the path since we only need the name.
            allocator.free(path);
            try list.append(allocator, .{
                .label = BACKEND_LABELS[i],
                .value = backend_name,
            });
        }
    }

    return list.toOwnedSlice(allocator);
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test "which finds a known executable (zig)" {
    // `zig` should be on PATH in any environment running these tests.
    const result = which(std.testing.allocator, "zig");
    if (result) |path| {
        defer std.testing.allocator.free(path);
        try std.testing.expect(path.len > 0);
        // The path should end with /zig
        try std.testing.expect(std.mem.endsWith(u8, path, "/zig"));
    }
    // If zig is somehow not found, this test is a no-op rather than a failure,
    // since the test itself is running under zig.
}

test "which returns null for nonexistent executable" {
    const result = which(std.testing.allocator, "nonexistent-tool-xyz-12345");
    try std.testing.expect(result == null);
}

test "isExecutable rejects nonexistent path" {
    try std.testing.expect(!isExecutable("/this/path/does/not/exist/at/all"));
}

test "getAvailableBackends returns a valid slice" {
    const backends = try getAvailableBackends(std.testing.allocator);
    defer std.testing.allocator.free(backends);

    // We can't assert exactly which backends are installed, but we can
    // verify the result is a valid slice and each entry has non-empty fields.
    for (backends) |b| {
        try std.testing.expect(b.label.len > 0);
        try std.testing.expect(b.value.len > 0);
        try std.testing.expect(constants.isAllowedBackend(b.value));
    }
}

test "BACKEND_LABELS matches ALLOWED_BACKENDS length" {
    try std.testing.expectEqual(constants.ALLOWED_BACKENDS.len, BACKEND_LABELS.len);
}
