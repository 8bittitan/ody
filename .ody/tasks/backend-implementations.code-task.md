---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Backend Implementations (Claude, Codex, OpenCode)

## Description
Implement the three backend modules (`src/backend/claude.zig`, `src/backend/codex.zig`, `src/backend/opencode.zig`) that each define how to build command-line argument arrays for invoking their respective AI coding tools. Each backend produces `buildCommand` and `buildOnceCommand` argument arrays tailored to its tool's CLI interface.

## Background
The TypeScript implementation has three backend classes in `packages/cli/src/backends/` that extend a `Harness` base class. Each backend builds a different `argv` array for spawning the respective tool. The Claude backend conditionally includes `--dangerously-skip-permissions`, the Codex backend conditionally includes `--skip-git-repo-check`, and the OpenCode backend is the only one that uses `model` and `agent` from `CommandOptions`.

## Technical Requirements
1. **Claude backend** (`src/backend/claude.zig`):
   - Build command: `["claude", "-p", prompt, "--allowedTools", ...]`
   - Conditionally include `--dangerously-skip-permissions` based on `skip_permissions` config
   - Prefix prompt with `@.ody/tasks` path reference
   - Implement both `buildCommand` and `buildOnceCommand`
2. **Codex backend** (`src/backend/codex.zig`):
   - Build command: `["codex", ...]`
   - Conditionally include `--skip-git-repo-check` based on `should_commit` config
   - Implement both `buildCommand` and `buildOnceCommand`
3. **OpenCode backend** (`src/backend/opencode.zig`):
   - Build command: `["opencode", ...]`
   - Only backend that uses `model` and `agent` from `CommandOptions`
   - Conditionally include `--model` and `--agent` flags
   - Implement both `buildCommand` and `buildOnceCommand`
4. All backends use `std.ArrayList([]const u8)` for building argument arrays
5. All backends store a reference to the `OdyConfig` for accessing config-dependent flags

## Dependencies
- Backend harness module (`src/backend/harness.zig`) for `Backend`, `CommandOptions` types
- Config module (`src/lib/config.zig`) for `OdyConfig` type
- Constants module (`src/util/constants.zig`) for paths

## Implementation Approach
1. For each backend, create a struct (e.g., `Claude`) that holds a reference or copy of relevant config fields
2. Implement `buildCommand()`:
   - Initialize an `ArrayList([]const u8)`
   - Append the executable name as the first argument
   - Append the prompt flag and prompt string
   - Conditionally append backend-specific flags based on config
   - Return `list.toOwnedSlice()`
3. Implement `buildOnceCommand()` with any differences from loop mode (e.g., different flags for interactive execution)
4. Implement a `name()` function returning the backend's display name string
5. Wire each backend struct into the `Backend` tagged union in `harness.zig`
6. Review the TypeScript implementations for exact flag names and ordering

## Acceptance Criteria

1. **Claude Command with Skip Permissions**
   - Given config with `skip_permissions = true`
   - When building a Claude command
   - Then `--dangerously-skip-permissions` is included in the argument array

2. **Claude Command without Skip Permissions**
   - Given config with `skip_permissions = false`
   - When building a Claude command
   - Then `--dangerously-skip-permissions` is NOT in the argument array

3. **Codex Git Check Flag**
   - Given config with `should_commit = false`
   - When building a Codex command
   - Then `--skip-git-repo-check` is included in the argument array

4. **OpenCode Model and Agent**
   - Given `CommandOptions{ .model = "gpt-4", .agent = "review" }`
   - When building an OpenCode command
   - Then `--model gpt-4` and `--agent review` are in the argument array

5. **Prompt Included**
   - Given a prompt string "implement feature X"
   - When building any backend command
   - Then the prompt text appears in the argument array

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-3, backend
