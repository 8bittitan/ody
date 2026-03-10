---
status: completed
created: 2026-03-09
started: 2026-03-09
completed: 2026-03-09
---

# Task: Rename `shouldCommit` Config Property to `autoCommit`

## Description
Rename the `shouldCommit` configuration property to `autoCommit` across the entire codebase — schema, CLI flag, desktop UI, prompt builders, documentation, and config files. The old `shouldCommit` key must still be accepted in JSON config files during a deprecation period, with a warning logged to guide users toward the new name.

## Background
The current property name `shouldCommit` reads as a question rather than a setting. `autoCommit` is more intuitive and already matches the labels used in the desktop UI ("Auto-commit", "Auto Commit"). This rename aligns the internal config key with its user-facing terminology.

## Technical Requirements

1. **Config schema** (`internal/config/src/config.ts`):
   - Rename the `shouldCommit` field to `autoCommit` in both `configSchema` (line 37) and the described schema variant inside `Config.Schema` (line 139).
   - Update the `OdyConfig` type accordingly (it is inferred from the schema).

2. **Backward-compatible config loading** (`internal/config/src/config.ts`):
   - During config loading/normalization, detect the presence of the legacy `shouldCommit` key in the raw JSON object.
   - If found, map its value to `autoCommit`, emit a `log.warn` message (e.g., `'Config key "shouldCommit" is deprecated. Use "autoCommit" instead.'`), and delete the legacy key before validation.
   - If both keys are present, `autoCommit` takes precedence; still warn about the deprecated key.

3. **CLI flag** (`packages/cli/src/cmd/init.ts`):
   - Rename the `--shouldCommit` arg to `--autoCommit`. Keep `-c` as the short alias.
   - Update the flag description to reflect the new name.
   - Update the reference where `args.shouldCommit` is read (line 157) to `args.autoCommit`.

4. **Prompt builder** (`internal/builders/src/runPrompt.ts`):
   - Replace all references to `shouldCommit` in type annotations, config reads, template text, and placeholder replacements with `autoCommit`.
   - Update the prompt instruction text (e.g., "If autoCommit is true, create a git commit…").

5. **Desktop package** — update every component that reads or displays `shouldCommit`:
   - `components/config/form.ts` — `ConfigFormState` type, `createDefaultConfigForm`, `toConfigFormState`, `toConfigPayload`.
   - `components/AgentRunner.tsx` — config read and run-confirmation panel.
   - `routes/__root.tsx` — continuous run handler.
   - `components/TaskBoard.tsx` — single-task quick-run.
   - `components/SettingsModal.tsx` — settings switch.
   - `components/InitWizard.tsx` — init wizard switch.
   - `components/ConfigPanel.tsx` — config panel field path mapping and switch.

6. **Documentation**:
   - `packages/docs/content/docs/configuration.mdx` — update JSON examples.
   - `packages/docs/content/docs/commands/init.mdx` — update flag name in table and usage example.
   - `packages/docs/content/docs/commands/config.mdx` — update JSON example.
   - `packages/docs/public/configuration_schema.json` — rename key.
   - `README.md` — update CLI flag table and config key table.

7. **Project config and agent guidance**:
   - `.ody/ody.json` — rename the key.
   - `AGENTS.md` — update the reference on line 161 to say `autoCommit`.

8. **Task and planning files** (best-effort, non-critical):
   - Update references in `.ody/progress.txt`, `.ody/tasks/*.code-task.md`, and `planning/server/implementation.md` for consistency.

## Dependencies
- `@clack/prompts` `log.warn` is already used elsewhere in the codebase for user-facing warnings.
- No new packages or APIs are required.

## Implementation Approach

1. Update the zod schema in `internal/config/src/config.ts` — rename the field to `autoCommit` in both the base and described schema variants.
2. Add a deprecation shim in the config loading path: before zod validation, check the raw config object for `shouldCommit`, migrate it to `autoCommit`, and emit a `log.warn`.
3. Find-and-replace `shouldCommit` → `autoCommit` in all TypeScript source files across `internal/builders`, `packages/cli`, and `packages/desktop`, updating types, variable names, config reads, and template strings.
4. Update all documentation files (`.mdx`, `README.md`, JSON schema) to use `autoCommit`.
5. Update `.ody/ody.json` and `AGENTS.md`.
6. Update task/planning markdown files for consistency.
7. Run `bun fmt`, `bun lint`, `bun typecheck`, and `bun test` to verify nothing is broken.

## Acceptance Criteria

1. **Schema uses new name**
   - Given the config schema in `internal/config/src/config.ts`
   - When inspecting the `configSchema` and described schema
   - Then both define `autoCommit` as a boolean field with default `false`, and `shouldCommit` no longer exists in the schema.

2. **New config key works**
   - Given a `.ody/ody.json` containing `"autoCommit": true`
   - When the config is loaded via `Config.load()`
   - Then `Config.get().autoCommit` returns `true` with no warnings.

3. **Legacy config key triggers deprecation warning**
   - Given a `.ody/ody.json` containing `"shouldCommit": true` (without `autoCommit`)
   - When the config is loaded via `Config.load()`
   - Then `Config.get().autoCommit` returns `true` and a deprecation warning is logged.

4. **Both keys present — new key wins**
   - Given a config with `"shouldCommit": false` and `"autoCommit": true`
   - When the config is loaded
   - Then `autoCommit` is `true` and a deprecation warning is logged about the legacy key.

5. **CLI flag renamed**
   - Given the `ody init` command
   - When invoked with `--autoCommit` or `-c`
   - Then the generated config sets `autoCommit` to `true`.

6. **All code references updated**
   - Given a project-wide search for the string `shouldCommit`
   - When searching TypeScript source files (`.ts`, `.tsx`)
   - Then zero matches are found (excluding task/planning markdown files that describe this migration).

7. **CI passes**
   - Given the completed changes
   - When `bun lint`, `bun typecheck`, and `bun test` are run
   - Then all pass without errors.

## Metadata
- **Complexity**: Medium
- **Labels**: config, refactor, deprecation, cross-cutting
