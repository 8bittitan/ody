---
status: completed
created: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---
# Task: Add Change Detection Job to Release Workflow

## Description
Add a `detect-changes` job to `.github/workflows/release.yml` that determines whether CLI and/or desktop release lanes should run based on which files were modified in the merged release PR. This is the foundational job that all subsequent conditional release lanes depend on.

## Background
Currently, `release.yml` triggers on any merged `release/*` PR and unconditionally runs CLI tag/build/release jobs. With the addition of a desktop release lane, the workflow needs to selectively run CLI and desktop jobs based on what actually changed. The `detect-changes` job inspects the merged PR's diff and emits boolean outputs that downstream jobs use as conditional gates.

## Technical Requirements
1. Add a `detect-changes` job as the first job in `release.yml`, running on `ubuntu-latest`.
2. Use `dorny/paths-filter` (or `tj-actions/changed-files`) to compare the merged PR diff against defined path patterns.
3. Define desktop-impacting paths: `packages/desktop/**`, `internal/**`, `package.json`, `bun.lock`, `.github/actions/setup-bun/**`.
4. Define CLI-impacting paths: `packages/cli/**`, `internal/**`, `package.json`, `bun.lock`, `.github/actions/setup-bun/**`.
5. Emit two job outputs: `cli_changed` (`true`/`false`) and `desktop_changed` (`true`/`false`).
6. The job must only run when the PR was merged and its branch starts with `release/` (matching the existing gate condition).

## Dependencies
- Requires understanding of the current `release.yml` structure (single `tag` → `build` → `release` pipeline).
- Must be completed before any of the conditional lane refactoring tasks.

## Implementation Approach
1. Open `.github/workflows/release.yml` and add a new `detect-changes` job before the existing `tag` job.
2. Check out the repo at the merge commit SHA (same pattern as existing jobs).
3. Add the `dorny/paths-filter@v3` step with two named filters (`cli` and `desktop`), each listing the relevant glob patterns.
4. Map the filter outputs to job-level outputs: `cli_changed: ${{ steps.filter.outputs.cli }}` and `desktop_changed: ${{ steps.filter.outputs.desktop }}`.
5. Apply the same `if` condition as the existing `tag` job: `github.event.pull_request.merged == true && startsWith(github.event.pull_request.head.ref, 'release/')`.
6. Verify the `dorny/paths-filter` action version is pinned and compatible with the PR-based trigger.

## Acceptance Criteria

1. **Change detection outputs are emitted**
   - Given a merged release PR that modifies files in `packages/desktop/`
   - When the `detect-changes` job runs
   - Then `desktop_changed` output is `true` and `cli_changed` output reflects whether CLI paths were also modified

2. **CLI-only changes detected correctly**
   - Given a merged release PR that only modifies files in `packages/cli/`
   - When the `detect-changes` job runs
   - Then `cli_changed` is `true` and `desktop_changed` is `false`

3. **Shared internal changes trigger both lanes**
   - Given a merged release PR that modifies files in `internal/`
   - When the `detect-changes` job runs
   - Then both `cli_changed` and `desktop_changed` are `true`

4. **Job only runs on merged release PRs**
   - Given a PR that is closed without merging, or a non-release branch
   - When the workflow triggers
   - Then the `detect-changes` job is skipped

## Metadata
- **Complexity**: Medium
- **Labels**: ci, release, desktop, change-detection
