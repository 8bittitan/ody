---
status: completed
created: 2026-02-18
started: 2026-02-18
completed: 2026-02-18
---
# Task: Add Jira Configuration to Config Schema

## Description
Extend the Ody config schema in `packages/cli/src/lib/config.ts` to include an optional `jira` object with `baseUrl` and `profile` fields. This allows projects to specify their Jira instance URL and which credential profile to use from the global auth store, keeping non-sensitive Jira settings in the project config while credentials remain in the user-global auth file.

## Background
The Ody config system uses Zod schemas defined in `packages/cli/src/lib/config.ts`. Configuration is stored in `.ody/ody.json` at the project root, with an optional global fallback at `~/.ody/ody.json` or `~/.config/ody/ody.json`. The `Config.load()` method merges global and local config (local overrides global). The config schema currently has keys for `backend`, `maxIterations`, `shouldCommit`, `validatorCommands`, `model`, `skipPermissions`, `agent`, `tasksDir`, and `notify`. Adding a `jira` key enables the upcoming `ody task import --jira` command to resolve the Jira base URL and credential profile without requiring the user to pass them as flags every time. The `profile` field references a named profile in the auth store (`~/.local/share/ody/auth.json`), defaulting to `"default"` when omitted.

## Technical Requirements
1. Add an optional `jira` field to `configSchema` in `packages/cli/src/lib/config.ts` with the shape: `{ baseUrl: string (url), profile?: string }`
2. Add the same `jira` field to `Config.Schema` (the stricter schema used for JSON schema generation), including appropriate `.describe()` calls for documentation
3. The `baseUrl` field must use `z.string().url()` to validate it is a proper URL
4. The `profile` field must be an optional string that references a named credential profile in the auth store
5. The entire `jira` object must be optional — projects that do not use Jira should not need to configure it
6. The `OdyConfig` type (inferred from the schema) must automatically include the new `jira` field so that `Config.get('jira')` is type-safe
7. Existing config files without a `jira` key must continue to parse without errors

## Dependencies
- `packages/cli/src/lib/config.ts` — the config module to be modified
- `zod` (already a dependency) — for schema definition
- No new dependencies required

## Implementation Approach
1. **Add to `configSchema`**: Inside the `z.object({...})` call that defines `configSchema`, add a new `jira` field: `jira: z.object({ baseUrl: z.string().url(), profile: z.string().optional() }).optional()`
2. **Add to `Config.Schema`**: Inside the stricter schema used for JSON schema generation, add the same `jira` field with `.describe()` annotations: `jira: z.object({ baseUrl: z.string().url().describe('Jira instance base URL (e.g., https://company.atlassian.net)'), profile: z.string().optional().describe('Named credential profile from auth store (defaults to "default")') }).optional().describe('Jira integration settings')`
3. **Verify type inference**: Confirm that `Config.get('jira')` returns `{ baseUrl: string; profile?: string } | undefined` without any manual type annotations
4. **Test with existing config**: Ensure that an `.ody/ody.json` file without the `jira` key still parses successfully and that `Config.get('jira')` returns `undefined`

## Acceptance Criteria

1. **Schema accepts valid jira config**
   - Given an `.ody/ody.json` with `{ "jira": { "baseUrl": "https://company.atlassian.net" } }`
   - When `Config.load()` is called
   - Then the config parses successfully and `Config.get('jira')` returns the object

2. **Schema accepts jira config with profile**
   - Given an `.ody/ody.json` with `{ "jira": { "baseUrl": "https://company.atlassian.net", "profile": "work" } }`
   - When `Config.load()` is called
   - Then `Config.get('jira')` returns `{ baseUrl: "https://company.atlassian.net", profile: "work" }`

3. **Schema rejects invalid baseUrl**
   - Given an `.ody/ody.json` with `{ "jira": { "baseUrl": "not-a-url" } }`
   - When `Config.load()` is called
   - Then a Zod validation error is thrown

4. **Config without jira key still parses**
   - Given an existing `.ody/ody.json` that has no `jira` key
   - When `Config.load()` is called
   - Then the config parses successfully and `Config.get('jira')` returns `undefined`

5. **Jira is optional at the top level**
   - Given a minimal `.ody/ody.json` with only required fields (`backend`, `maxIterations`)
   - When `Config.load()` is called
   - Then parsing succeeds without errors

6. **Type safety for Config.get('jira')**
   - Given the updated schema
   - When `Config.get('jira')` is used in TypeScript
   - Then the return type is `{ baseUrl: string; profile?: string } | undefined` and property access is type-checked

## Metadata
- **Complexity**: Low
- **Labels**: cli, config, jira, schema
