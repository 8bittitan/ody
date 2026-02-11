---
status: completed
created: 2026-02-11
started: 2026-02-10
completed: 2026-02-10
---
# Task: Add Config Command to Display Current Configuration

## Description
Add a new CLI command called `config` that displays the current Ody configuration values found in `.ody/ody.json`. This command will help users quickly verify and inspect their project settings without manually opening the configuration file.

## Background
The Ody CLI stores configuration in `.ody/ody.json` and uses a `Config` namespace (`packages/cli/src/lib/config.ts`) to load and access these values. Currently, users must manually read the configuration file to see their settings. A dedicated `config` command will provide a convenient way to view the current configuration, similar to how many CLI tools expose configuration inspection commands.

## Technical Requirements
1. Create a new command file `packages/cli/src/cmd/config.ts` following the existing command pattern (see `init.ts`, `run.ts`, `plan.ts`)
2. The command must use `defineCommand` from `citty` with appropriate `meta` (name: 'config', description)
3. `Config.load()` is already called in the root command's `setup()` hook in `packages/cli/src/index.ts`, so subcommands do not need to call it again. The command can directly use `Config.all()` and `Config.get()`.
4. The command must handle the case when no configuration exists (`.ody/ody.json` not found) with a helpful message
5. Output must be formatted for readability (JSON or structured text)
6. The command must be registered in `packages/cli/src/index.ts` in the `subCommands` object

## Dependencies
- `packages/cli/src/lib/config.ts` — `Config` namespace with `load()`, `all()`, and `get()` methods
- `@clack/prompts` — For user-friendly output formatting (use `log.info`, `outro`, etc.)
- `citty` — CLI framework for command definition

## Implementation Approach
1. **Create the command file** — Create `packages/cli/src/cmd/config.ts` with a `configCmd` export
2. **Define command structure** — Use `defineCommand` with appropriate meta and no required args
3. **Implement the run function** — In the `run` function:
   - `Config.load()` is already called in the root command's `setup()` hook, so it does not need to be called again
   - Check if configuration exists (if `Config.all()` throws or returns undefined)
   - If no config exists, display a message indicating no configuration was found
   - If config exists, retrieve all values via `Config.all()` and format them for display
4. **Format output** — Use `JSON.stringify(config, null, 2)` for readable JSON output, wrapped with `log.info()`
5. **Register the command** — Import and add `config: configCmd` to the `subCommands` object in `packages/cli/src/index.ts`
6. **Test the command** — Run `ody config` to verify it displays the current configuration

## Acceptance Criteria

1. **Command displays configuration**
   - Given a project with an existing `.ody/ody.json` file containing valid configuration
   - When the user runs `ody config`
   - Then the command outputs the current configuration values in a readable format

2. **Handles missing configuration**
   - Given a project without an `.ody/ody.json` file
   - When the user runs `ody config`
   - Then the command displays a helpful message indicating no configuration was found

3. **Command is registered**
   - Given the CLI is built and available
   - When the user runs `ody --help`
   - Then the `config` command appears in the list of available subcommands

4. **Formatted output**
   - Given the configuration contains nested values (like `validatorCommands` array)
   - When the user runs `ody config`
   - Then the output is properly formatted and easy to read

5. **Build succeeds**
   - Given the changes are applied
   - When `bun run build` is executed from the root
   - Then the build completes without errors

## Metadata
- **Complexity**: Low
- **Labels**: cli, config, command
