---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Extract @internal/config Package

## Description
Extract the config loading, parsing, validation, constants, and sequencer logic from `@ody/cli` into a new `@internal/config` workspace package. This package must be runtime-compatible with both Bun (for CLI) and Node.js (for Electron main process), so all Bun-specific APIs must be removed.

## Background
`@internal/config` is the base internal package that most other `@internal/*` packages depend on. It holds the config schema (zod), the `Config` namespace (load, parse, all, get, resolveModel, shouldSkipConfig), constants (`BASE_DIR`, `ODY_FILE`, `TASKS_DIR`, etc.), and the `createSequencer()` utility. Currently these live in `packages/cli/src/lib/config.ts`, `packages/cli/src/util/constants.ts`, and `packages/cli/src/lib/sequencer.ts`. The extraction involves moving these files, removing CLI-specific side effects (`@clack/prompts` logging, `process.exit`), and returning errors instead.

## Technical Requirements
1. Create `internal/config/` directory with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export
2. Move `packages/cli/src/util/constants.ts` to `internal/config/src/constants.ts` (no changes needed -- pure values)
3. Move `packages/cli/src/lib/sequencer.ts` to `internal/config/src/sequencer.ts` (no changes needed -- pure function)
4. Move `packages/cli/src/lib/config.ts` to `internal/config/src/config.ts` with these refactors:
   - Remove all `@clack/prompts` imports and log calls
   - Remove all `process.exit()` calls
   - Return error objects or throw typed errors instead of logging + exiting
   - Keep the `Config` namespace with `Schema`, `load()`, `parse()`, `all()`, `get()`, `resolveModel()`, `shouldSkipConfig()`
5. No Bun-specific APIs in any file (use `node:fs/promises`, `node:path` only)
6. Package depends only on `zod` (no internal workspace deps)
7. `package.json` should set `name: "@internal/config"`, `version: "0.0.1"`, `private: true`, `type: "module"`, `main: "./src/index.ts"`, `types: "./src/index.ts"`

## Dependencies
- `update-workspace-structure` task must be completed first (workspace must support `internal/*`)

## Implementation Approach
1. Create `internal/config/` directory structure:
   ```
   internal/config/
     package.json
     tsconfig.json
     src/
       index.ts
       config.ts
       constants.ts
       sequencer.ts
   ```
2. Write `package.json` with `@internal/config` name, zod dependency, ESM config
3. Write `tsconfig.json` extending root config
4. Copy `constants.ts` from CLI -- no modifications needed
5. Copy `sequencer.ts` from CLI -- no modifications needed
6. Copy `config.ts` from CLI and refactor:
   - Replace `import { log } from '@clack/prompts'` with error return pattern
   - In `Config.load()`: instead of `log.error(msg); process.exit(1)`, throw a `ConfigError` or return `{ success: false, error: string }`
   - In `Config.parse()`: return zod parse result directly (already does this mostly)
   - Ensure `resolveModel(command)` and `shouldSkipConfig(cmd)` are preserved as-is
7. Create barrel export in `index.ts` exporting all public API members
8. Run `bun install` to verify workspace resolution
9. Verify the package can be imported from another workspace package

## Acceptance Criteria

1. **Package Structure**
   - Given the `internal/config/` directory
   - When inspecting its contents
   - Then it contains `package.json`, `tsconfig.json`, and `src/` with `index.ts`, `config.ts`, `constants.ts`, `sequencer.ts`

2. **No Bun APIs**
   - Given the `internal/config/src/` files
   - When searching for `Bun.` references
   - Then none are found

3. **No CLI Side Effects**
   - Given `internal/config/src/config.ts`
   - When searching for `@clack/prompts`, `process.exit`, or `console.`
   - Then none are found

4. **Exports Are Complete**
   - Given the barrel export in `index.ts`
   - When checking exported members
   - Then it exports `Config`, `configSchema`, `OdyConfig` type, `BASE_DIR`, `ODY_FILE`, `TASKS_DIR`, `ALLOWED_BACKENDS`, `DOCS_WEBSITE_URL`, `GITHUB_REPO`, and `createSequencer`

5. **Workspace Resolution**
   - Given the updated monorepo
   - When running `bun install`
   - Then `@internal/config` resolves as a workspace package

## Metadata
- **Complexity**: Medium
- **Labels**: extraction, internal-packages, config
