---
status: completed
created: 2026-02-22
started: 2026-02-22
completed: 2026-02-22
---
# Task: Update Workspace Structure for Internal Packages

## Description
Restructure the Bun monorepo workspace configuration to support a new `internal/*` directory alongside the existing `packages/*`. This is the foundational change that enables all subsequent `@internal/*` package extractions.

## Background
The current monorepo only has `packages/*` in its workspace configuration. The Electron desktop app plan requires shared internal packages (`@internal/config`, `@internal/backends`, `@internal/builders`, `@internal/tasks`, `@internal/auth`, `@internal/integrations`) that both `@ody/cli` and `@ody/desktop` will consume. These live under a new `internal/` top-level directory. The root `package.json` workspaces array must be updated to include both `packages/*` and `internal/*`.

## Technical Requirements
1. Update root `package.json` `workspaces` field from `["packages/*"]` to `["packages/*", "internal/*"]`
2. Create the `internal/` top-level directory
3. Verify `bun install` resolves correctly with the new workspace configuration
4. Ensure no existing functionality is broken by the workspace change

## Dependencies
- None -- this is the first task in the migration sequence

## Implementation Approach
1. Read the current root `package.json` to understand the existing workspace configuration
2. Update the `workspaces` field to `["packages/*", "internal/*"]`
3. Create the `internal/` directory (can be empty initially or contain a `.gitkeep`)
4. Run `bun install` to verify the workspace resolves without errors
5. Run `bun run build` from root to confirm the existing CLI build is unaffected

## Acceptance Criteria

1. **Workspaces Updated**
   - Given the root `package.json`
   - When inspecting the `workspaces` field
   - Then it contains `["packages/*", "internal/*"]`

2. **Directory Exists**
   - Given the repository root
   - When listing top-level directories
   - Then `internal/` exists

3. **Bun Install Succeeds**
   - Given the updated workspace config
   - When running `bun install`
   - Then it completes without errors

4. **Existing Build Unaffected**
   - Given the updated workspace config
   - When running `bun run build` from root
   - Then the CLI builds successfully as before

## Metadata
- **Complexity**: Low
- **Labels**: infrastructure, workspace, monorepo
