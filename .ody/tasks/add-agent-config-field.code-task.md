---
status: completed
created: 2026-02-11
started: 2026-02-12
completed: 2026-02-12
---
# Task: Add `agent` Field to Ody Configuration

## Description
Add a new optional `agent` field to the ody configuration schema. This field allows users to specify which agent profile/persona a backend harness should use when building commands. Currently, the `Backend` class hardcodes `agent: 'build'` when delegating to harness implementations. This change makes the agent value configurable, falling back to `'build'` when not set.

## Background
The `Backend` class in `packages/cli/src/backends/backend.ts` passes `{ model, agent: 'build' }` as `CommandOptions` to every harness call. The `CommandOptions` type already supports an optional `agent` string, and the `Opencode` harness already consumes it to produce `--agent <value>` flags. However, there is no way for a user to control this value through the configuration file. Adding it to the config schema enables per-project agent customization without code changes.

## Technical Requirements
1. Add an optional `agent` string field to the zod config schema in `packages/cli/src/lib/config.ts`, defaulting to `'build'` when not provided.
2. Update `Backend.buildCommand` and `Backend.buildOnceCommand` in `packages/cli/src/backends/backend.ts` to read `this.config.agent` (or fall back to `'build'`) instead of the hardcoded `'build'` string.
3. Add an `--agent` / `-a` CLI argument to the `init` command in `packages/cli/src/cmd/init.ts` so users can set the agent during interactive setup.
4. Wire the `init` command to persist the `agent` value into the generated `ody.json` when provided.

## Dependencies
- `packages/cli/src/lib/config.ts` -- zod schema and `OdyConfig` type (source of truth for all config fields).
- `packages/cli/src/backends/harness.ts` -- `CommandOptions` type already has `agent?: string`.
- `packages/cli/src/backends/backend.ts` -- delegates to harness; currently hardcodes `agent: 'build'`.
- `packages/cli/src/cmd/init.ts` -- interactive config wizard that writes `.ody/ody.json`.

## Implementation Approach
1. **Config schema** -- In `packages/cli/src/lib/config.ts`, add `agent: z.string().nonempty().default('build').optional()` to the `configSchema` object. This keeps the field optional in `ody.json` while providing a sensible default.
2. **Backend wiring** -- In `packages/cli/src/backends/backend.ts`, replace the hardcoded `agent: 'build'` in both `buildCommand` and `buildOnceCommand` with `agent: this.config.agent ?? 'build'`. This ensures the config value is used when present, otherwise falls back.
3. **Init command arg** -- In `packages/cli/src/cmd/init.ts`, add an `agent` arg (`alias: 'a'`, `type: 'string'`, `required: false`). If the user provides it via flag, use it directly. Otherwise, present a `text` prompt asking for the agent name with a placeholder indicating the default is `'build'`.
4. **Init persistence** -- Set `configInput.agent` from the resolved value before writing to disk, following the same pattern as the existing `model` field.
5. **Validation** -- Run `bun lint`, `bun fmt`, and `bun typecheck` to ensure no regressions.

## Acceptance Criteria

1. **Config schema accepts `agent`**
   - Given a `.ody/ody.json` file containing `"agent": "code"`
   - When `Config.load()` is called
   - Then `Config.get('agent')` returns `"code"`

2. **Config schema defaults when `agent` is omitted**
   - Given a `.ody/ody.json` file without an `agent` field
   - When `Config.load()` is called
   - Then `Config.get('agent')` returns `"build"` (the default)

3. **Backend uses configured agent**
   - Given configuration with `agent` set to `"code"`
   - When `Backend.buildCommand(prompt)` is called
   - Then the resulting command array contains the configured agent value `"code"` rather than the hardcoded `"build"`

4. **Backend falls back to `build` without config**
   - Given configuration without an `agent` field
   - When `Backend.buildCommand(prompt)` is called
   - Then the resulting command array contains `"build"` as the agent value

5. **Init command persists agent**
   - Given the user runs `ody init --agent code`
   - When the configuration file is written
   - Then `.ody/ody.json` contains `"agent": "code"`

## Metadata
- **Complexity**: Low
- **Labels**: config, backends, init, cli
