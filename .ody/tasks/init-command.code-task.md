---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Init Command Implementation

## Description
Implement the `ody init` interactive wizard command in `src/cmd/init.zig`. This command guides the user through setting up an Ody project by creating the `.ody/` directory, detecting available backends, and prompting for all configuration values through an interactive TUI flow.

## Background
The TypeScript `ody init` command uses `@clack/prompts` to walk users through backend selection, model configuration, agent profile selection, validator command entry, and notification preferences. The Zig version uses the custom interactive prompts from `src/util/prompt.zig` and backend detection from `src/backend/detect.zig`. It supports both interactive mode and flag-based configuration via CLI arguments, plus a `--dry-run` mode that prints the config without writing.

## Technical Requirements
1. Create `.ody/` directory if it doesn't exist using `std.fs.cwd().makePath()`
2. Detect available backends via `Backend.getAvailableBackends()` / `detect.which()`
3. Prompt for backend using autocomplete from available backends
4. Prompt for model (text input, optional -- skip if empty)
5. Prompt for agent profile (text input, default "build")
6. Prompt for max iterations (text input with numeric validation)
7. Prompt for validator commands in a loop (text input, continue until blank entry)
8. If Claude backend selected, prompt for `skip_permissions` (confirm prompt)
9. Prompt for notification preference (select: disabled, all, individual)
10. Validate assembled config via `config.validate()`
11. If `--dry-run` flag, pretty-print the config JSON and exit
12. Write config to `.ody/ody.json` via `config.writeConfig()`
13. Support CLI flag overrides: `-b`, `-i`, `-m`, `-c`, `-a`, `-n` to skip corresponding prompts
14. Print intro/outro styled messages using terminal helpers

## Dependencies
- Interactive prompts module (`src/util/prompt.zig`)
- Backend detection module (`src/backend/detect.zig`)
- Config module (`src/lib/config.zig`)
- Terminal helpers (`src/util/terminal.zig`) for intro/outro/spinner
- Constants module (`src/util/constants.zig`)

## Implementation Approach
1. Define the init command handler function: `pub fn run(allocator, args) !void`
2. Print intro message
3. Create `.ody/` directory with `std.fs.cwd().makePath(".ody")`
4. Check CLI args for flag overrides; only prompt for unconfigured values
5. Detect available backends; if none found, print error and exit
6. Run the interactive prompt sequence, checking for `null` returns (user cancelled)
7. Assemble the `OdyConfig` struct from collected values
8. Run `config.validate()` on the assembled config
9. If `--dry-run`, serialize to JSON and print, then return
10. Call `config.writeConfig()` to persist
11. Print outro success message
12. Handle cancellation (any prompt returning null) by printing a cancellation message and exiting cleanly

## Acceptance Criteria

1. **Directory Creation**
   - Given no `.ody/` directory exists
   - When running `ody init`
   - Then `.ody/` is created before any prompts appear

2. **Backend Detection**
   - Given Claude and OpenCode are installed
   - When the backend prompt appears
   - Then both "claude" and "opencode" are available as options

3. **Full Interactive Flow**
   - Given a user completes all prompts
   - When the wizard finishes
   - Then `.ody/ody.json` contains all configured values

4. **Dry Run Mode**
   - Given the `--dry-run` flag is passed
   - When the wizard completes
   - Then the config JSON is printed to stdout and no file is written

5. **Flag Overrides**
   - Given `ody init -b claude -i 5`
   - When the wizard runs
   - Then backend and max_iterations prompts are skipped, using the flag values

6. **Cancellation Handling**
   - Given the user presses Ctrl+C during a prompt
   - When cancellation is detected
   - Then a clean exit message is shown and no partial config is written

## Metadata
- **Complexity**: High
- **Labels**: zig-rewrite, phase-6, command, init
