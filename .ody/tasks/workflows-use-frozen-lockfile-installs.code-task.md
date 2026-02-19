---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Make CI and Release Installs Lockfile-Strict

## Description
Use `bun install --frozen-lockfile` in CI and release workflows to guarantee deterministic dependency resolution.

## Background
Current workflows run `bun install` without lockfile enforcement. This can allow dependency drift across CI and release runs, which increases the chance of non-reproducible failures and mismatched build outputs.

## Technical Requirements
1. Update `.github/actions/setup-bun/action.yml` install step to `bun install --frozen-lockfile`.
2. Update `.github/workflows/prepare-release.yml` install step to `bun install --frozen-lockfile`.
3. Update `.github/workflows/release.yml` install step to `bun install --frozen-lockfile`.
4. Do not modify lockfile files in workflows.

## Dependencies
- `bun.lock` must be committed and up to date in the repository.
- `.github/actions/setup-bun/action.yml` and target workflows must exist.

## Implementation Approach
1. Replace `bun install` commands with `bun install --frozen-lockfile` in all relevant files.
2. Validate workflow YAML syntax remains valid after edits.
3. Run local install checks only if needed to confirm no lock drift assumptions are introduced.

## Acceptance Criteria

1. **Deterministic Installs**
   - Given the workflow runs in CI
   - When dependencies are installed
   - Then install commands use `--frozen-lockfile` in all release-critical paths.

2. **Fail Fast on Drift**
   - Given `package.json` changes without a corresponding lockfile update
   - When workflow install executes
   - Then the workflow fails instead of silently resolving new versions.

## Metadata
- **Complexity**: Low
- **Labels**: ci, release, github-actions, dependencies
