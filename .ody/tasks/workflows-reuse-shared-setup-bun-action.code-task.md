---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Reuse Shared Setup Bun Composite Action Across Workflows

## Description
Refactor release workflows to reuse `.github/actions/setup-bun` so Bun setup, caching, and dependency installation stay consistent across CI and release paths.

## Background
CI already uses the shared `setup-bun` composite action, but `prepare-release.yml` and `release.yml` duplicate Bun setup and install steps inline. This creates maintenance drift and increases the chance of config mismatches.

## Technical Requirements
1. Update `.github/workflows/prepare-release.yml` to replace inline Bun setup + install with `uses: ./.github/actions/setup-bun`.
2. Update `.github/workflows/release.yml` build job to replace inline Bun setup + install with `uses: ./.github/actions/setup-bun`.
3. Preserve all existing behavior (same Bun version source, install behavior, cache behavior).
4. Ensure no duplicate install step remains after migration.

## Dependencies
- `.github/actions/setup-bun/action.yml` must remain present and valid.
- Related tasks that modify install behavior in the composite action should land first if possible.

## Implementation Approach
1. Replace repeated setup/install blocks with the local composite action reference.
2. Validate that the composite action provides all required steps for both workflows.
3. Confirm release build still compiles artifacts exactly as before.

## Acceptance Criteria

1. **Single Setup Path**
   - Given workflow definitions under `.github/workflows`
   - When inspecting Bun bootstrap steps
   - Then release workflows use the same local setup action as CI.

2. **No Behavioral Regression**
   - Given a release workflow run
   - When dependencies are prepared
   - Then build steps execute successfully with equivalent setup/install behavior.

## Metadata
- **Complexity**: Low
- **Labels**: ci, release, github-actions, refactor
