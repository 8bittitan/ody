---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: Config Command Implementation

## Description
Implement the `ody config` command in `src/cmd/config.zig` that displays the currently loaded configuration as pretty-printed JSON. This is a simple read-only command for debugging and verifying configuration state.

## Background
The TypeScript `ody config` command loads the merged configuration and serializes it to pretty-printed JSON for display. If no configuration is loaded (e.g., `.ody/ody.json` doesn't exist), it shows a warning. This is a straightforward command used primarily for debugging.

## Technical Requirements
1. Implement the config command handler in `src/cmd/config.zig`
2. Call `config.all()` to retrieve the loaded configuration
3. Serialize the config to pretty-printed JSON using `std.json.stringify` with `.whitespace = .indent_2`
4. Print the JSON to stdout
5. If config is not loaded (returns null or error), print a warning message suggesting the user run `ody init`
6. The command takes no additional flags or arguments

## Dependencies
- Config module (`src/lib/config.zig`) for `all()`
- Terminal helpers (`src/util/terminal.zig`) for styled warning messages

## Implementation Approach
1. Define the config command handler: `pub fn run(allocator, config) !void`
2. Attempt to get the full config via `config.all()`
3. If config is available, serialize with `std.json.stringify` and print to stdout
4. If config is not available, print a styled warning: "No configuration found. Run `ody init` to set up your project."
5. Use `std.io.getStdOut().writer()` for output

## Acceptance Criteria

1. **Config Display**
   - Given a valid `.ody/ody.json` exists
   - When running `ody config`
   - Then the full configuration is printed as pretty-printed JSON

2. **No Config Warning**
   - Given no `.ody/ody.json` exists
   - When running `ody config`
   - Then a warning message is displayed suggesting `ody init`

3. **JSON Format**
   - Given the config is displayed
   - When examining the output
   - Then it is valid JSON with 2-space indentation

## Metadata
- **Complexity**: Low
- **Labels**: zig-rewrite, phase-6, command, config
