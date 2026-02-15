/// Backend harness interface.
///
/// Defines the `Backend` tagged union that dispatches `buildCommand` and
/// `buildOnceCommand` calls to the appropriate backend implementation.
/// Replaces the abstract `Harness` class from the TypeScript implementation.
///
/// Ported from:
///   - `packages/cli/src/backends/harness.ts` (abstract class)
///   - `packages/cli/src/backends/backend.ts` (factory/facade)
const std = @import("std");
const types = @import("../types.zig");
const constants = @import("../util/constants.zig");

pub const claude = @import("claude.zig");
pub const codex = @import("codex.zig");
pub const opencode = @import("opencode.zig");
pub const detect = @import("detect.zig");

const OdyConfig = types.OdyConfig;
const CommandOptions = types.CommandOptions;

/// The backend variants, each corresponding to a supported AI coding tool.
pub const BackendTag = enum {
    claude,
    codex,
    opencode,
};

/// Backend abstraction that dispatches to the correct backend implementation.
///
/// Use `fromConfig()` to create an instance from the loaded configuration.
/// Then call `buildCommand()` or `buildOnceCommand()` to get the argument
/// array for spawning the backend process.
pub const Backend = struct {
    tag: BackendTag,
    config: OdyConfig,

    /// Create a `Backend` from a loaded `OdyConfig`.
    /// Maps the config's `backend` string to the appropriate variant.
    /// Defaults to `.opencode` for unrecognized backend names.
    pub fn fromConfig(config: OdyConfig) Backend {
        const tag: BackendTag = if (std.mem.eql(u8, config.backend, "claude"))
            .claude
        else if (std.mem.eql(u8, config.backend, "codex"))
            .codex
        else
            .opencode;

        return .{ .tag = tag, .config = config };
    }

    /// Return the display name for this backend.
    pub fn name(self: Backend) []const u8 {
        return switch (self.tag) {
            .claude => "Claude Code",
            .codex => "Codex",
            .opencode => "OpenCode",
        };
    }

    /// Return the executable name for this backend.
    pub fn executableName(self: Backend) []const u8 {
        return switch (self.tag) {
            .claude => "claude",
            .codex => "codex",
            .opencode => "opencode",
        };
    }

    /// Build the piped-mode command argument array for the configured backend.
    /// The returned slice is owned by `allocator`.
    pub fn buildCommand(self: Backend, allocator: std.mem.Allocator, prompt: []const u8) ![]const []const u8 {
        const opts = CommandOptions{
            .model = self.config.model,
            .agent = self.config.agent,
        };

        return switch (self.tag) {
            .claude => claude.buildCommand(allocator, prompt, opts, self.config.skip_permissions),
            .codex => codex.buildCommand(allocator, prompt, opts, self.config.should_commit),
            .opencode => opencode.buildCommand(allocator, prompt, opts, {}),
        };
    }

    /// Build the interactive (once) mode command argument array.
    /// The returned slice is owned by `allocator`.
    pub fn buildOnceCommand(self: Backend, allocator: std.mem.Allocator, prompt: []const u8) ![]const []const u8 {
        const opts = CommandOptions{
            .model = self.config.model,
            .agent = self.config.agent,
        };

        return switch (self.tag) {
            .claude => claude.buildOnceCommand(allocator, prompt, opts, self.config.skip_permissions),
            .codex => codex.buildOnceCommand(allocator, prompt, opts, self.config.should_commit),
            .opencode => opencode.buildOnceCommand(allocator, prompt, opts, {}),
        };
    }
};

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test "fromConfig selects claude backend" {
    const cfg = OdyConfig{ .backend = "claude" };
    const backend = Backend.fromConfig(cfg);
    try std.testing.expectEqual(BackendTag.claude, backend.tag);
    try std.testing.expectEqualStrings("Claude Code", backend.name());
    try std.testing.expectEqualStrings("claude", backend.executableName());
}

test "fromConfig selects codex backend" {
    const cfg = OdyConfig{ .backend = "codex" };
    const backend = Backend.fromConfig(cfg);
    try std.testing.expectEqual(BackendTag.codex, backend.tag);
    try std.testing.expectEqualStrings("Codex", backend.name());
    try std.testing.expectEqualStrings("codex", backend.executableName());
}

test "fromConfig selects opencode backend" {
    const cfg = OdyConfig{ .backend = "opencode" };
    const backend = Backend.fromConfig(cfg);
    try std.testing.expectEqual(BackendTag.opencode, backend.tag);
    try std.testing.expectEqualStrings("OpenCode", backend.name());
    try std.testing.expectEqualStrings("opencode", backend.executableName());
}

test "fromConfig defaults to opencode for unknown backend" {
    const cfg = OdyConfig{ .backend = "unknown" };
    const backend = Backend.fromConfig(cfg);
    try std.testing.expectEqual(BackendTag.opencode, backend.tag);
}

test "buildCommand dispatches to claude" {
    const allocator = std.testing.allocator;
    const cfg = OdyConfig{ .backend = "claude", .skip_permissions = true };
    const backend = Backend.fromConfig(cfg);
    const args = try backend.buildCommand(allocator, "test prompt");
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("claude", args[0]);
    try std.testing.expectEqualStrings("--dangerously-skip-permissions", args[1]);
}

test "buildCommand dispatches to codex" {
    const allocator = std.testing.allocator;
    const cfg = OdyConfig{ .backend = "codex", .should_commit = false };
    const backend = Backend.fromConfig(cfg);
    const args = try backend.buildCommand(allocator, "test prompt");
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("codex", args[0]);
    try std.testing.expectEqualStrings("exec", args[1]);
    try std.testing.expectEqualStrings("--full-auto", args[2]);
    try std.testing.expectEqualStrings("--skip-git-repo-check", args[3]);
}

test "buildCommand dispatches to opencode with model and agent" {
    const allocator = std.testing.allocator;
    var cfg = OdyConfig{ .backend = "opencode" };
    cfg.model = "gpt-4";
    cfg.agent = "deploy";
    const backend = Backend.fromConfig(cfg);
    const args = try backend.buildCommand(allocator, "test prompt");
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("opencode", args[0]);
    try std.testing.expectEqualStrings("--agent", args[1]);
    try std.testing.expectEqualStrings("deploy", args[2]);
    try std.testing.expectEqualStrings("-m", args[3]);
    try std.testing.expectEqualStrings("gpt-4", args[4]);
    try std.testing.expectEqualStrings("run", args[5]);
}

test "buildOnceCommand dispatches to claude" {
    const allocator = std.testing.allocator;
    const cfg = OdyConfig{ .backend = "claude", .skip_permissions = false };
    const backend = Backend.fromConfig(cfg);
    const args = try backend.buildOnceCommand(allocator, "once prompt");
    defer {
        allocator.free(args[args.len - 1]);
        allocator.free(args);
    }

    try std.testing.expectEqualStrings("claude", args[0]);
    // No --dangerously-skip-permissions since skip_permissions is false
    try std.testing.expectEqualStrings("-p", args[1]);
}

// Pull in tests from sub-modules.
comptime {
    _ = claude;
    _ = codex;
    _ = opencode;
    _ = detect;
}
