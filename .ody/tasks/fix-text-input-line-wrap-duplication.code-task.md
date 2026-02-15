---
status: completed
created: +2026-02-15
started: 2026-02-14
completed: 2026-02-14
---
# Task: Fix Text Input Prompt Line-Wrap Duplication Bug

## Description
The interactive text input prompt in `cli/src/util/prompt.zig` duplicates all visible content whenever a key event fires and the input string has soft-wrapped to a new line because it exceeds the terminal width. Each keystroke leaves stale content on previous visual rows, producing an increasingly garbled display. The root cause is that `renderTextLine` only clears the single terminal row where the cursor currently sits, but when content wraps across multiple rows, the rows above are never cleared.

## Background
The `text()` function in `prompt.zig` provides an interactive single-line text input with raw-mode terminal handling. On every keystroke (character, backspace, enter with validation error), it calls `renderTextLine` to redraw the prompt. `renderTextLine` uses `terminal.clearLine` (which emits `\r\x1b[2K`) to erase the current row, then writes the `"│  "` prefix followed by the full input text. The ANSI escape `\x1b[2K` only clears the row the cursor is on. When the combined prefix + input exceeds the terminal's column width, the terminal soft-wraps the text onto additional visual rows. On the next redraw the cursor is on the last wrapped row, so only that row is cleared — all rows above retain their stale content, creating the duplication artifact. There is currently no terminal-width query function anywhere in the codebase and no logic to track or clear multiple visual rows.

## Technical Requirements
1. Add a `getTerminalWidth()` function to `cli/src/util/terminal.zig` that queries the terminal column count via POSIX `ioctl` with `TIOCGWINSZ` (with a sensible fallback, e.g. 80 columns, when the ioctl fails or stdout is not a TTY).
2. Update `renderTextLine` in `cli/src/util/prompt.zig` to calculate how many visual rows the previous render occupied and clear all of them before redrawing — moving the cursor up to the first row, clearing each row, then writing the new content from the top.
3. Apply the same multi-row clearing logic to the enter/confirmation path (both the successful submit and the validation-error redraw) so that wrapped content is fully cleaned up when the prompt completes or shows an error.
4. Ensure the fix handles edge cases: terminal resize mid-input, input exactly equal to terminal width (boundary), empty input with placeholder text, and non-TTY mode (no ANSI codes emitted).

## Dependencies
- `std.posix` / `std.c` for `ioctl` and `TIOCGWINSZ` — available in the Zig standard library, no external dependency needed.
- `cli/src/util/terminal.zig` — the new `getTerminalWidth` function will be added here alongside existing terminal helpers.
- `cli/src/util/prompt.zig` — the `renderTextLine` function and the `text()` key-event loop are the primary edit targets.

## Implementation Approach
1. **Add `getTerminalWidth` to `terminal.zig`**: Use `std.posix.system.ioctl` (or the appropriate Zig 0.15 equivalent) on `STDOUT_FILENO` with `TIOCGWINSZ` to read `ws_col`. Return a default of 80 if the call fails. Export as `pub fn getTerminalWidth() u16`.
2. **Compute visible prefix width**: The `groupLine` prefix (`"│  "`) contains ANSI escape sequences that are zero-width. Define a constant for the visible prefix width (3 columns for `│` + 2 spaces) so row calculations are accurate.
3. **Track previous visual row count in `text()`**: Introduce a `prev_rows: u16` variable in the `text()` function's event loop, initialized to 1. Before each call to `renderTextLine`, pass `prev_rows` so the function knows how many rows to clear. After rendering, compute and store the new row count: `ceil((prefix_visible_width + input.len) / terminal_width)`.
4. **Rewrite `renderTextLine` to clear multiple rows**: Accept the previous row count as a parameter. Move the cursor up `(prev_rows - 1)` rows (using `terminal.moveCursorUp`), then clear each row from top to bottom by emitting `\x1b[2K` and moving down (or clearing and using `\r\n`). After all stale rows are cleared, reposition to the start and write the prefix + input as before.
5. **Update the enter handler and validation-error handler**: Before writing the final confirmed value or the error message, clear all visual rows using the same tracked row count, so no stale wrapped text remains on screen.
6. **Handle edge cases**: When `is_tty` is false, skip all row-tracking and multi-row clearing (current behavior is already correct for non-TTY). On terminal resize, re-query `getTerminalWidth` on each render cycle (the ioctl is cheap) so the row calculation stays accurate.
7. **Add unit tests**: Add tests for `getTerminalWidth` (verify it returns a positive value or the fallback), and for a helper function that computes visual row count given a string length and terminal width, covering boundary cases (exact fit, one-over, empty input).

## Acceptance Criteria

1. **No duplication on long input**
   - Given the terminal is 80 columns wide and the text prompt is active
   - When the user types a string longer than 76 characters (80 minus the ~4-column prefix)
   - Then each keystroke redraws the prompt cleanly with no duplicated or stale text on any visible row

2. **Clean display on backspace after wrapping**
   - Given the input has wrapped to 2+ visual rows
   - When the user presses backspace to shorten the text below the wrap threshold
   - Then the display collapses back to a single row with no leftover content on the row below

3. **Clean exit on enter with wrapped input**
   - Given the input has wrapped to 2+ visual rows
   - When the user presses enter to submit
   - Then all wrapped rows are cleared and the confirmed value is displayed on a single line with no artifacts above or below

4. **Validation error clears wrapped input**
   - Given the input has wrapped and the validator rejects the value
   - When the error message is shown and the prompt re-renders
   - Then no stale wrapped rows remain from the previous input display

5. **Non-TTY mode unaffected**
   - Given stdout is not a TTY (e.g., piped to a file)
   - When the text prompt runs
   - Then no ANSI escape codes are emitted and behavior is unchanged from current

6. **Build and tests pass**
   - Given the changes are complete
   - When `zig build` and `zig build test` are run from `cli/`
   - Then both complete successfully with no errors or warnings

## Metadata
- **Complexity**: Medium
- **Labels**: bug, terminal, prompt, zig
