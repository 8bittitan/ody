---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Interactive Prompts

## Description
Implement interactive stdin prompt utilities in `src/util/prompt.zig` for text input, confirmation dialogs, selection menus, and autocomplete filtering. These replace the `@clack/prompts` interactive functions used in the TypeScript implementation.

## Background
The TypeScript implementation uses `@clack/prompts` for interactive CLI prompts (text, confirm, select). The Zig rewrite needs equivalent functionality built on top of raw terminal mode using `std.posix.tcgetattr`/`tcsetattr`. These prompts are used primarily by `ody init` (backend selection, model input, validator commands) and `ody plan edit` (task selection). The module also includes the `getRandomValidatorPlaceholder()` utility from Phase 5.4.

## Technical Requirements
1. `text(message, placeholder, validate) !?[]const u8` - Text input with optional placeholder and validation callback; returns `null` on Ctrl+C cancel
2. `confirm(message, default) !?bool` - Yes/no prompt with default value; returns `null` on cancel
3. `select(T, message, options: []Option(T)) !?T` - Arrow-key selection from a list with label/value pairs; returns `null` on cancel
4. `autocomplete(T, message, options: []Option(T)) !?T` - Filterable selection that narrows options as user types; returns `null` on cancel
5. All prompts must switch terminal to raw mode (disable canonical mode, disable echo) and restore on exit/cancel
6. Use `std.posix.tcgetattr`/`std.posix.tcsetattr` for terminal mode switching
7. Handle edge cases: empty input, escape key, terminal resize
8. Include `getRandomValidatorPlaceholder()` using `std.crypto.random` to select from the hardcoded placeholder list
9. Define `Option(T)` generic struct with `label: []const u8` and `value: T` fields

## Dependencies
- Terminal helpers module (`src/util/terminal.zig`) for colors, cursor control, clearing
- Zig standard library (`std.posix`, `std.io`, `std.crypto.random`)

## Implementation Approach
1. Create a helper function `enableRawMode()` that saves current terminal attrs and sets raw mode, and `restoreMode()` that restores the saved attrs
2. Implement `text()`:
   - Print the message and placeholder (dimmed)
   - Read character-by-character in raw mode
   - Handle backspace, enter, Ctrl+C
   - Run validation callback on enter, show error if invalid
   - Return the collected string or null on cancel
3. Implement `confirm()`:
   - Print message with `(Y/n)` or `(y/N)` based on default
   - Accept `y`, `n`, or Enter (for default)
   - Return bool or null on cancel
4. Implement `select()`:
   - Print options list with a highlight marker on the current selection
   - Handle up/down arrow keys to move selection
   - Handle Enter to confirm, Ctrl+C to cancel
   - Redraw the list on each keystroke using cursor movement
5. Implement `autocomplete()`:
   - Combine text input with filtered select list
   - As user types, filter options by substring match
   - Arrow keys navigate filtered results, Enter confirms
6. Implement `getRandomValidatorPlaceholder()` selecting from the hardcoded list
7. Ensure cleanup: always restore terminal mode in a `defer` block

## Acceptance Criteria

1. **Text Input Works**
   - Given a text prompt is displayed
   - When the user types text and presses Enter
   - Then the entered text is returned

2. **Cancel Returns Null**
   - Given any active prompt
   - When the user presses Ctrl+C
   - Then `null` is returned and terminal mode is restored

3. **Select Navigation**
   - Given a select prompt with multiple options
   - When the user presses up/down arrow keys
   - Then the highlight moves between options

4. **Autocomplete Filters**
   - Given an autocomplete prompt with options ["claude", "codex", "opencode"]
   - When the user types "cl"
   - Then only "claude" is shown in the filtered list

5. **Terminal Mode Restored**
   - Given a prompt was active
   - When the prompt completes (by any means: confirm, cancel, error)
   - Then the terminal is back in its original mode

## Metadata
- **Complexity**: High
- **Labels**: zig-rewrite, phase-1, infrastructure, tui
