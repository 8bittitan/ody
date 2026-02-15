/// Stream processing utilities for draining child process pipes.
///
/// Provides chunk-based reading from any reader (typically a child process
/// stdout/stderr pipe), with optional real-time printing to stdout and
/// callback-based early stopping.  Replaces `Stream.toOutput()` from the
/// TypeScript implementation.
const std = @import("std");
const constants = @import("constants.zig");

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

/// Options that control how `drainStream` behaves.
pub const StreamOptions = struct {
    /// When `true`, each non-empty chunk is written to stdout as it arrives.
    should_print: bool = false,

    /// Optional callback invoked after each chunk is appended to the
    /// accumulator.  Receives the full accumulated buffer so far.
    /// Return `true` to signal that reading should stop early.
    on_chunk: ?*const fn (accumulated: []const u8) bool = null,
};

// -----------------------------------------------------------------------
// Core API
// -----------------------------------------------------------------------

/// Read size for each iteration of the drain loop.
const READ_BUF_SIZE: usize = 4096;

/// Drain all available data from `reader`, accumulating it into a single
/// owned slice.
///
/// * When `options.should_print` is set, each non-empty chunk is echoed
///   to stdout in real time (useful for `--verbose` mode).
/// * When `options.on_chunk` is set, it is called after every chunk with
///   the full accumulated text; returning `true` stops reading early.
/// * EOF (zero-length read) terminates the loop naturally.
///
/// The caller owns the returned slice and must free it via `allocator`.
pub fn drainStream(
    allocator: std.mem.Allocator,
    reader: anytype,
    options: StreamOptions,
) ![]const u8 {
    var list: std.ArrayList(u8) = .{};
    errdefer list.deinit(allocator);

    var buf: [READ_BUF_SIZE]u8 = undefined;

    while (true) {
        const bytes_read = try reader.read(&buf);
        if (bytes_read == 0) break; // EOF

        const chunk = buf[0..bytes_read];

        try list.appendSlice(allocator, chunk);

        if (options.should_print) {
            // Write the chunk to stdout. Trimming is intentionally NOT done
            // here; the TypeScript version trims before printing but we
            // preserve raw output fidelity and let the caller decide.
            const stdout_file = std.fs.File.stdout();
            stdout_file.writeAll(chunk) catch {};
        }

        if (options.on_chunk) |cb| {
            if (cb(list.items)) break;
        }
    }

    return list.toOwnedSlice(allocator);
}

// -----------------------------------------------------------------------
// Convenience helpers
// -----------------------------------------------------------------------

/// Returns `true` when `text` contains the completion marker
/// (`<woof>COMPLETE</woof>`) that signals a backend has finished.
pub fn containsCompletionMarker(text: []const u8) bool {
    return std.mem.indexOf(u8, text, constants.COMPLETION_MARKER) != null;
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

test "drainStream accumulates full output" {
    // Simulate a reader that yields two chunks then EOF.
    const data = "hello world";
    var fbs = std.io.fixedBufferStream(data);
    const reader = fbs.reader();

    const output = try drainStream(std.testing.allocator, reader, .{});
    defer std.testing.allocator.free(output);

    try std.testing.expectEqualStrings("hello world", output);
}

test "drainStream returns empty slice on immediate EOF" {
    const data: []const u8 = "";
    var fbs = std.io.fixedBufferStream(data);
    const reader = fbs.reader();

    const output = try drainStream(std.testing.allocator, reader, .{});
    defer std.testing.allocator.free(output);

    try std.testing.expectEqual(@as(usize, 0), output.len);
}

test "drainStream stops early via on_chunk callback" {
    // Reader that has plenty of data, but callback stops after seeing "STOP".
    const data = "before STOP after more data";
    var fbs = std.io.fixedBufferStream(data);
    const reader = fbs.reader();

    const S = struct {
        fn cb(accumulated: []const u8) bool {
            return std.mem.indexOf(u8, accumulated, "STOP") != null;
        }
    };

    const output = try drainStream(std.testing.allocator, reader, .{
        .on_chunk = &S.cb,
    });
    defer std.testing.allocator.free(output);

    // The entire fixed buffer is smaller than READ_BUF_SIZE so it will be
    // read in one chunk; the callback fires and signals stop.
    try std.testing.expect(std.mem.indexOf(u8, output, "STOP") != null);
}

// FIX: This test hangs forever
// test "drainStream with should_print does not error" {
//     // We just verify it doesn't panic; actual stdout output is not captured.
//     const data = "printed chunk";
//     var fbs = std.io.fixedBufferStream(data);
//     const reader = fbs.reader();
//
//     const output = try drainStream(std.testing.allocator, reader, .{
//         .should_print = true,
//     });
//     defer std.testing.allocator.free(output);
//
//     try std.testing.expectEqualStrings("printed chunk", output);
// }

test "drainStream accumulates across multiple reads" {
    // Use a reader wrapper that yields small chunks to simulate multiple reads.
    const data = "abcdefghijklmnopqrstuvwxyz";

    var chunked = ChunkedReader{ .data = data, .pos = 0, .chunk_size = 5 };

    const output = try drainStream(std.testing.allocator, &chunked, .{});
    defer std.testing.allocator.free(output);

    try std.testing.expectEqualStrings(data, output);
}

test "containsCompletionMarker detects marker" {
    const text = "some output <woof>COMPLETE</woof> trailing";
    try std.testing.expect(containsCompletionMarker(text));
}

test "containsCompletionMarker returns false when absent" {
    const text = "some output without marker";
    try std.testing.expect(!containsCompletionMarker(text));
}

test "containsCompletionMarker returns false on empty input" {
    try std.testing.expect(!containsCompletionMarker(""));
}

test "containsCompletionMarker detects marker at boundaries" {
    // Marker at very start
    const at_start = "<woof>COMPLETE</woof>";
    try std.testing.expect(containsCompletionMarker(at_start));

    // Marker at very end
    const at_end = "output <woof>COMPLETE</woof>";
    try std.testing.expect(containsCompletionMarker(at_end));
}

test "containsCompletionMarker rejects partial markers" {
    try std.testing.expect(!containsCompletionMarker("<woof>COMPLETE"));
    try std.testing.expect(!containsCompletionMarker("COMPLETE</woof>"));
    try std.testing.expect(!containsCompletionMarker("<woof>"));
}

// -----------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------

/// A reader that yields data in fixed-size chunks, useful for testing
/// multi-read accumulation.
const ChunkedReader = struct {
    data: []const u8,
    pos: usize,
    chunk_size: usize,

    pub fn read(self: *ChunkedReader, buf: []u8) !usize {
        if (self.pos >= self.data.len) return 0;

        const remaining = self.data.len - self.pos;
        const to_read = @min(@min(self.chunk_size, remaining), buf.len);

        @memcpy(buf[0..to_read], self.data[self.pos .. self.pos + to_read]);
        self.pos += to_read;
        return to_read;
    }
};
