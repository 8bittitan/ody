---
status: pending
created: 2026-02-13
started: null
completed: null
---
# Task: Backend Harness Interface and Detection

## Description
Implement the backend harness interface (`src/backend/harness.zig`) as a Zig tagged union with `buildCommand` and `buildOnceCommand` methods, and implement backend availability detection (`src/backend/detect.zig`) by searching the system PATH for executable files. This replaces the abstract `Backend` class and `Bun.which()` from the TypeScript implementation.

## Background
The TypeScript implementation uses an abstract `Harness` class that each backend extends, with methods for building command argument arrays. Backend detection uses `Bun.which()` to check if a CLI tool exists on PATH. In Zig, the abstract class pattern is replaced with a tagged union (or vtable), and `Bun.which()` is replaced with a manual PATH search using `std.fs.accessAbsolute`.

## Technical Requirements
1. Define `Backend` tagged union in `src/backend/harness.zig`:
   - Variants: `claude: Claude`, `codex: Codex`, `opencode: Opencode`
   - Methods: `buildCommand(allocator, prompt, opts) ![]const []const u8`, `buildOnceCommand(allocator, prompt, opts) ![]const []const u8`, `name() []const u8`
2. Define `CommandOptions` struct: `model: ?[]const u8 = null`, `agent: ?[]const u8 = null`
3. Implement `fromConfig(config: OdyConfig) Backend` factory function
4. Implement `which(name: []const u8) ?[]const u8` in `src/backend/detect.zig`:
   - Split `std.posix.getenv("PATH")` on `:`
   - Check each directory for an executable file using `std.fs.accessAbsolute` with executable mode
5. Implement `getAvailableBackends(allocator) ![][]const u8` that checks all known backend executables

## Dependencies
- Config module (`src/lib/config.zig`) for `OdyConfig` type
- Constants module (`src/util/constants.zig`) for `ALLOWED_BACKENDS`
- Individual backend modules (can use forward declarations initially)

## Implementation Approach
1. Create `src/backend/detect.zig`:
   - Implement `which()` by splitting PATH env var and checking each directory
   - Use `std.fs.path.join` to construct full paths, `std.fs.accessAbsolute` to check existence and executability
   - Return the full path on success, `null` on not found
   - Implement `getAvailableBackends()` that iterates over backend executable names
2. Create `src/backend/harness.zig`:
   - Define `CommandOptions` struct
   - Define `Backend` as `union(enum)` with claude, codex, opencode variants
   - Implement dispatch methods that switch on the active variant
   - Implement `fromConfig()` that maps the config backend string to the appropriate union variant
3. Use `std.ArrayList([]const u8)` for building command argument arrays in each backend

## Acceptance Criteria

1. **Backend Dispatch**
   - Given a config with `backend = "claude"`
   - When calling `Backend.fromConfig(config)`
   - Then a `Backend` with the `.claude` variant is returned

2. **Command Building**
   - Given a Claude backend instance
   - When calling `buildCommand(allocator, "test prompt", .{})`
   - Then a valid argument array is returned starting with the claude executable name

3. **PATH Detection**
   - Given an executable exists on PATH
   - When calling `detect.which("zig")`
   - Then the full path to the executable is returned

4. **Missing Executable**
   - Given an executable does not exist on PATH
   - When calling `detect.which("nonexistent-tool-xyz")`
   - Then `null` is returned

5. **Available Backends**
   - Given some backend tools are installed
   - When calling `getAvailableBackends(allocator)`
   - Then only the installed backends are returned in the list

## Metadata
- **Complexity**: Medium
- **Labels**: zig-rewrite, phase-3, backend
