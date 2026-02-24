---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Update @ody/cli to Import from @internal/* Packages

## Description
Refactor `@ody/cli` to import shared logic from `@internal/*` workspace packages instead of local paths. This completes the extraction phase by wiring the CLI to consume the newly created internal packages, ensuring nothing is broken and the CLI builds and runs correctly.

## Background
After extracting `@internal/config`, `@internal/backends`, `@internal/builders`, `@internal/tasks`, `@internal/auth`, and `@internal/integrations`, the CLI still has the original source files. This task removes the duplicated code from CLI and replaces all internal imports with `@internal/*` package imports. The original files in CLI should be deleted after confirming the new imports work correctly.

## Technical Requirements
1. Add all `@internal/*` packages as workspace dependencies in `packages/cli/package.json`:
   - `"@internal/config": "workspace:*"`
   - `"@internal/backends": "workspace:*"`
   - `"@internal/builders": "workspace:*"`
   - `"@internal/tasks": "workspace:*"`
   - `"@internal/auth": "workspace:*"`
   - `"@internal/integrations": "workspace:*"`
2. Update all import statements in `packages/cli/src/` to use `@internal/*`:
   - `import { Config, ... } from '@internal/config'`
   - `import { Backend, ... } from '@internal/backends'`
   - `import { buildRunPrompt, ... } from '@internal/builders'`
   - `import { getTaskFilesInTasksDir, ... } from '@internal/tasks'`
   - `import { Auth, ... } from '@internal/auth'`
   - `import { Jira, GitHub, Http } from '@internal/integrations'`
3. Delete the original source files from CLI that were extracted:
   - `packages/cli/src/lib/config.ts`
   - `packages/cli/src/lib/sequencer.ts`
   - `packages/cli/src/util/constants.ts`
   - `packages/cli/src/backends/` (entire directory)
   - `packages/cli/src/builders/` (entire directory)
   - `packages/cli/src/util/task.ts`
   - `packages/cli/src/types/task.ts`
   - `packages/cli/src/lib/auth.ts`
   - `packages/cli/src/lib/jira.ts`
   - `packages/cli/src/lib/github.ts`
   - `packages/cli/src/lib/http.ts`
4. CLI-specific code that remains: command definitions (`src/cmd/*`), CLI-specific prompts/logging (`@clack/prompts`), CLI entry point, and any CLI-only utilities
5. Run `bun run build` from `packages/cli` to verify the CLI still compiles
6. Run `bun run build` from root to verify the full workspace builds

## Dependencies
- All six `extract-internal-*` tasks must be completed first

## Implementation Approach
1. Update `packages/cli/package.json` to add all `@internal/*` workspace dependencies
2. Run `bun install` to resolve the new dependencies
3. Systematically update imports in each CLI source file:
   - Start with command files in `src/cmd/` (they import config, backends, builders, tasks)
   - Update `src/index.ts` entry point if it has direct imports
   - Update any remaining utility files
4. For each file, replace relative imports like `'../lib/config'` with `'@internal/config'`
5. The CLI files that use `@clack/prompts` for logging will now need to wrap the error-returning API from `@internal/config`:
   - Where `Config.load()` previously called `process.exit()`, the CLI command code will need to handle the returned error and do the logging/exiting itself
6. Delete all extracted source files from CLI
7. Run `bun run build` to verify compilation
8. Manually test: run `bun run src/index.ts` from `packages/cli` to verify the CLI starts correctly

## Acceptance Criteria

1. **No Duplicated Code**
   - Given `packages/cli/src/`
   - When searching for the deleted files
   - Then none of the extracted modules exist in CLI anymore

2. **All Imports Updated**
   - Given `packages/cli/src/`
   - When searching for old relative imports to extracted modules
   - Then no stale relative imports remain

3. **CLI Builds Successfully**
   - Given the updated CLI
   - When running `bun run build` from `packages/cli`
   - Then it produces the `dist/ody` binary without errors

4. **Full Workspace Builds**
   - Given the complete monorepo
   - When running `bun run build` from root
   - Then all packages build successfully

5. **CLI Runs Correctly**
   - Given the updated CLI
   - When running `bun run src/index.ts -- --help` from `packages/cli`
   - Then it displays the help text as before

## Metadata
- **Complexity**: High
- **Labels**: extraction, cli, refactoring
