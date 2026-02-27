# Release Plan: Desktop Workflow Updates

This document describes how to extend the existing GitHub Actions release
workflows so the desktop app is released automatically when desktop-related
changes are included in a release PR.

It is designed to build on the current flow in:

- `planning/release.md`
- `.github/workflows/prepare-release.yml`
- `.github/workflows/release.yml`

## Goal

Keep the current CLI release behavior, and add a desktop release lane that:

- only runs when desktop-impacting files changed,
- tags desktop releases separately from CLI releases,
- builds desktop installers/packages for macOS,
- publishes desktop assets to a GitHub Release.

## Current State

- `prepare-release.yml` creates a release PR that bumps `@ody/cli` only.
- `release.yml` triggers when a `release/*` PR is merged, creates `vX.Y.Z`,
  builds CLI binaries, and publishes a release.
- Desktop packaging exists (`packages/desktop` + Electron Forge), but there is
  no desktop release automation in Actions.

## Proposed Release Model

Use two tag namespaces and conditionally run each lane:

- CLI tag: `vX.Y.Z` (unchanged)
- Desktop tag: `desktop-vX.Y.Z` (new)

Each merged release PR can produce one or both tags depending on changed files.

## Desktop Change Detection

Add a `detect-changes` job to `release.yml` that computes whether CLI and/or
desktop release jobs should run.

Recommended desktop-impacting paths:

- `packages/desktop/**`
- `internal/**` (desktop consumes shared internals)
- `package.json`
- `bun.lock`
- `.github/actions/setup-bun/**`

Recommended CLI-impacting paths (for parity):

- `packages/cli/**`
- `internal/**`
- `package.json`
- `bun.lock`
- `.github/actions/setup-bun/**`

Implementation approach:

- Use `dorny/paths-filter` (or `tj-actions/changed-files`) against the merged
  PR diff.
- Emit job outputs:
  - `cli_changed=true|false`
  - `desktop_changed=true|false`

## Workflow Updates

### 1) Update `prepare-release.yml`

Add support for desktop version bumps so merged release PRs can carry desktop
version updates when desktop changed.

Recommended updates:

- Add optional input: `desktop_bump` (`none|patch|minor|major`, default `none`).
- During changeset creation, include `@ody/desktop` only when
  `desktop_bump != none`.
- Keep the existing `@ody/cli` bump input as-is.

Example changeset payload generation:

```md
---
'@ody/cli': patch
'@ody/desktop': minor
---

Release summary text...
```

Notes:

- `@ody/desktop` can remain `private`; versioning is still useful for tags and
  release metadata.
- If desktop should always follow CLI version, you can skip `desktop_bump` and
  derive desktop version from CLI, but separate bumps are more flexible.

### 2) Update `release.yml`

Refactor into lanes gated by `detect-changes` outputs.

Recommended jobs:

1. `detect-changes`
2. `tag-cli` (if `cli_changed`)
3. `build-cli` (needs `tag-cli`)
4. `release-cli` (needs `build-cli`)
5. `tag-desktop` (if `desktop_changed`)
6. `build-desktop` (needs `tag-desktop`)
7. `release-desktop` (needs `build-desktop`)

Desktop tag creation:

- Read version from `packages/desktop/package.json`
- Create `desktop-v${VERSION}`
- Skip if tag already exists

### 3) Add macOS Desktop Build Job

Build only on `macos-latest` for now.

Current target:

- `macos-latest` -> DMG

Build command:

```bash
bun run --filter '@ody/desktop' make
```

Upload artifacts from `packages/desktop/out/make/**`.

### 4) Add Desktop GitHub Release Publishing

Create a desktop-specific release job using `softprops/action-gh-release`:

- `tag_name: desktop-vX.Y.Z`
- `name: Ody Desktop vX.Y.Z`
- `generate_release_notes: true` (or a custom body)
- attach all desktop make artifacts

Keep CLI release publishing unchanged, except for new condition checks.

## Recommended `release.yml` Shape (Pseudo-YAML)

```yaml
jobs:
  detect-changes:
    outputs: { cli_changed, desktop_changed }

  tag-cli:
    if: needs.detect-changes.outputs.cli_changed == 'true'

  build-cli:
    needs: [tag-cli]

  release-cli:
    needs: [tag-cli, build-cli]

  tag-desktop:
    if: needs.detect-changes.outputs.desktop_changed == 'true'

  build-desktop:
    needs: [tag-desktop]
    runs-on: macos-latest

  release-desktop:
    needs: [tag-desktop, build-desktop]
```

## Secrets and Signing

Desktop releases may need macOS code-signing and notarization to avoid OS
warnings. That can be phased in:

Phase 1 (now):

- Build and publish unsigned artifacts.

Phase 2 (later):

- Add macOS notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`, cert secrets).

## Validation Checklist

Before enabling on `main`, validate in a test branch:

1. Merge release PR with CLI-only changes -> only CLI lane runs.
2. Merge release PR with desktop-only changes -> only desktop lane runs.
3. Merge release PR with shared `internal/*` changes -> both lanes run.
4. Re-run workflow on same commit -> existing tags are detected and skipped.
5. Confirm release pages contain expected macOS artifacts.

## Files To Update

- `.github/workflows/prepare-release.yml` (desktop bump input + changeset logic)
- `.github/workflows/release.yml` (change detection + desktop tag/build/release)
- Optional: `planning/release.md` (cross-link desktop release process)

## Rollout Plan

1. Implement workflow changes in a PR.
2. Run manual dry-run on a branch with desktop-only changes.
3. Verify artifacts and release notes.
4. Merge and use for the next production desktop release.
