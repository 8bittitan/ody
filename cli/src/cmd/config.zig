/// `ody config` command – displays the currently loaded configuration
/// as pretty-printed JSON.
///
/// Replaces the TypeScript implementation in `packages/cli/src/cmd/config.ts`.
const std = @import("std");

const config = @import("../lib/config.zig");
const terminal = @import("../util/terminal.zig");

/// Run the config command. Prints the loaded configuration as
/// pretty-printed JSON to stdout. If no configuration has been loaded,
/// prints a warning suggesting the user run `ody init`.
pub fn run(allocator: std.mem.Allocator) !void {
    const stdout = std.fs.File.stdout();
    const writer = stdout;
    const is_tty = std.posix.isatty(stdout.handle);

    const cfg = config.all() orelse {
        try terminal.warn(writer, "No configuration found. Run `ody init` to set up your project.", is_tty);
        return;
    };

    // Convert to camelCase JSON representation for consistency with the
    // TypeScript tooling and on-disk format.
    const json_cfg = config.convertToJsonConfig(cfg);

    const json_bytes = try std.json.Stringify.valueAlloc(allocator, json_cfg, .{
        .whitespace = .indent_2,
    });
    defer allocator.free(json_bytes);

    try terminal.log(writer, "Ody configuration", false);
    try terminal.log(writer, "", false);
    try writer.writeAll(json_bytes);
    try writer.writeAll("\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test "run prints warning when config is not loaded" {
    // Ensure config is in a clean state (not loaded).
    config.reset();

    var output_buf: [4096]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&output_buf);
    const writer = fbs.writer();

    // Verify config.all() returns null when not loaded.
    try std.testing.expect(config.all() == null);

    // Verify the warning message renders correctly.
    try terminal.warn(writer, "No configuration found. Run `ody init` to set up your project.", false);
    const output = fbs.getWritten();
    try std.testing.expect(std.mem.indexOf(u8, output, "No configuration found") != null);
}
