# AGENTS

Guidance for agentic coding in this repository.
Focus on Zig CLI tooling.

## Repo summary

- Structure: Single Zig project in `cli/` directory.
- Runtime: Zig (standard library + zig-clap for argument parsing).
- Language: Zig (minimum version 0.15.0).
- CLI binary: `cli/zig-out/bin/ody`.
- Entry point: `cli/src/main.zig`.
- Argument parsing: `zig-clap` (declared in `cli/build.zig.zon`).
- Backends live in `cli/src/backend/` as a tagged union (`harness.zig`).
- Prompt builders live in `cli/src/builder/`.
- Shared utilities in `cli/src/util/` and `cli/src/lib/`.
- Shared types in `cli/src/types.zig`.
- Config is stored under `.ody/ody.json` in the project root.
- Task files live in `.ody/tasks/` as `.code-task.md` files.

## File layout

```
cli/
├── build.zig              # Build configuration (exe, test, cross targets)
├── build.zig.zon          # Package manifest (zig-clap dependency)
└── src/
    ├── main.zig           # Entry point, module re-exports, test discovery
    ├── types.zig           # Shared types (OdyConfig, NotifySetting, etc.)
    ├── backend/
    │   ├── harness.zig     # Backend tagged union interface
    │   ├── detect.zig      # PATH-based backend availability detection
    │   ├── claude.zig      # Claude backend command builder
    │   ├── codex.zig       # Codex backend command builder
    │   └── opencode.zig    # OpenCode backend command builder
    ├── builder/
    │   ├── prompt.zig      # Barrel re-export for all builders
    │   ├── replace.zig     # Shared placeholder replacement helper
    │   ├── run_prompt.zig  # Run loop and single-task prompt templates
    │   ├── plan_prompt.zig # Plan creation prompt template
    │   └── edit_plan_prompt.zig  # Plan edit prompt template
    ├── cmd/
    │   ├── config.zig      # ody config command
    │   ├── init.zig        # ody init interactive wizard
    │   ├── run.zig         # ody run agent execution loop
    │   └── plan/
    │       ├── list.zig    # ody plan list
    │       ├── compact.zig # ody plan compact (archive completed tasks)
    │       ├── new.zig     # ody plan new (create task files)
    │       └── edit.zig    # ody plan edit (revise task files)
    ├── lib/
    │   ├── config.zig      # Config loading, validation, merging, persistence
    │   └── notify.zig      # OS desktop notifications (macOS/Linux)
    └── util/
        ├── constants.zig   # Application-wide constants
        ├── terminal.zig    # ANSI escape codes, colors, spinner
        ├── stream.zig      # Child process stdout/stderr draining
        ├── spawn.zig       # Process spawning (piped mode)
        ├── task.zig        # Task file parsing (frontmatter, titles, labels)
        └── prompt.zig      # Interactive terminal prompts (text, confirm, select)
```

## Commands

All commands run from the `cli/` directory.

### Build

- `zig build` (debug build, output: `zig-out/bin/ody`).
- `zig build -Doptimize=ReleaseSafe` (release build).
- `zig build cross` (cross-compile for linux-x86_64, linux-aarch64, macos-x86_64, macos-aarch64).

### Run (dev)

- `zig build run` (build and run the CLI).
- `zig build run -- <args>` (pass arguments to the CLI).

### Test

- `zig build test` (runs all unit tests across the source tree).
- Tests are co-located with source files using Zig's `test` keyword.
- `main.zig` pulls in all sub-module tests via a `comptime` block.

### Lint / Format

- `zig fmt --check src/` (check formatting without modifying files).
- `zig fmt src/` (auto-format all source files).

## Configuration

- `config.load(allocator)` must run before any `config.all()` or `config.get()`.
- Config is parsed from JSON using `std.json.parseFromSlice` with a `JsonConfig` struct (camelCase fields matching the on-disk format).
- Global config (`~/.ody/ody.json` or `~/.config/ody/ody.json`) is merged with local (`.ody/ody.json`); local values take precedence.
- Current keys in `.ody/ody.json`:
  - `backend`: one of `opencode`, `claude`, `codex`.
  - `maxIterations`: number of loop iterations (0 = unlimited).
  - `shouldCommit`: boolean toggling git commit behavior for agents.
  - `validatorCommands`: array of shell commands to validate work.
  - `model`: optional model identifier.
  - `skipPermissions`: boolean (Claude backend only).
  - `agent`: agent profile string (default `"build"`).
  - `tasksDir`: custom tasks directory (default `"tasks"`).
  - `notify`: `"disabled"`, `"all"`, or `"individual"`.
