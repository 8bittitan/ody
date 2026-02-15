---
status: completed
created: 2026-02-13
started: 2026-02-13
completed: 2026-02-13
---
# Task: Config System

## Description
Implement the configuration loading, validation, merging, and persistence system in `src/lib/config.zig`. This replaces the Zod-based config system in the TypeScript implementation with manual Zig struct parsing and validation using `std.json`.

## Background
The Ody CLI uses a JSON configuration file (`.ody/ody.json`) to store settings like backend selection, iteration limits, and validator commands. The TypeScript version uses Zod for schema validation and supports both global (`~/.ody/ody.json` or `~/.config/ody/ody.json`) and local (`.ody/ody.json`) configs that are merged together. The Zig version must replicate this behavior using `std.json.parseFromSlice` for parsing and manual validation logic.

## Technical Requirements
1. Define `OdyConfig` struct with all fields: `backend`, `max_iterations`, `should_commit`, `validator_commands`, `model`, `skip_permissions`, `agent`, `tasks_dir`, `notify`
2. Define `NotifySetting` enum: `disabled`, `all`, `individual`
3. Implement `load(allocator) !OdyConfig` that resolves and merges global + local config files
4. Implement `validate(config) !void` with descriptive error messages for invalid configs
5. Implement `writeConfig(allocator, config, path) !void` to serialize and write config to disk
6. Store loaded config in a file-scoped `var` (module-level singleton pattern)
7. Implement `get(field)` and `all()` accessor functions
8. Global config resolution: try `~/.ody/ody.json` first, then `~/.config/ody/ody.json`
9. Local config resolution: `.ody/ody.json` in current working directory
10. Merge logic: local fields override global fields

## Dependencies
- Constants module (`src/util/constants.zig`) for `BASE_DIR`, `ODY_FILE`
- Zig standard library (`std.json`, `std.fs`, `std.posix`)

## Implementation Approach
1. Define the `OdyConfig` struct with default values matching the TypeScript defaults
2. Define `NotifySetting` as a Zig `enum` with JSON parsing support
3. Implement `load()`:
   - Get `HOME` from `std.posix.getenv("HOME")`
   - Try reading `~/.ody/ody.json`, fall back to `~/.config/ody/ody.json`
   - Try reading `.ody/ody.json`
   - Parse both with `std.json.parseFromSlice(OdyConfig, ...)`
   - Merge by iterating struct fields with `@typeInfo` and overriding non-default values
4. Implement `validate()` checking `backend` is in `ALLOWED_BACKENDS`, `agent` is non-empty, `tasks_dir` is non-empty
5. Implement `writeConfig()` using `std.json.stringify` with `.whitespace = .indent_2` and `std.fs.createFileAbsolute`
6. Store the loaded config in a module-level `var loaded_config: ?OdyConfig = null`
7. Provide `get()` and `all()` that read from the singleton

## Acceptance Criteria

1. **Config Loads Successfully**
   - Given a valid `.ody/ody.json` file
   - When calling `config.load(allocator)`
   - Then the `OdyConfig` struct is populated with the file's values

2. **Global/Local Merge**
   - Given a global config with `backend = "claude"` and a local config with `backend = "opencode"`
   - When loading config
   - Then the local value `"opencode"` takes precedence

3. **Validation Rejects Invalid Backend**
   - Given a config with `backend = "invalid"`
   - When calling `validate()`
   - Then an error is returned with a descriptive message

4. **Config Writes to Disk**
   - Given a valid `OdyConfig` struct
   - When calling `writeConfig(allocator, config, path)`
   - Then a properly formatted JSON file is written to the specified path

5. **Singleton Access**
   - Given config has been loaded via `load()`
   - When calling `all()`
   - Then the loaded config is returned without re-reading from disk

## Metadata
- **Complexity**: High
- **Labels**: zig-rewrite, phase-1, infrastructure, config
