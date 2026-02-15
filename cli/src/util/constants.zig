/// Application-wide constants for the Ody CLI.
///
/// Ported from `packages/cli/src/util/constants.ts`.
/// Note: `PRD_FILE` was identified as dead code and intentionally dropped.
/// Base directory for Ody configuration and data.
pub const BASE_DIR = ".ody";

/// Configuration file name within BASE_DIR.
pub const ODY_FILE = "ody.json";

/// Default subdirectory within BASE_DIR for task files.
pub const TASKS_DIR = "tasks";

/// Supported backend identifiers.
pub const ALLOWED_BACKENDS = [_][]const u8{ "opencode", "claude", "codex" };

/// The completion marker that signals a backend has finished its work.
pub const COMPLETION_MARKER = "<woof>COMPLETE</woof>";

/// Default agent profile name.
pub const DEFAULT_AGENT = "build";

/// File extension for code task files.
pub const TASK_FILE_EXT = ".code-task.md";

/// History subdirectory within BASE_DIR for archived tasks.
pub const HISTORY_DIR = "history";

/// Check whether a given string is a valid backend name.
pub fn isAllowedBackend(name: []const u8) bool {
    for (ALLOWED_BACKENDS) |backend| {
        if (std.mem.eql(u8, name, backend)) return true;
    }
    return false;
}

const std = @import("std");

test "isAllowedBackend accepts valid backends" {
    try std.testing.expect(isAllowedBackend("opencode"));
    try std.testing.expect(isAllowedBackend("claude"));
    try std.testing.expect(isAllowedBackend("codex"));
}

test "isAllowedBackend rejects invalid backends" {
    try std.testing.expect(!isAllowedBackend("foo"));
    try std.testing.expect(!isAllowedBackend(""));
    try std.testing.expect(!isAllowedBackend("Claude")); // case-sensitive
}
