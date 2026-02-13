---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Stream Processing Utility

## Description
Implement the stream processing utility in `src/util/stream.zig` for draining child process stdout/stderr pipes with optional real-time printing, chunk accumulation, and callback-based stopping. This replaces the `Stream.toOutput()` method from the TypeScript implementation.

## Background
The TypeScript implementation uses a `Stream` class to read output from spawned child processes, accumulate text, optionally print chunks to the terminal, and detect completion markers like `<woof>COMPLETE</woof>`. In Zig, this is implemented as a function that reads from a `std.process.Child`'s pipe using `reader.read()` and accumulates into an `ArrayList(u8)`.

## Technical Requirements
1. Define `StreamOptions` struct:
   - `should_print: bool = false` - Whether to print chunks to stdout as they arrive
   - `on_chunk: ?*const fn (accumulated: []const u8) bool = null` - Callback invoked on each chunk; returns `true` to signal stop
2. Implement `drainStream(allocator, reader, options) ![]const u8`:
   - Read in chunks using `reader.read()` with a fixed-size buffer
   - Accumulate all read bytes into a growable `ArrayList(u8)`
   - If `should_print` is true, write non-empty chunks to stdout
   - If `on_chunk` callback is set, call it with the accumulated buffer; break if it returns `true`
   - Return the complete accumulated output as `[]const u8`
3. Handle EOF (reader returns 0 bytes) as the natural termination
4. The function should work with any reader type (use `anytype` for generic reader parameter)
5. Buffer size should be reasonable (e.g., 4096 bytes)

## Dependencies
- Zig standard library (`std.ArrayList`, `std.io`, `std.process`)
- Terminal helpers (`src/util/terminal.zig`) for stdout writing (optional)

## Implementation Approach
1. Create the `StreamOptions` struct with default values
2. Implement `drainStream()`:
   - Create an `ArrayList(u8)` for accumulation
   - Create a fixed-size read buffer `[4096]u8`
   - Loop: call `reader.read(&buf)`
   - If bytes_read is 0, break (EOF)
   - Append the chunk to the ArrayList
   - If `should_print`, write the chunk to `std.io.getStdOut()`
   - If `on_chunk` is set, call it with `list.items`; break if returns true
   - Return `list.toOwnedSlice()`
3. Consider adding a convenience function `containsCompletionMarker(text: []const u8) bool` that checks for `<woof>COMPLETE</woof>`

## Acceptance Criteria

1. **Full Stream Accumulation**
   - Given a reader that produces "hello " then "world"
   - When draining the stream with default options
   - Then the returned string is "hello world"

2. **Callback Stopping**
   - Given a callback that returns `true` when accumulated text contains "STOP"
   - When draining a stream that eventually produces "STOP"
   - Then reading stops after the chunk containing "STOP"

3. **Print to Stdout**
   - Given `should_print = true`
   - When draining a stream
   - Then each chunk is printed to stdout in real-time

4. **EOF Handling**
   - Given a reader that reaches EOF
   - When draining the stream
   - Then the function returns without error with all accumulated text

5. **Completion Marker Detection**
   - Given text containing `<woof>COMPLETE</woof>`
   - When checking with `containsCompletionMarker()`
   - Then `true` is returned

## Metadata
- **Complexity**: Low
- **Labels**: zig-rewrite, phase-5, utility
