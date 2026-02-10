---
status: pending
created: 2026-02-10
started: null
completed: null
---
# Task: Configurable Tasks Directory

## Description
Allow the tasks directory path to be set within the `.ody/ody.json` configuration file. Currently the tasks directory is hardcoded as `.ody/tasks/` across the prompt builder and constants. Adding a `tasksDir` config option enables users to customize where task files are stored, supporting project-specific workflows and alternative directory structures.

## Background
The Ody CLI discovers and processes `.code-task.md` files from a tasks directory. The path `.ody/tasks/` is currently defined as the `TASKS_DIR` constant in `packages/cli/src/util/constants.ts` and hardcoded into the agent prompt template in `packages/cli/src/builders/prompt.ts`. The configuration system (`packages/cli/src/lib/config.ts`) uses a Zod schema to validate `.ody/ody.json` but does not yet include a tasks directory field. The prompt builder reads config values at build time, so it can resolve a configurable tasks path and inject it into the agent prompt.

## Technical Requirements
1. Add an optional `tasksDir` field to the Zod config schema in `packages/cli/src/lib/config.ts` with a default value of `'.ody/tasks'`
2. Replace all hardcoded `.ody/tasks/` references in the `LOOP_PROMPT` template within `packages/cli/src/builders/prompt.ts` with a `{TASKS_DIR}` placeholder that is resolved from `Config.get('tasksDir')`
3. Update the `PLAN_PROMPT` template in `packages/cli/src/builders/prompt.ts` similarly so generated task instructions also reference the configured directory
4. Ensure the `TASKS_DIR` constant in `packages/cli/src/util/constants.ts` remains as a fallback default value and is used as the Zod schema default
5. Validate that the config value is a non-empty string when provided
6. The feature must be backward-compatible — existing configs without `tasksDir` must continue to work using the default

## Dependencies
- `packages/cli/src/lib/config.ts` — Zod config schema and `Config` namespace
- `packages/cli/src/util/constants.ts` — `TASKS_DIR` and `BASE_DIR` constants
- `packages/cli/src/builders/prompt.ts` — `LOOP_PROMPT`, `PLAN_PROMPT`, `buildPrompt()`, and `buildPlanPrompt()` functions

## Implementation Approach
1. **Update the config schema** — In `packages/cli/src/lib/config.ts`, add `tasksDir: z.string().nonempty().default('.ody/tasks').optional()` to `configSchema`. This keeps it optional and backward-compatible.
2. **Parameterize `LOOP_PROMPT`** — Replace the two hardcoded `.ody/tasks/` occurrences in the `LOOP_PROMPT` string with a `{TASKS_DIR}` placeholder. In `buildPrompt()`, resolve the value via `Config.get('tasksDir')` (falling back to the `TASKS_DIR` constant joined with `BASE_DIR`) and perform the string replacement.
3. **Parameterize `PLAN_PROMPT`** — Replace the hardcoded `.ody/tasks/` references in `PLAN_PROMPT` with `{TASKS_DIR}`. In `buildPlanPrompt()`, resolve and substitute the same config-driven value.
4. **Verify constant usage** — Confirm the `TASKS_DIR` constant in `constants.ts` is still used as the schema default so that the single source of truth is maintained. Import it in `config.ts` if needed for the default value.
5. **Validate end-to-end** — Run `bun run build` to confirm the project compiles. Optionally run a `--dry-run` of `ody run --once` to verify the prompt contains the correct tasks directory path.

## Acceptance Criteria

1. **Default behavior preserved**
   - Given an existing `.ody/ody.json` without a `tasksDir` field
   - When the CLI loads configuration and builds the prompt
   - Then the prompt references `.ody/tasks/` as the tasks directory

2. **Custom directory respected**
   - Given `.ody/ody.json` contains `"tasksDir": "my-tasks"`
   - When the CLI loads configuration and builds the prompt
   - Then the prompt references `my-tasks/` as the tasks directory

3. **Plan prompt updated**
   - Given a custom `tasksDir` is set in config
   - When `buildPlanPrompt()` is called
   - Then the generated plan prompt instructs the agent to write task files to the custom directory

4. **Config validation**
   - Given `.ody/ody.json` contains `"tasksDir": ""`
   - When the CLI attempts to load configuration
   - Then a Zod validation error is raised

5. **Build succeeds**
   - Given the changes are applied
   - When `bun run build` is executed
   - Then the build completes without errors

## Metadata
- **Complexity**: Low
- **Labels**: config, cli, prompt, tasks
