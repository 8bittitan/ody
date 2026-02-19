---
status: completed
created: 2026-02-19
started: 2026-02-19
completed: 2026-02-19
---
# Task: Pin Third-Party GitHub Actions to Commit SHAs

## Description
Pin third-party actions in CI and release workflows from version tags to immutable commit SHAs for stronger supply-chain security.

## Background
Several workflows currently use floating major versions (for example `@v2`, `@v4`, `@v7`). While common, this trusts moving references and increases risk if upstream tags are repointed or compromised.

## Technical Requirements
1. Replace third-party `uses:` version tags with full commit SHAs in:
   - `.github/actions/setup-bun/action.yml`
   - `.github/workflows/ci.yml`
   - `.github/workflows/prepare-release.yml`
   - `.github/workflows/release.yml`
2. Keep comments indicating the original semantic version for maintainability.
3. Do not change local action references (for example `./.github/actions/setup-bun`).
4. Preserve workflow behavior exactly; this task is a pinning-only change.

## Dependencies
- Repository maintainers must choose trusted SHA revisions for each action.
- CI and release workflows must remain readable and maintainable after pinning.

## Implementation Approach
1. Inventory all external `uses:` entries across the target files.
2. Resolve each to a trusted commit SHA from the corresponding upstream repository.
3. Update `uses:` values to `owner/repo@<sha>` and add a short comment with the original tag.
4. Validate all workflows still parse and execute.

## Acceptance Criteria

1. **Immutable Action References**
   - Given any targeted workflow file
   - When reviewing `uses:` entries for third-party actions
   - Then each uses an explicit commit SHA instead of a floating tag.

2. **Behavior Preservation**
   - Given existing CI and release flow expectations
   - When workflows run after pinning
   - Then behavior remains unchanged from before pinning.

## Metadata
- **Complexity**: Medium
- **Labels**: security, ci, release, github-actions
