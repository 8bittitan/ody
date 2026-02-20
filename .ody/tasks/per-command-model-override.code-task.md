---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Per-Command Model Override in Config

## Description
Allow users to specify different models for the `run` and `plan` commands independently, while keeping a single root-level `model` property as the default fallback. This enables workflows where planning uses a more capable (and expensive) model while execution uses a faster or cheaper one, or vice versa.

## Background
Currently, the config schema defines a single `model` property at the root of `ody.json`. This model string is passed through `Backend.buildCommand()` to the active harness (only the Opencode harness currently uses it via the `-m` flag). Both `run` and `plan` commands share the same model with no way to differentiate.

Users may want to use a reasoning-heavy model for planning (e.g., `anthropic/claude-opus-4-6`) and a faster model for execution (e.g., `anthropic/claude-sonnet-4-20250514`), or any other combination. The config should support per-command overrides while preserving backward compatibility with the existing single `model` field.

## Technical Requirements
1. Add an optional `models` object to the config schema in `packages/cli/src/lib/config.ts` with optional `run` and `plan` string fields
2. The root-level `model` property must remain and serve as the default when no per-command override is specified
3. The resolution order must be: command-specific override (`models.run` or `models.plan`) > root `model` > backend default (no model flag)
4. Update `Backend.buildCommand()` in `packages/cli/src/backends/backend.ts` to accept a command context or resolved model string
5. Update the `run` command in `packages/cli/src/cmd/run.ts` to resolve the model using the new hierarchy
6. Update the `plan` command in `packages/cli/src/cmd/plan.ts` to resolve the model using the new hierarchy
7. Update the public `Config.Schema` with proper `.describe()` annotations for JSON schema generation
8. Ensure the `init` command still works correctly — the existing `--model` / `-m` flag should continue to set the root `model` property

## Dependencies
- `packages/cli/src/lib/config.ts` — config schema definition and `Config` namespace
- `packages/cli/src/backends/backend.ts` — `Backend` class that passes model to harness
- `packages/cli/src/backends/harness.ts` — `CommandOptions` type with `model?: string`
- `packages/cli/src/cmd/run.ts` — run command implementation
- `packages/cli/src/cmd/plan.ts` — plan command implementation
- `packages/cli/src/cmd/init.ts` — init command that sets `model` in config

## Implementation Approach
1. **Extend the config schema** — In `packages/cli/src/lib/config.ts`, update the `model` field in both the internal `configSchema` and the public `Config.Schema`:
   ```ts
   model: z.union(z.string(), z.object({
       run: z.string().optional(),
       plan: z.string().optional(),
   })).optional()
   ```

2. **Add a model resolution helper** — Create a utility function (either on the `Config` namespace or as a standalone helper) that resolves the effective model for a given command:
   ```ts
   function resolveModel(command: 'run' | 'plan'): string | undefined {
     const config = Config.all();

     if (typeof config.model === "string") {
       return config.model
     }

     return config.model?.[command];
   }
   ```
   This encapsulates the fallback logic in one place.

3. **Update `Backend.buildCommand()`** — Modify the method signature to accept an explicit model string rather than always reading `this.config.model`. This allows callers to pass the resolved model:
   ```ts
   buildCommand(prompt: string, model?: string): string[]
   ```
   Inside the method, pass `model ?? this.config.model` to the harness.

4. **Update the `run` command** — In `packages/cli/src/cmd/run.ts`, resolve the model for `'run'` and pass it when building the backend command. This change is minimal — call the resolution helper and pass the result to `backend.buildCommand()`.

5. **Update the `plan` command** — In `packages/cli/src/cmd/plan.ts`, resolve the model for `'plan'` and pass it when building the backend command. Same pattern as the run command.

6. **Update existing tests** — In `packages/cli/src/lib/__tests__/config.test.ts`, add test cases for:
   - Config with `model` as an object parses correctly
   - Config with only root `model` still works (backward compat)
   - `model.run` overrides root `model` for the run command
   - `model.plan` overrides root `model` for the plan command

7. **Validate** — Run `bun lint`, `bun fmt`, and `bun typecheck` to ensure no regressions.

## Acceptance Criteria

1. **Root model fallback**
   - Given a config with `"model": "anthropic/claude-opus-4-6"`
   - When either `run` or `plan` command is executed
   - Then both commands use `anthropic/claude-opus-4-6`

2. **Per-command override for run**
   - Given a config with `"model": { "run": "anthropic/claude-sonnet-4-20250514" }`
   - When the `run` command is executed
   - Then it uses `anthropic/claude-sonnet-4-20250514`

3. **Per-command override for plan**
   - Given a config with `"model": { "plan": "anthropic/claude-sonnet-4-20250514" }`
   - When the `plan` command is executed
   - Then it uses `anthropic/claude-sonnet-4-20250514`

4. **Partial override preserves fallback**
   - Given a config with `"model": { "run": "anthropic/claude-sonnet-4-20250514" }`
   - When the `plan` command is executed
   - Then no model flag is passed to the backend (uses backend default)

5. **No model configured**
   - Given a config with no `model`
   - When either command is executed
   - Then no model flag is passed to the backend (uses backend default)

6. **Backward compatibility**
   - Given an existing `ody.json` with only the root `model` field
   - When config is loaded
   - Then it parses successfully with no errors or warnings

## Metadata
- **Complexity**: Medium
- **Labels**: config, cli, run, plan, model
