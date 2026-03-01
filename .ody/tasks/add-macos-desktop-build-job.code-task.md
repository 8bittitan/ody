---
status: completed
created: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---
# Task: Add macOS Desktop Build Job to Release Workflow

## Description
Add a `build-desktop` job to `.github/workflows/release.yml` that builds the Electron desktop application on `macos-latest` using Electron Forge and uploads the resulting installer artifacts (DMG) for the downstream release publishing job.

## Background
The desktop app (`packages/desktop`) uses Electron Forge for packaging and making installers. The forge config (`forge.config.ts`) already defines makers for DMG (macOS), Squirrel (Windows), and Deb (Linux), but the initial release scope is macOS only. The build command is `bun run --filter '@ody/desktop' make`, which produces artifacts in `packages/desktop/out/make/`. This job runs on `macos-latest` to ensure native macOS dependencies and code signing (in a future phase) work correctly.

## Technical Requirements
1. Add a `build-desktop` job to `release.yml` running on `macos-latest`.
2. Gate the job with `needs: [tag-desktop]` and ensure it runs when the tag output is non-empty.
3. Check out the repo at the merge commit SHA.
4. Set up Bun using the existing `.github/actions/setup-bun` composite action.
5. Run `bun run --filter '@ody/desktop' make` to build the desktop installer.
6. Upload all artifacts from `packages/desktop/out/make/**` using `actions/upload-artifact`.
7. Use a descriptive artifact name (e.g., `ody-desktop-macos`).
8. Ensure the job does not fail if Electron Forge produces multiple output files (e.g., DMG + ZIP).

## Dependencies
- Depends on: `add-desktop-tag-creation-job` — needs the `tag-desktop` job to complete and emit a tag.
- Depends on: `add-change-detection-job-to-release-workflow` — transitively, via `tag-desktop`.
- Must be completed before: `add-desktop-release-publishing-job`.
- The `setup-bun` composite action at `.github/actions/setup-bun/action.yml` must work on macOS runners.

## Implementation Approach
1. Open `.github/workflows/release.yml`.
2. Add the `build-desktop` job after `tag-desktop`:
   ```yaml
   build-desktop:
     name: Build Desktop (macOS)
     runs-on: macos-latest
     needs: [tag-desktop]
     if: needs.tag-desktop.outputs.tag != ''
     steps:
       - name: Checkout
         uses: actions/checkout@v6.0.2
         with:
           ref: ${{ github.event.pull_request.merge_commit_sha }}

       - name: Setup Bun
         uses: ./.github/actions/setup-bun

       - name: Build desktop installer
         run: bun run --filter '@ody/desktop' make

       - name: Upload artifacts
         uses: actions/upload-artifact@v6.0.0
         with:
           name: ody-desktop-macos
           path: packages/desktop/out/make/**/*
   ```
3. Verify that the `setup-bun` action is compatible with `macos-latest` (check `action.yml` for OS-specific logic).
4. Confirm the glob pattern `packages/desktop/out/make/**/*` captures DMG files produced by the `MakerDMG` forge maker.
5. Consider whether `bun install` needs to run explicitly or if `setup-bun` handles it.

## Acceptance Criteria

1. **Desktop build runs on macOS**
   - Given the `tag-desktop` job completed with a valid tag
   - When the `build-desktop` job runs
   - Then it executes on a `macos-latest` runner

2. **Electron Forge make succeeds**
   - Given the desktop source code and forge config are valid
   - When `bun run --filter '@ody/desktop' make` executes
   - Then it produces installer files in `packages/desktop/out/make/`

3. **Artifacts are uploaded**
   - Given the make command produced a DMG file
   - When the upload artifact step runs
   - Then an artifact named `ody-desktop-macos` is available containing the DMG

4. **Build skipped when no desktop tag**
   - Given `tag-desktop` was skipped (no desktop changes)
   - When the workflow evaluates `build-desktop`
   - Then the job is skipped

## Metadata
- **Complexity**: Medium
- **Labels**: ci, release, desktop, build, macos
