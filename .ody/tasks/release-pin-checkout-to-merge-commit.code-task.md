---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Pin Release Workflow Checkouts to the Merged Commit

## Description
Update `.github/workflows/release.yml` so all jobs operate on the exact merged pull request commit instead of the moving `main` branch tip.

## Background
The current workflow checks out `ref: main` in the `tag`, `build`, and `release` jobs. Because the workflow runs on `pull_request.closed`, additional commits can land on `main` between merge time and workflow execution time. That creates a risk of tagging and releasing the wrong code.

## Technical Requirements
1. Update `.github/workflows/release.yml` checkout steps in `tag`, `build`, and `release` jobs to use `${{ github.event.pull_request.merge_commit_sha }}` (or `${{ github.sha }}` for this event) instead of `main`.
2. Ensure all jobs (`tag`, `build`, `release`) use the same immutable ref value.
3. Keep existing job structure and triggers unchanged.
4. Keep artifact naming and release asset behavior unchanged.

## Dependencies
- `.github/workflows/release.yml` must exist.
- No workflow trigger changes are required for this task.

## Implementation Approach
1. Update each `actions/checkout@v4` step in `.github/workflows/release.yml` to use the merged commit ref.
2. Verify the chosen expression is valid for `pull_request.closed` events.
3. Confirm no other step references `main` directly in a way that changes released source content.

## Acceptance Criteria

1. **Immutable Checkout Ref**
   - Given a merged release PR
   - When the `Release` workflow runs
   - Then each job checks out the same merge commit SHA instead of `main`.

2. **Consistent Build and Tag Source**
   - Given new commits are pushed to `main` after the PR merge
   - When the workflow tags and builds artifacts
   - Then the tag and artifacts are produced from the merged PR commit only.

## Metadata
- **Complexity**: Low
- **Labels**: release, github-actions, workflow, reliability
