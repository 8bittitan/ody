---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Harden Release Tag Existence Check and Output Behavior

## Description
Improve tag creation logic in `.github/workflows/release.yml` by checking tag existence against the remote and preserving downstream output behavior.

## Background
The current tag check uses local `git rev-parse "$TAG"` only. Depending on fetch state, this can be inaccurate for remote tags. Also, when a tag already exists, the step exits without writing a `tag` output, which causes downstream jobs to skip.

## Technical Requirements
1. In `.github/workflows/release.yml`, replace local-only tag existence detection with a remote check using `git ls-remote --tags origin "refs/tags/$TAG"`.
2. Ensure the `create-tag` step always writes `tag=$TAG` to `$GITHUB_OUTPUT`, even if the tag already exists.
3. Keep idempotent behavior: do not fail if tag already exists.
4. Keep current tag naming format `v<version>`.

## Dependencies
- `.github/workflows/release.yml` must exist.
- `contents: write` permission remains required for pushing tags.

## Implementation Approach
1. Read version from `packages/cli/package.json` as today.
2. Query remote tags to detect whether `TAG` already exists.
3. If missing, create and push tag; if present, log and skip creation.
4. In both paths, emit `tag` output so downstream build/release jobs can proceed deterministically.

## Acceptance Criteria

1. **Remote-Accurate Tag Check**
   - Given a tag exists on `origin` but not in local checkout refs
   - When the tag step runs
   - Then the workflow correctly recognizes the tag as existing and does not re-create it.

2. **Output Stability**
   - Given a release tag already exists
   - When the `tag` job completes
   - Then `needs.tag.outputs.tag` is still populated with the expected tag value.

3. **Idempotent Re-runs**
   - Given the workflow is re-run for the same release
   - When tag logic executes
   - Then the run succeeds without duplicate tag creation errors.

## Metadata
- **Complexity**: Low
- **Labels**: release, github-actions, workflow, tagging
