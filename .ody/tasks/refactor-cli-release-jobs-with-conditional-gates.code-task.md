---
status: completed
created: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---
# Task: Refactor CLI Release Jobs with Conditional Gates

## Description
Refactor the existing `tag`, `build`, and `release` jobs in `release.yml` to depend on the new `detect-changes` job and only run when CLI-impacting changes are detected. The jobs should be renamed to `tag-cli`, `build-cli`, and `release-cli` for clarity alongside the new desktop lane.

## Background
The current `release.yml` has three jobs (`tag`, `build`, `release`) that run unconditionally on every merged release PR. With the introduction of a parallel desktop release lane, CLI jobs must be gated behind the `cli_changed` output from the `detect-changes` job. This avoids unnecessary CLI builds when only desktop files changed, and sets up the naming convention for the dual-lane workflow.

## Technical Requirements
1. Rename existing jobs: `tag` → `tag-cli`, `build` → `build-cli`, `release` → `release-cli`.
2. Add `needs: [detect-changes]` to `tag-cli`.
3. Add an `if` condition to `tag-cli`: `needs.detect-changes.outputs.cli_changed == 'true'`.
4. Update `build-cli` to `needs: [tag-cli]` (unchanged dependency, just renamed).
5. Update `release-cli` to `needs: [tag-cli, build-cli]` (unchanged dependency, just renamed).
6. Move the existing `if: github.event.pull_request.merged == true && startsWith(...)` condition from the old `tag` job to the `detect-changes` job (if not already there), and replace it on `tag-cli` with the `cli_changed` gate.
7. Ensure all output references are updated (e.g., `needs.tag.outputs.tag` → `needs.tag-cli.outputs.tag`).
8. Preserve all existing CLI build matrix entries, artifact uploads, changelog extraction, and `softprops/action-gh-release` configuration.

## Dependencies
- Depends on: `add-change-detection-job-to-release-workflow` — the `detect-changes` job must exist and emit `cli_changed`.
- Must be completed before or alongside desktop lane tasks to avoid conflicts.

## Implementation Approach
1. Open `.github/workflows/release.yml`.
2. Rename the three existing job keys from `tag`/`build`/`release` to `tag-cli`/`build-cli`/`release-cli`.
3. Update the `name` fields to include "CLI" (e.g., `name: Tag CLI Release`).
4. Add `needs: [detect-changes]` and `if: needs.detect-changes.outputs.cli_changed == 'true'` to `tag-cli`.
5. Update all cross-job references (`needs.tag.outputs.tag` → `needs.tag-cli.outputs.tag`, etc.).
6. Remove the merged-release-PR `if` condition from `tag-cli` since `detect-changes` already handles that gate.
7. Test by reviewing the workflow YAML for syntax correctness (can use `actionlint` locally if available).

## Acceptance Criteria

1. **CLI lane runs when CLI changes detected**
   - Given the `detect-changes` job outputs `cli_changed: true`
   - When the workflow proceeds
   - Then `tag-cli`, `build-cli`, and `release-cli` all execute in sequence

2. **CLI lane skipped when no CLI changes**
   - Given the `detect-changes` job outputs `cli_changed: false`
   - When the workflow proceeds
   - Then `tag-cli` (and consequently `build-cli` and `release-cli`) are skipped

3. **Existing CLI release behavior preserved**
   - Given a release PR with CLI changes is merged
   - When the CLI lane runs
   - Then the same tag (`vX.Y.Z`), binary artifacts, and GitHub Release are produced as before

4. **Job references are internally consistent**
   - Given the renamed jobs
   - When the workflow YAML is parsed
   - Then all `needs` references and output references resolve correctly without errors

## Metadata
- **Complexity**: Medium
- **Labels**: ci, release, refactor
