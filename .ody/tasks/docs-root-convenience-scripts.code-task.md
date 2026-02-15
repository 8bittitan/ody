---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Add Root-Level Convenience Scripts for Docs Workflow

## Description
Add `docs:dev` and `docs:build` convenience scripts to the root `package.json` so developers can start and build the documentation site without needing to remember the `--filter` flag. Verify the full development workflow works end-to-end.

## Background
The monorepo root `package.json` already has workspace-level scripts like `build` (runs across all workspaces) and `lint`. The docs site can be started with `bun run --filter @ody/docs dev`, but shorthand scripts at the root improve developer experience. This task also serves as the final integration check -- verifying `bun run docs:dev` starts the Next.js dev server and `bun run docs:build` produces a successful build.

## Technical Requirements
1. Add `docs:dev` script to root `package.json` that runs `bun run --filter @ody/docs dev`.
2. Add `docs:build` script to root `package.json` that runs `bun run --filter @ody/docs build`.
3. Verify `bun run docs:dev` starts the Next.js development server successfully.
4. Verify `bun run docs:build` completes without errors and produces output in `packages/docs/.next/`.

## Dependencies
- All previous docs tasks must be completed (the full docs site with at least one content page must exist for the build to succeed).

## Implementation Approach
1. Read the current root `package.json` to understand existing script conventions.
2. Add two new scripts to the `scripts` object:
   ```json
   {
     "docs:dev": "bun run --filter @ody/docs dev",
     "docs:build": "bun run --filter @ody/docs build"
   }
   ```
3. Run `bun run docs:dev` to verify the development server starts (check for the "ready" message, then terminate).
4. Run `bun run docs:build` to verify the production build succeeds.
5. Confirm all documentation pages are generated in the build output.

## Acceptance Criteria

1. **docs:dev script exists and works**
   - Given the root `package.json` has a `docs:dev` script
   - When `bun run docs:dev` is executed
   - Then the Next.js development server starts and serves the docs site

2. **docs:build script exists and works**
   - Given the root `package.json` has a `docs:build` script
   - When `bun run docs:build` is executed
   - Then the build completes successfully with no errors and `.next/` output is generated

3. **Existing scripts are not broken**
   - Given the new scripts are added
   - When `bun run build` (the existing root build) is executed
   - Then it still succeeds for all workspaces (including the new docs workspace)

4. **All documentation pages are accessible**
   - Given the build succeeded
   - When reviewing the build output
   - Then all MDX pages (introduction, installation, configuration, commands, plan subcommands) are rendered

## Metadata
- **Complexity**: Low
- **Labels**: docs, scripts, dx, workflow, integration
