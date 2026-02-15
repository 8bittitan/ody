---
status: pending
created: 2026-02-15
started: null
completed: null
---
# Task: Create the Binaries GitHub Actions Workflow

## Description
Create `.github/workflows/binaries.yml`, a workflow that triggers on version tag pushes (`v*`), builds cross-platform Bun binaries in parallel using a matrix strategy, and creates a GitHub Release with the binaries attached.

## Background
The release plan (`planning/release.md`, Step 5) specifies this as the final stage of the release pipeline. After the Release workflow pushes a `v*` tag, this workflow builds four platform-specific binaries (macOS ARM64, macOS x64, Linux x64, Linux ARM64) and publishes them as a GitHub Release using `softprops/action-gh-release`.

## Technical Requirements
1. Create `.github/workflows/binaries.yml`
2. Trigger: `push` on tags matching `v*`
3. Permissions: `contents: write`
4. Job `build` (matrix strategy, runs on `ubuntu-latest`):
   - Matrix includes four targets:
     | target             | artifact           |
     | ------------------ | ------------------ |
     | `bun-darwin-arm64` | `ody-darwin-arm64` |
     | `bun-darwin-x64`   | `ody-darwin-x64`   |
     | `bun-linux-x64`    | `ody-linux-x64`    |
     | `bun-linux-arm64`  | `ody-linux-arm64`  |
   - Steps:
     - Checkout with `actions/checkout@v4`
     - Setup Bun with `oven-sh/setup-bun@v2` using `bun-version-file: .tool-versions`
     - `bun install`
     - Compile binary: `bun build --production --compile --target=${{ matrix.target }} --outfile=./dist/${{ matrix.artifact }} ./src/index.ts` (working-directory: `packages/cli`)
     - Upload artifact with `actions/upload-artifact@v4` (name: artifact name, path: `packages/cli/dist/<artifact>`)
5. Job `release` (depends on `build`, runs on `ubuntu-latest`):
   - Download all artifacts with `actions/download-artifact@v4` (merge-multiple: true)
   - Create GitHub Release with `softprops/action-gh-release@v2`:
     - `generate_release_notes: true`
     - `files: artifacts/*`

## Dependencies
- `.github/workflows/` directory -- must exist
- Depends on: `release-tag-workflow` (this workflow triggers when a tag is pushed)

## Implementation Approach
1. Create the workflow file with the exact YAML content specified in the release plan
2. The matrix strategy enables parallel builds for all four targets
3. Bun's `--target` flag handles cross-compilation from `ubuntu-latest` to macOS/Linux targets
4. `softprops/action-gh-release` automatically picks up the tag name for the release title

## Acceptance Criteria

1. **Workflow file exists**
   - `.github/workflows/binaries.yml` exists and is valid YAML

2. **Trigger is tag push**
   - Triggers on `push` with `tags: ['v*']`

3. **Matrix covers all four targets**
   - `bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64` are all present

4. **Binary names follow convention**
   - Output binaries are named `ody-<platform>-<arch>` (e.g., `ody-darwin-arm64`)

5. **Artifacts are uploaded per build**
   - Each matrix job uploads its binary as a separate artifact

6. **Release job depends on build**
   - The `release` job has `needs: build`

7. **GitHub Release is created with binaries**
   - `softprops/action-gh-release@v2` is used with `generate_release_notes: true` and `files: artifacts/*`

8. **Bun setup uses .tool-versions**
   - The `oven-sh/setup-bun@v2` step uses `bun-version-file: .tool-versions`

## Metadata
- **Complexity**: Medium
- **Labels**: release, github-actions, workflow, binaries, cross-platform