- Prefer updating config via the CLI (`ody init`) when possible.

## Code style and conventions

### Imports

- Use `@import()` for all module imports.
- Group imports: `std` and external deps first, then internal modules.
- Keep relative imports (`../`) within `src`.

### Formatting

- Use `zig fmt` for all formatting (enforced in CI).
- Four-space indentation (Zig default).
- No manual formatting overrides.

### Types

- Define types as `struct`, `enum`, `union(enum)`, or `error` sets.
- Use tagged unions for polymorphism (e.g., `Backend` in `harness.zig`).
- Use `?T` for optional values, `!T` for error unions.
- Define `pub const` for exported types; keep internal types unexported.
- Centralize shared types in `types.zig`.

### Naming

- `PascalCase` for types and structs (e.g., `OdyConfig`, `Backend`).
- `camelCase` for functions and local variables (e.g., `buildCommand`, `parseFrontmatter`).
- `UPPER_SNAKE_CASE` for comptime constants (e.g., `BASE_DIR`, `ALLOWED_BACKENDS`).
- `snake_case` for struct fields (e.g., `max_iterations`, `should_commit`).
- File names are `snake_case` and match their primary export.

### Error handling

- Use Zig error unions (`!`) for fallible operations.
- Propagate errors with `try`; handle with `catch`.
- Use `errdefer` for cleanup on error paths.
- For best-effort operations (e.g., notifications), catch and discard errors silently.
- Log errors via `terminal.err()` or `terminal.warn()`.

### Memory management

- Accept `std.mem.Allocator` as the first parameter for functions that allocate.
- Use `std.heap.GeneralPurposeAllocator` in `main()`.
- Use `std.ArrayList` (unmanaged, Zig 0.15 pattern) for dynamic arrays.
- Free allocations with `defer` or `errdefer` at the call site.
- Use `arena` allocators for request-scoped memory when appropriate.

### Process spawning

- Use `std.process.Child` for spawning child processes.
- Configure stdio: `stdin = .close`, `stdout = .pipe`, `stderr = .pipe` (or `.inherit` for verbose mode).
- Drain pipes concurrently using `drainStream()` from `util/stream.zig`.
- Detect completion via the `<woof>COMPLETE</woof>` marker in stdout.

### Terminal output

- Use functions from `util/terminal.zig` for colored/styled output.
- Use `terminal.intro()`, `terminal.outro()`, `terminal.log()`, `terminal.warn()`, `terminal.err()` for framed messages.
- Use `terminal.Spinner` for long-running operations.
- All terminal functions accept an `is_tty` bool to suppress ANSI codes on non-TTY output.

### Testing

- Write tests using Zig's `test` keyword, co-located with source code.
- Use `std.testing.expect`, `std.testing.expectEqual`, `std.testing.expectEqualStrings` for assertions.
- All module tests are pulled into the test runner via the `comptime` block in `main.zig`.
- Run tests with `zig build test`.

## CI pipeline

- Zig CI: `.github/workflows/zig-ci.yml` (lint, test, build jobs).
- Triggers on push/PR to `main` when `cli/**` files change.
- Uses `mlugg/setup-zig@v1` with Zig 0.15.0.

## When adding new code

- Keep new modules under `cli/src/` in the appropriate subdirectory.
- Add `pub const` re-export in `main.zig` and include in the `comptime` test block.
- Update CLI commands only through `src/cmd/`.
- Add new backends in `src/backend/` and register in the `Backend` tagged union in `harness.zig`.
- Add tests inline using `test` blocks in the source file.
- Update `README.md` if run/build instructions change.

## Agent safety notes

- Do not edit `.ody/ody.json` unless a task requires it.
- Avoid committing the generated `ody` binary or `zig-out/` directory unless requested.
- Respect `shouldCommit` behavior when running agents.
- Do not modify `build.zig.zon` dependency hashes unless updating a dependency version.

## Quick checks

- `zig build` to validate the build (from `cli/`).
- `zig build test` to run all unit tests (from `cli/`).
- `zig fmt --check src/` to verify formatting (from `cli/`).

## Notes

- Update this file if new tooling or rules are added.
- The `packages/cli` directory contains the legacy TypeScript implementation (being replaced by `cli/`).
- Only the `cli/` Zig implementation should receive new development.
