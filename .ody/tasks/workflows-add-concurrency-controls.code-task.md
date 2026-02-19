---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Add Concurrency Controls to CI and Release Workflows

## Description
Add GitHub Actions `concurrency` configuration to prevent overlapping CI and release runs from wasting resources or producing race conditions.

## Background
The repository workflows currently do not define concurrency groups. This can lead to duplicate in-flight runs for the same branch or release sequence, especially when multiple commits are pushed quickly.

## Technical Requirements
1. Add workflow-level `concurrency` to `.github/workflows/ci.yml`:
   - Group by workflow name + ref.
   - Enable `cancel-in-progress: true`.
2. Add workflow-level `concurrency` to `.github/workflows/release.yml`:
   - Group by workflow name + merged PR number or merge commit SHA.
   - Prevent overlapping release runs for the same release event.
3. Add workflow-level `concurrency` to `.github/workflows/prepare-release.yml`:
   - Group by workflow name + target branch/ref.
   - Prevent parallel prepare-release executions from colliding.
4. Keep existing triggers and job logic unchanged.

## Dependencies
- `.github/workflows/ci.yml` exists.
- `.github/workflows/prepare-release.yml` exists.
- `.github/workflows/release.yml` exists.

## Implementation Approach
1. Insert `concurrency` near the top-level workflow keys in each file.
2. Use safe expression contexts available for each trigger type.
3. Ensure `cancel-in-progress` behavior is enabled where stale runs should be replaced.

## Acceptance Criteria

1. **CI Run De-duplication**
   - Given multiple pushes to the same branch in quick succession
   - When `CI` workflows trigger
   - Then older in-progress CI runs are cancelled in favor of the latest run.

2. **Release Safety**
   - Given duplicate or retriggered release events
   - When the `Release` workflow starts
   - Then concurrent runs for the same release unit are serialized or prevented.

3. **Prepare Release Collision Avoidance**
   - Given maintainers dispatch prepare-release close together
   - When workflows run
   - Then overlapping runs do not race on branch/PR creation.

## Metadata
- **Complexity**: Medium
- **Labels**: ci, release, github-actions, workflow
