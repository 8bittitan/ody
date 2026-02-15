/// Shared type definitions used across multiple modules in the Ody CLI.
///
/// Ported from:
///   - `packages/cli/src/types/task.ts` (CompletedTask)
///   - `packages/cli/src/backends/harness.ts` (CommandOptions)
///   - `packages/cli/src/lib/config.ts` (OdyConfig, NotifySetting)
const std = @import("std");
const constants = @import("util/constants.zig");

// ---------------------------------------------------------------------------
// Notification setting
// ---------------------------------------------------------------------------

/// Controls when desktop notifications are sent after agent runs.
pub const NotifySetting = enum {
    disabled,
    all,
    individual,
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Parsed and validated Ody project configuration.
/// Mirrors the Zod schema defined in the TypeScript `configSchema`.
pub const OdyConfig = struct {
    /// Which AI backend to use (must be one of ALLOWED_BACKENDS).
    backend: []const u8,

    /// Maximum number of loop iterations for `ody run`.
    max_iterations: u32 = 5,

    /// Whether the agent should create git commits.
    should_commit: bool = false,

    /// Shell commands run after each agent iteration to validate work.
    validator_commands: []const []const u8 = &.{},

    /// Model identifier passed to the backend (optional).
    model: ?[]const u8 = null,

    /// Whether to skip interactive permission prompts in the backend.
    skip_permissions: bool = true,

    /// Agent profile name (e.g. "build").
    agent: []const u8 = constants.DEFAULT_AGENT,

    /// Subdirectory within BASE_DIR that holds task files.
    tasks_dir: []const u8 = constants.TASKS_DIR,

    /// Desktop notification behaviour.
    notify: NotifySetting = .disabled,
};

// ---------------------------------------------------------------------------
// Command options
// ---------------------------------------------------------------------------

/// Options forwarded to backend `buildCommand` / `buildOnceCommand`.
pub const CommandOptions = struct {
    /// Model identifier override.
    model: ?[]const u8 = null,

    /// Agent profile override.
    agent: ?[]const u8 = null,
};

// ---------------------------------------------------------------------------
// Task types
// ---------------------------------------------------------------------------

/// Represents a completed task extracted during `task compact`.
pub const CompletedTask = struct {
    /// Original file name (e.g. "my-feature.code-task.md").
    filename: []const u8,

    /// Task title parsed from the `# Task: ...` heading.
    title: []const u8,

    /// Short description extracted from the `## Description` section.
    description: []const u8,

    /// ISO date string (YYYY-MM-DD) when the task was completed.
    completed: []const u8,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "OdyConfig defaults are sensible" {
    const cfg = OdyConfig{ .backend = "claude" };
    try std.testing.expectEqual(@as(u32, 5), cfg.max_iterations);
    try std.testing.expect(!cfg.should_commit);
    try std.testing.expect(cfg.skip_permissions);
    try std.testing.expectEqualStrings(constants.DEFAULT_AGENT, cfg.agent);
    try std.testing.expectEqualStrings(constants.TASKS_DIR, cfg.tasks_dir);
    try std.testing.expectEqual(NotifySetting.disabled, cfg.notify);
    try std.testing.expect(cfg.model == null);
}

test "CommandOptions defaults are null" {
    const opts = CommandOptions{};
    try std.testing.expect(opts.model == null);
    try std.testing.expect(opts.agent == null);
}

test "CompletedTask can be constructed" {
    const task = CompletedTask{
        .filename = "my-task.code-task.md",
        .title = "My Task",
        .description = "Does a thing.",
        .completed = "2026-02-13",
    };
    try std.testing.expectEqualStrings("my-task.code-task.md", task.filename);
}
