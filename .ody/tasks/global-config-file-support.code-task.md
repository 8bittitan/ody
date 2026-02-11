---
status: completed
created: 2026-02-11
started: 2026-02-10
completed: 2026-02-10
---
# Task: Global Config File Support

## Description
Add support for a global `ody.json` configuration file that lives in the user's HOME directory under a `.ody` folder. This allows users to define default settings (backend, maxIterations, etc.) that apply across all projects without duplicating configuration in each project's `.ody/ody.json`. The global config should act as a fallback when local project config values are not set.

## Background
Currently, Ody only reads configuration from the local project's `.ody/ody.json` file. Users who work with multiple projects must configure settings like `backend` and `maxIterations` for each project separately. A global config in the user's home directory (`~/.ody/ody.json` on Unix or `%USERPROFILE%\.ody\ody.json` on Windows) would provide sensible defaults while still allowing project-level overrides. The config loading mechanism in `packages/cli/src/lib/config.ts` currently loads from a single path; it needs to be extended to support a merge strategy where global config is loaded first, then local config overlays on top.

## Technical Requirements
1. Detect the user's home directory using `Bun.env.HOME` (preferred for Bun projects) with `os.homedir()` as fallback, and `Bun.env.USERPROFILE` for Windows
2. Support global config at `~/.ody/ody.json` as the primary global location
3. Optionally support XDG-compliant paths like `~/.config/ody/ody.json` as fallback (note: NOT `~/.config/.ody/` -- the conventional XDG path omits the leading dot within `~/.config/`)
4. Load global config first, then merge with local project config (local values take precedence)
5. Maintain backward compatibility — existing setups without global config continue to work unchanged
6. Log when global config is loaded (at `log.info` level) to aid debugging
7. Ensure the config merge respects the Zod schema validation
8. Use `Bun.file()` for reading config files (preferred over `fs/promises` per project conventions)

## Dependencies
- `packages/cli/src/lib/config.ts` — Config loading logic and `Config.load()` function. Currently reads from `path.join(BASE_DIR, ODY_FILE)` which resolves to `.ody/ody.json`. The Zod schema (`configSchema`) includes fields: `backend`, `maxIterations`, `shouldCommit`, `validatorCommands`, `model`, `skipPermissions`, `tasksDir`.
- `packages/cli/src/util/constants.ts` — Contains `BASE_DIR` ('.ody') and `ODY_FILE` ('ody.json') constants. May need new constants for global config paths.
- `Bun.file()` — For reading config files (preferred over `fs/promises` per project conventions)
- `Bun.env` — For `HOME` and `USERPROFILE` environment variables
- `os` module from Node.js for `homedir()` as fallback
- `path` module for cross-platform path joining

## Implementation Approach
1. **Add global config path detection** — Create a helper function to resolve the global config directory using `Bun.env.HOME` (preferred) with `os.homedir()` as fallback. Check for `~/.ody/ody.json` first, then `~/.config/ody/ody.json` as XDG fallback.
2. **Implement config merging** — Refactor `Config.load()` to: a) Load global config using `Bun.file().text()` if it exists, b) Load local project config if it exists, c) Merge with local taking precedence (using object spread; for array fields like `validatorCommands`, local should fully replace global rather than concatenate), d) Validate the final merged config against the Zod schema.
3. **Update logging** — Add `log.info()` calls indicating when global config is loaded and from which path to help users understand the configuration source.
4. **Handle edge cases** — Ensure graceful handling when neither global nor local config exists (config remains undefined/empty), when only global exists (use global defaults), and when only local exists (current behavior).
5. **Update CLI init command** — Consider whether `ody init` should offer to create/update the global config in addition to or instead of local config (optional enhancement).

## Acceptance Criteria

1. **Global config detection**
   - Given a file exists at `~/.ody/ody.json` (or `%USERPROFILE%\.ody\ody.json` on Windows)
   - When the CLI loads configuration
   - Then the global config is loaded and logged as "Loading global configuration from ~/.ody/ody.json"

2. **Config merging with local precedence**
   - Given global config has `"backend": "claude"` and local config has `"backend": "opencode"`
   - When the CLI loads configuration
   - Then `Config.get('backend')` returns `"opencode"` (local value takes precedence)

3. **Global defaults applied**
   - Given global config has `"maxIterations": 5` and local config does not define `maxIterations`
   - When the CLI loads configuration
   - Then `Config.get('maxIterations')` returns `5` from the global config

4. **Backward compatibility**
   - Given no global config file exists and local config has `"backend": "codex"`
   - When the CLI loads configuration
   - Then only the local config is loaded and `Config.get('backend')` returns `"codex"`

5. **XDG fallback support**
   - Given no file at `~/.ody/ody.json` but file exists at `~/.config/ody/ody.json`
   - When the CLI loads configuration
   - Then the XDG-compliant path is used as the global config source

6. **Schema validation**
   - Given global config contains an invalid backend name `"invalid-backend"`
   - When the CLI attempts to load configuration
   - Then a Zod validation error is raised and the process exits with an error message

## Metadata
- **Complexity**: Medium
- **Labels**: config, cli, global, cross-platform
