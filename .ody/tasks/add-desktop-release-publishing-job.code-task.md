---
status: completed
created: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---
# Task: Add Desktop GitHub Release Publishing Job

## Description
Add a `release-desktop` job to `.github/workflows/release.yml` that creates a GitHub Release for the desktop app, tagged with `desktop-vX.Y.Z`, and attaches all macOS installer artifacts (DMG) produced by the `build-desktop` job.

## Background
CLI releases already use `softprops/action-gh-release` to publish a GitHub Release with binary artifacts. Desktop releases need a parallel publishing step that creates a separate release under the `desktop-vX.Y.Z` tag with desktop-specific artifacts. The release should have a descriptive title ("Ody Desktop vX.Y.Z") and either auto-generated release notes or a custom body. This is the final step in the desktop release lane.

## Technical Requirements
1. Add a `release-desktop` job to `release.yml` running on `ubuntu-latest`.
2. Gate the job with `needs: [tag-desktop, build-desktop]`.
3. Download the desktop build artifacts using `actions/download-artifact`.
4. Use `softprops/action-gh-release@v2.5.0` to create the GitHub Release with:
   - `tag_name`: `${{ needs.tag-desktop.outputs.tag }}`
   - `name`: `Ody Desktop vX.Y.Z` (derived from the tag, stripping the `desktop-v` prefix or using the raw version)
   - `generate_release_notes: true` (or a custom body)
   - `files`: all downloaded desktop artifacts
5. The release should be created as a regular release (not draft, not prerelease) unless otherwise decided.
6. Ensure the CLI release job (`release-cli`) remains unchanged except for using its renamed job references.

## Dependencies
- Depends on: `add-desktop-tag-creation-job` — needs the `desktop-vX.Y.Z` tag output.
- Depends on: `add-macos-desktop-build-job` — needs the build artifacts to attach.
- Must be the last job in the desktop release lane.

## Implementation Approach
1. Open `.github/workflows/release.yml`.
2. Add the `release-desktop` job after `build-desktop`:
   ```yaml
   release-desktop:
     name: Create Desktop Release
     runs-on: ubuntu-latest
     needs: [tag-desktop, build-desktop]
     steps:
       - name: Checkout
         uses: actions/checkout@v6.0.2
         with:
           ref: ${{ github.event.pull_request.merge_commit_sha }}

       - name: Download desktop artifacts
         uses: actions/download-artifact@v6.0.0
         with:
           name: ody-desktop-macos
           path: desktop-artifacts

       - name: Create GitHub Release
         uses: softprops/action-gh-release@v2.5.0
         with:
           tag_name: ${{ needs.tag-desktop.outputs.tag }}
           name: "Ody Desktop ${{ needs.tag-desktop.outputs.tag }}"
           generate_release_notes: true
           files: desktop-artifacts/**/*
   ```
3. Consider extracting the version number from the tag for a cleaner release name (e.g., strip `desktop-` prefix to get `vX.Y.Z`).
4. Verify that `softprops/action-gh-release` can handle glob patterns for the `files` input and that the download path is correct.
5. Ensure `GITHUB_TOKEN` permissions (`contents: write`) are sufficient — already set at the workflow level.

## Acceptance Criteria

1. **Desktop release created with correct tag**
   - Given `tag-desktop` output is `desktop-v0.1.0`
   - When the `release-desktop` job runs
   - Then a GitHub Release is created with tag `desktop-v0.1.0`

2. **Release has descriptive name**
   - Given the desktop tag is `desktop-v0.1.0`
   - When the release is published
   - Then the release name includes "Ody Desktop" and the version

3. **Artifacts attached to release**
   - Given the `build-desktop` job produced a DMG artifact
   - When the release is created
   - Then the DMG file is attached as a release asset

4. **CLI release remains independent**
   - Given both CLI and desktop changes in a release PR
   - When both lanes run
   - Then two separate GitHub Releases are created: one with `vX.Y.Z` tag (CLI) and one with `desktop-vX.Y.Z` tag (desktop)

5. **Desktop release skipped when no desktop changes**
   - Given only CLI changes in a release PR
   - When the workflow runs
   - Then no desktop release is created

## Metadata
- **Complexity**: Medium
- **Labels**: ci, release, desktop, publishing
