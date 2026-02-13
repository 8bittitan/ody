---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: ANSI Terminal Helpers

## Description
Implement hand-rolled ANSI escape code utilities in `src/util/terminal.zig` for colored output, cursor control, spinner animations, and styled box/framing. This replaces the `@clack/prompts` library used in the TypeScript implementation with zero-dependency terminal rendering.

## Background
The TypeScript implementation relies on `@clack/prompts` for terminal UI (spinners, styled output, intro/outro messages). Since the Zig rewrite targets zero external dependencies for TUI, all terminal rendering must be implemented from scratch using raw ANSI escape codes. This module serves as the foundation for the interactive prompts module and all command output formatting.

## Technical Requirements
1. **Color functions**: `red()`, `green()`, `yellow()`, `cyan()`, `bold()`, `dim()`, `reset()` that write ANSI escape sequences to a `std.io.Writer`
2. **Cursor control**: `hideCursor()`, `showCursor()`, `clearLine()`, `moveCursorUp(n: u32)` writing to a writer
3. **Spinner struct**: Thread-based spinner with `start(message)` and `stop(finalMessage)` methods
4. Spinner should use braille characters: `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`
5. Spinner runs animation on a separate thread using `std.Thread`
6. **Box/framing**: `intro(title)` and `outro(message)` functions for styled headers/footers
7. All functions should accept a `std.io.Writer` (typically `std.io.getStdOut().writer()`) for testability
8. Properly handle terminal width detection for framing (or use a reasonable fixed width)

## Dependencies
- Zig standard library (`std.io`, `std.Thread`, `std.time`)
- No external dependencies

## Implementation Approach
1. Define color/style functions that return or write ANSI escape sequences (e.g., `\x1b[31m` for red)
2. Create a `Style` namespace or set of public functions that wrap text in escape codes
3. Implement cursor functions as simple escape code writes
4. Create a `Spinner` struct:
   - Store a `std.Thread` handle, running flag (atomic bool), and the writer
   - `start()` spawns a thread that cycles through braille characters at ~80ms intervals
   - `stop()` sets the running flag to false, joins the thread, clears the spinner line, prints the final message
   - Use `std.Thread.Mutex` or `std.atomic.Value(bool)` for thread synchronization
5. Implement `intro()` that prints a styled box top with the title, and `outro()` that prints a styled box bottom with the message
6. Ensure all escape codes are only emitted when stdout is a TTY (check with `std.posix.isatty`)

## Acceptance Criteria

1. **Color Output**
   - Given a string to colorize
   - When calling `terminal.red(writer, "error")`
   - Then the output contains the red ANSI escape code, the text, and a reset code

2. **Spinner Animates**
   - Given a spinner started with a message
   - When the spinner is running
   - Then braille characters cycle on the terminal at regular intervals

3. **Spinner Stops Cleanly**
   - Given a running spinner
   - When calling `spinner.stop("Done")`
   - Then the spinner line is cleared and "Done" is printed

4. **TTY Detection**
   - Given stdout is not a TTY (e.g., piped)
   - When color functions are called
   - Then no ANSI escape codes are emitted (plain text only)

5. **Intro/Outro Framing**
   - Given a title string
   - When calling `terminal.intro("Ody")`
   - Then a styled header is printed to the terminal

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-1, infrastructure, tui
