---
status: completed
created: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---
# Task: Add Desktop Tag Creation Job to Release Workflow

## Description
Add a `tag-desktop` job to `.github/workflows/release.yml` that creates a `desktop-vX.Y.Z` git tag when desktop-impacting changes are detected in a merged release PR. This tag is used by the downstream desktop build and release publishing jobs.

## Background
The release workflow currently creates a single `vX.Y.Z` tag for CLI releases. Desktop releases need a separate tag namespace (`desktop-vX.Y.Z`) to keep release histories distinct. The desktop version is read from `packages/desktop/package.json`, and the tag is only created when the `detect-changes` job reports `desktop_changed == true`. The job must also handle the case where the tag already exists (e.g., re-runs on the same commit).

## Technical Requirements
1. Add a `tag-desktop` job to `release.yml` running on `ubuntu-latest`.
2. Gate the job with `needs: [detect-changes]` and `if: needs.detect-changes.outputs.desktop_changed == 'true'`.
3. Check out the repo at the merge commit SHA (`github.event.pull_request.merge_commit_sha`).
4. Read the version from `packages/desktop/package.json` using `jq`.
5. Construct the tag as `desktop-v${VERSION}`.
6. Check if the tag already exists on the remote (using `git ls-remote --tags`); skip creation if it does.
7. Create and push the tag if it doesn't exist.
8. Emit the tag value as a job output (`tag`) for downstream jobs.

## Dependencies
- Depends on: `add-change-detection-job-to-release-workflow` — needs the `desktop_changed` output.
- Depends on: `add-desktop-version-bump-to-prepare-release` — the desktop version in `package.json` must be bumped by the release PR for meaningful tags.
- Must be completed before: `add-macos-desktop-build-job` and `add-desktop-release-publishing-job`.

## Implementation Approach
1. Open `.github/workflows/release.yml`.
2. Add the `tag-desktop` job after the `tag-cli` job (or after `detect-changes`).
3. Structure it identically to `tag-cli` but reading from `packages/desktop/package.json` and using the `desktop-v` prefix:
   ```yaml
   tag-desktop:
     name: Tag Desktop Release
     runs-on: ubuntu-latest
     needs: [detect-changes]
     if: needs.detect-changes.outputs.desktop_changed == 'true'
     outputs:
       tag: ${{ steps.create-tag.outputs.tag }}
     steps:
       - name: Checkout
         uses: actions/checkout@v6.0.2
         with:
           ref: ${{ github.event.pull_request.merge_commit_sha }}
       - name: Create and push tag
         id: create-tag
         run: |
           VERSION=$(jq -r .version packages/desktop/package.json)
           TAG="desktop-v${VERSION}"
           echo "tag=$TAG" >> "$GITHUB_OUTPUT"
           if git ls-remote --tags --exit-code origin "refs/tags/$TAG" >/dev/null 2>&1; then
             echo "Tag $TAG already exists, skipping."
           else
             git tag "$TAG"
             git push origin "$TAG"
           fi
   ```
4. Verify output references will be consumable by downstream jobs as `needs.tag-desktop.outputs.tag`.

## Acceptance Criteria

1. **Desktop tag created on desktop changes**
   - Given a merged release PR with desktop changes and desktop version `0.1.0`
   - When the `tag-desktop` job runs
   - Then a `desktop-v0.1.0` tag is created and pushed to the remote

2. **Desktop tag skipped when no desktop changes**
   - Given a merged release PR with only CLI changes
   - When the workflow runs
   - Then the `tag-desktop` job is skipped entirely

3. **Existing tag handled gracefully**
   - Given the `desktop-v0.1.0` tag already exists on the remote
   - When the `tag-desktop` job runs
   - Then it logs that the tag exists and does not fail

4. **Tag output emitted for downstream jobs**
   - Given the tag is created successfully
   - When downstream jobs reference `needs.tag-desktop.outputs.tag`
   - Then the value `desktop-v0.1.0` is available

## Metadata
- **Complexity**: Low
- **Labels**: ci, release, desktop, tagging
