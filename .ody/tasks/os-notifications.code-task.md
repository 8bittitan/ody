---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: OS Notifications

## Description
Implement the OS notification utility in `src/lib/notify.zig` for sending desktop notifications on macOS and Linux when agent tasks complete. This replaces the Node.js-based notification in the TypeScript implementation.

## Background
The TypeScript implementation sends OS-level desktop notifications when agent tasks complete, configurable via the `notify` config setting (`disabled`, `all`, `individual`). macOS uses `osascript` to trigger notifications, and Linux uses `notify-send`. Errors are silently swallowed since notifications are best-effort. The Zig version uses comptime platform detection via `@import("builtin").os.tag` to select the correct notification command.

## Technical Requirements
1. Implement `sendNotification(title: []const u8, message: []const u8) void` in `src/lib/notify.zig`
2. macOS: spawn `osascript -e 'display notification "..." with title "..."'`
3. Linux: spawn `notify-send <title> <message>`
4. Use comptime platform detection: `@import("builtin").os.tag`
5. Use `std.process.Child` to spawn the notification command
6. Silently swallow all errors (best-effort delivery)
7. The function should be non-blocking (fire and forget)
8. Escape special characters in title and message to prevent command injection

## Dependencies
- Zig standard library (`std.process`, `std.posix`)
- Builtin module for OS detection

## Implementation Approach
1. Create the `sendNotification()` function
2. Use comptime `switch` on `@import("builtin").os.tag`:
   - `.macos` -> build osascript command
   - `.linux` -> build notify-send command
   - else -> no-op (unsupported platform)
3. Build the command arguments as a fixed-size array
4. Spawn the child process with all stdio set to `.close`
5. Don't wait for the process to complete (fire and forget)
6. Wrap the entire function body in a `_ = ... catch return` to swallow errors
7. Sanitize title and message strings to escape single quotes and special characters

## Acceptance Criteria

1. **macOS Notification**
   - Given running on macOS
   - When calling `sendNotification("Ody", "Task complete")`
   - Then an osascript process is spawned with the correct display notification command

2. **Linux Notification**
   - Given running on Linux
   - When calling `sendNotification("Ody", "Task complete")`
   - Then a notify-send process is spawned with the title and message

3. **Error Swallowed**
   - Given the notification command fails (e.g., osascript not found)
   - When calling `sendNotification()`
   - Then no error propagates to the caller

4. **Unsupported Platform**
   - Given running on an unsupported OS (e.g., Windows)
   - When calling `sendNotification()`
   - Then the function is a no-op

5. **Special Character Escaping**
   - Given a message containing single quotes like "It's done"
   - When calling `sendNotification()`
   - Then the message is properly escaped to prevent command injection

## Metadata
- **Complexity**: Low
- **Labels**: zig-rewrite, phase-5, utility, notifications
