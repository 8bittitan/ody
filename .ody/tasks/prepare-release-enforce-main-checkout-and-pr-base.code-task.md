---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Enforce Main Branch Context in Prepare Release Workflow

## Description
Ensure `.github/workflows/prepare-release.yml` always prepares releases from `main` and opens release PRs targeting `main`.

## Background
`workflow_dispatch` can be launched from non-main refs in GitHub UI or CLI. Without explicit branch safeguards, version bumps and generated changelogs may be based on an unintended branch, causing release drift.

## Technical Requirements
1. Update checkout in `.github/workflows/prepare-release.yml` to explicitly use `ref: main`.
2. Set `base: main` in `peter-evans/create-pull-request@v7` configuration.
3. Keep existing branch naming strategy (`release/v<version>`) for PR branch.
4. Preserve current trigger and input schema.

## Dependencies
- `.github/workflows/prepare-release.yml` must exist.
- `main` remains the repository release branch.

## Implementation Approach
1. Add `ref: main` to the checkout step.
2. Add `base: main` to pull-request creation step.
3. Verify changelog and version steps still run correctly with explicit base ref.

## Acceptance Criteria

1. **Main-Based Versioning**
   - Given a manual dispatch started from a non-main ref
   - When the workflow runs
   - Then workflow source content is still checked out from `main`.

2. **PR Base Consistency**
   - Given the workflow creates a release PR
   - When PR metadata is generated
   - Then the PR base branch is explicitly `main`.

## Metadata
- **Complexity**: Low
- **Labels**: release, github-actions, workflow
