---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: CLI Argument Parsing and Command Dispatch

## Description
Implement the main entry point (`src/main.zig`) with zig-clap argument parsing and command dispatch to all subcommands. This replaces the `citty` command framework used in the TypeScript implementation. Also implement the `--version` flag using a comptime-embedded version string.

## Background
The TypeScript implementation uses the `citty` framework for defining CLI commands with metadata, arguments, and handlers. The Zig rewrite uses `zig-clap` for argument parsing. The `main()` function needs to parse top-level arguments, load configuration (with error handling since config may not exist for `ody init`), and dispatch to the appropriate command handler. The version is currently read from `package.json` but will be embedded at compile time in the Zig version.

## Technical Requirements
1. Define the full command tree using zig-clap:
   - `ody init` with flags: `-b/--backend`, `-i/--max-iterations`, `-m/--model`, `-c/--should-commit`, `-a/--agent`, `-n/--notify`, `--dry-run`
   - `ody run` with positional `taskFile`, flags: `--verbose`, `--once`, `--dry-run`, `-l/--label`, `-i/--iterations`, `--no-notify`
   - `ody config` (no additional flags)
   - `ody plan new` with flags: `--dry-run`, `--verbose`
   - `ody plan edit` with flags: `--dry-run`, `--verbose`
   - `ody plan list` with flag: `-s/--status`
   - `ody plan compact` (no additional flags)
2. `main()` should use `std.heap.GeneralPurposeAllocator` (or arena allocator)
3. Load config via `config.load()` wrapped in error handling (config may not exist for `init`)
4. Dispatch to the appropriate `cmd/*.zig` handler based on parsed subcommand
5. Implement `--version` flag that prints a comptime-embedded version string
6. The version string should be set in `build.zig` via build options or `@embedFile`
7. Print help text when no subcommand is provided or `--help` is passed

## Dependencies
- zig-clap library (declared in `build.zig.zon`)
- Config module (`src/lib/config.zig`) for `config.load()`
- All command handler modules (`src/cmd/*.zig`)

## Implementation Approach
1. In `build.zig`, add a build option for the version string (e.g., `b.option([]const u8, "version", "Version string")` or use `@embedFile`)
2. In `main.zig`, define zig-clap argument specs for each subcommand
3. Set up the `main()` function:
   - Initialize GPA allocator
   - Parse arguments with zig-clap
   - Handle `--version` and `--help` early returns
   - Attempt `config.load()` in a try-catch (allow failure for `init` command)
   - Switch on the parsed subcommand to dispatch to handlers
4. Each command handler receives the allocator and parsed args
5. Ensure proper error reporting with meaningful messages on parse failures
6. Use defer to deinit the allocator

## Acceptance Criteria

1. **Version Flag**
   - Given the compiled binary
   - When running `ody --version`
   - Then the version string is printed and the program exits

2. **Help Text**
   - Given no subcommand provided
   - When running `ody` or `ody --help`
   - Then help text listing all subcommands is displayed

3. **Subcommand Dispatch**
   - Given a valid subcommand like `ody init`
   - When the command is parsed
   - Then the init command handler is invoked with the correct parsed arguments

4. **Config Error Handling**
   - Given no `.ody/ody.json` exists
   - When running `ody init`
   - Then the command proceeds without error (config loading failure is tolerated)

5. **Invalid Arguments**
   - Given an unrecognized flag like `ody run --nonexistent`
   - When parsing arguments
   - Then a clear error message is displayed

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-2, cli, command-dispatch
