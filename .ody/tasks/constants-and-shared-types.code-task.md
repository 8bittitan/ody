---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: Constants and Shared Types

## Description
Port all application constants from the TypeScript implementation to `src/util/constants.zig` and define shared type definitions in `src/types.zig`. These are foundational modules referenced by nearly every other module in the Zig rewrite.

## Background
The current TypeScript implementation defines constants like `BASE_DIR`, `ODY_FILE`, `TASKS_DIR`, and `ALLOWED_BACKENDS` in `packages/cli/src/util/constants.ts`. The Zig version needs equivalent compile-time constants. Additionally, shared types like `CompletedTask` and `CommandOptions` are used across multiple modules and should be centralized in `types.zig`. The planning doc notes that `PRD_FILE` is dead code and should be dropped.

## Technical Requirements
1. Create `src/util/constants.zig` with all application constants as `pub const` declarations
2. Port `BASE_DIR = ".ody"`, `ODY_FILE = "ody.json"`, `TASKS_DIR = "tasks"`
3. Define `ALLOWED_BACKENDS` as a comptime array of string slices: `[_][]const u8{ "opencode", "claude", "codex" }`
4. Drop `PRD_FILE` (identified as dead code in the planning doc)
5. Create `src/types.zig` with shared type definitions: `CompletedTask`, `CommandOptions`, and any other cross-cutting types
6. All string constants should be `[]const u8` comptime values
7. Types should use Zig idioms (optional fields with `?`, default values with `=`)

## Dependencies
- Project scaffolding task must be completed (directory structure exists)

## Implementation Approach
1. Review the TypeScript `packages/cli/src/util/constants.ts` to identify all constants that need porting
2. Create `src/util/constants.zig` with `pub const` declarations for each constant
3. Review TypeScript source files for shared types used across modules (e.g., `CompletedTask` in task parsing, `CommandOptions` in backend harness)
4. Define these types in `src/types.zig` using Zig structs with appropriate field types and defaults
5. Ensure all types use `[]const u8` for strings and `?` for optional fields
6. Verify the module compiles with `zig build`

## Acceptance Criteria

1. **Constants Available**
   - Given `src/util/constants.zig` exists
   - When importing `constants` from another module
   - Then `BASE_DIR`, `ODY_FILE`, `TASKS_DIR`, and `ALLOWED_BACKENDS` are accessible

2. **No Dead Code**
   - Given the constants module
   - When reviewing its contents
   - Then `PRD_FILE` is not present

3. **Shared Types Compile**
   - Given `src/types.zig` with `CompletedTask` and `CommandOptions`
   - When importing and using these types in another module
   - Then the code compiles without errors

4. **Idiomatic Zig**
   - Given all type definitions
   - When reviewing the code
   - Then optional fields use `?T`, defaults use `= value`, and strings are `[]const u8`

## Metadata
- **Complexity**: Low
- **Labels**: zig-rewrite, phase-1, infrastructure
