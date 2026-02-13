---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Process Spawning Utilities

## Description
Implement process spawning utilities for both piped (loop) mode and interactive (PTY/once) mode in `src/util/stream.zig` or a dedicated spawn module. Piped mode is used by the default run loop, plan new, and plan edit commands. PTY mode is used by `ody run --once` for interactive backend sessions (can be deferred for initial rewrite).

## Background
The TypeScript implementation uses `Bun.spawn` for piped mode (stdin ignored, stdout/stderr piped) and Bun's PTY API for interactive once mode. In Zig, piped mode uses `std.process.Child` with configured stdio handles. PTY mode requires `std.posix.openpty` or C interop with `forkpty` to create a pseudo-terminal. The PTY approach is noted as deferrable for the initial rewrite.

## Technical Requirements
### Piped Mode (Required)
1. Implement `spawnPiped(allocator, argv: []const []const u8) !std.process.Child`
2. Configure: `stdin = .close`, `stdout = .pipe`, `stderr = .pipe` (or `.inherit` in verbose mode)
3. Return the `Child` handle for the caller to drain and wait
4. Caller is responsible for draining pipes using `drainStream()` from the stream module
5. Caller is responsible for calling `child.wait()` after draining

### PTY/Interactive Mode (Deferrable)
1. Implement `spawnInteractive(allocator, argv: []const []const u8) !PtyChild`
2. Use `std.posix.openpty` or C interop `forkpty` to create a pseudo-terminal
3. Spawn the child with the PTY as its controlling terminal
4. Read from the PTY master fd in a loop, write to real stdout, accumulate for completion detection
5. On `<woof>COMPLETE</woof>` detection, send SIGTERM to child via `std.posix.kill`
6. Alternative simpler approach: spawn with inherited stdio and tee output (less faithful but functional)

## Dependencies
- Stream processing module (`src/util/stream.zig`) for `drainStream()`
- Zig standard library (`std.process`, `std.posix`, `std.Thread`)

## Implementation Approach
### Piped Mode
1. Create a convenience function `spawnPiped()` that:
   - Initializes a `std.process.Child` with the provided argv
   - Sets stdin to `.close` (no input)
   - Sets stdout to `.pipe`
   - Sets stderr to `.pipe` (or `.inherit` based on a verbose flag parameter)
   - Calls `child.spawn()` and returns the handle
2. Create a higher-level `runPipedCommand(allocator, argv, stream_options) !CommandResult` that:
   - Calls `spawnPiped()`
   - Spawns two threads to drain stdout and stderr concurrently
   - Joins threads
   - Calls `child.wait()` for the exit code
   - Returns accumulated stdout, stderr, and exit code

### PTY Mode (if implemented)
1. Use `std.posix.openpty()` to get master/slave fd pair
2. Fork and exec the child process with the slave fd as controlling terminal
3. Read from master fd in a loop, tee to stdout, accumulate
4. Check for completion marker, send SIGTERM if found
5. Wait for child exit

## Acceptance Criteria

1. **Piped Process Spawns**
   - Given a valid command like `["echo", "hello"]`
   - When calling `spawnPiped(allocator, argv)`
   - Then a child process is spawned and stdout is piped

2. **Stdout Captured**
   - Given a spawned piped process
   - When draining stdout
   - Then the full output is captured as a string

3. **Stderr Captured**
   - Given a process that writes to stderr
   - When draining both pipes
   - Then stderr output is captured separately from stdout

4. **Exit Code Returned**
   - Given a process that exits with code 1
   - When waiting for the process
   - Then the exit code 1 is returned to the caller

5. **Concurrent Drain**
   - Given stdout and stderr both producing output
   - When draining concurrently via threads
   - Then no deadlock occurs and both streams are fully captured

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-7, utility, process
