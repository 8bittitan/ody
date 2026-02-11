# Release Plan: GitHub Releases with Changesets

Automated versioning and binary distribution for `@ody/cli` using
[Changesets](https://github.com/changesets/changesets) for version management
and GitHub Releases for distributing cross-platform binaries.

Releases are triggered on-demand via a manually-dispatched GitHub Action rather
than requiring `bunx changeset` during day-to-day development. Changesets is
used as a versioning engine (bumps `package.json`, generates `CHANGELOG.md`)
without the per-change changeset file workflow.

## Overview

```
You trigger "Prepare Release" workflow
  (pick patch / minor / major, optional summary)
        |
        v
Workflow creates a temporary changeset,
  runs `changeset version` to bump package.json + CHANGELOG.md
        |
        v
Opens a "Release vX.Y.Z" PR with the version bump + changelog
        |
        v
You review and merge the PR
        |
        v
Release workflow detects the merge, creates + pushes git tag
        |
        v
Binaries workflow triggers on tag push
  - Builds 4 platform binaries in parallel
  - Creates GitHub Release with binaries attached
```

## Prerequisites

- GitHub repository: `8bittitan/ody`
- No additional secrets required (`GITHUB_TOKEN` is provided automatically)

## Step 1: Add Package Metadata

Edit `packages/cli/package.json` to add the missing fields. The existing
`bin`, `files`, `scripts`, and `dependencies` fields stay unchanged.

```jsonc
{
  "name": "@ody/cli",
  "version": "0.1.0",
  "description": "Agentic orchestrator CLI",
  "license": "MIT",
  "author": "8bittitan",
  "repository": {
    "type": "git",
    "url": "https://github.com/8bittitan/ody.git",
    "directory": "packages/cli"
  },
  "keywords": ["agent", "orchestration"],
  "bin": "./dist/ody",
  "files": ["dist"],
  "type": "module",
  "module": "./src/index.ts",
  "scripts": {
    "build": "bun build --production --compile --outfile=./dist/ody ./src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  // ... dependencies unchanged
}
```

## Step 2: Initialize Changesets

Install the changesets CLI as a root workspace dev dependency and initialize:

```bash
bun add -D -w @changesets/cli
bunx changeset init
```

This creates `.changeset/config.json` and `.changeset/README.md`.

Edit `.changeset/config.json` to match:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

Notes:
- `access` is `restricted` because we are not publishing to npm (see
  `planning/release-npm.md` for adding npm later).
- `commit: false` is fine — the GitHub Action handles committing via PR.

## Step 3: Create the Prepare Release Workflow

Create `.github/workflows/prepare-release.yml`. This is a manually-dispatched
workflow that you trigger from the GitHub Actions UI (or via `gh` CLI) when
you're ready to cut a release. It creates a changeset, runs
`changeset version`, and opens a PR with the version bump and changelog.

```yaml
name: Prepare Release

on:
  workflow_dispatch:
    inputs:
      bump:
        description: 'Version bump type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
      summary:
        description: 'Release summary (optional — used in changelog)'
        required: false
        type: string

permissions:
  contents: write
  pull-requests: write

jobs:
  prepare:
    name: Prepare Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .tool-versions

      - name: Install dependencies
        run: bun install

      - name: Get current version
        id: current
        run: echo "version=$(jq -r .version packages/cli/package.json)" >> "$GITHUB_OUTPUT"

      - name: Create changeset
        run: |
          SUMMARY="${{ inputs.summary }}"
          if [ -z "$SUMMARY" ]; then
            SUMMARY="Release (${{ inputs.bump }} bump)"
          fi

          mkdir -p .changeset
          cat > .changeset/release-bump.md << EOF
          ---
          '@ody/cli': ${{ inputs.bump }}
          ---

          ${SUMMARY}
          EOF

      - name: Version packages
        run: bunx changeset version

      - name: Get new version
        id: new
        run: echo "version=$(jq -r .version packages/cli/package.json)" >> "$GITHUB_OUTPUT"

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v7
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'release: v${{ steps.new.outputs.version }}'
          title: 'Release v${{ steps.new.outputs.version }}'
          body: |
            ## Release v${{ steps.new.outputs.version }}

            Bump type: `${{ inputs.bump }}` (from v${{ steps.current.outputs.version }})

            ${{ inputs.summary }}

            ---

            This PR was auto-generated by the Prepare Release workflow.
            Merging it will trigger tag creation and binary builds.
          branch: release/v${{ steps.new.outputs.version }}
          delete-branch: true
```

How this works:
- A temporary changeset file is created inline with the chosen bump type and
  summary text.
- `changeset version` consumes the changeset, bumps `version` in
  `packages/cli/package.json`, and appends to `CHANGELOG.md`.
- `peter-evans/create-pull-request` commits the resulting changes and opens a
  PR on a `release/vX.Y.Z` branch.
- The changeset file is consumed and deleted by `changeset version`, so it
  never appears in the PR.

### Triggering a Release

From the GitHub UI:
1. Go to **Actions** > **Prepare Release**
2. Click **Run workflow**
3. Select `patch`, `minor`, or `major`
4. Optionally type a release summary
5. Click **Run workflow**
6. Review and merge the resulting PR

Or from the CLI:
```bash
gh workflow run prepare-release.yml -f bump=patch -f summary="Fix config loading edge case"
```

## Step 4: Create the Release Workflow

Create `.github/workflows/release.yml`. This triggers on pushes to `main` and
creates a git tag when it detects a release commit (from a merged release PR).
The tag push then triggers the binaries workflow.

```yaml
name: Release

on:
  push:
    branches:
      - main
    paths:
      - 'packages/cli/package.json'

permissions:
  contents: write

jobs:
  tag:
    name: Tag Release
    runs-on: ubuntu-latest
    if: startsWith(github.event.head_commit.message, 'release: v')
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Create and push tag
        run: |
          VERSION=$(jq -r .version packages/cli/package.json)
          TAG="v${VERSION}"

          if git rev-parse "$TAG" >/dev/null 2>&1; then
            echo "Tag $TAG already exists, skipping."
            exit 0
          fi

          echo "Creating tag $TAG"
          git tag "$TAG"
          git push origin "$TAG"
```

How this works:
- Only triggers when `packages/cli/package.json` changes on `main`.
- The `if` condition ensures it only runs for release commits (matching the
  commit message format `release: vX.Y.Z` set by the prepare workflow).
- Creates a lightweight git tag (e.g., `v0.1.1`) and pushes it, which
  triggers the binaries workflow.

## Step 5: Create the Binaries Workflow

Create `.github/workflows/binaries.yml`. This triggers on version tag pushes,
builds cross-platform binaries in parallel, and creates a GitHub Release.

```yaml
name: Build Binaries

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    name: Build (${{ matrix.target }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - target: bun-darwin-arm64
            artifact: ody-darwin-arm64
          - target: bun-darwin-x64
            artifact: ody-darwin-x64
          - target: bun-linux-x64
            artifact: ody-linux-x64
          - target: bun-linux-arm64
            artifact: ody-linux-arm64
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .tool-versions

      - name: Install dependencies
        run: bun install

      - name: Compile binary
        run: |
          bun build --production --compile \
            --target=${{ matrix.target }} \
            --outfile=./dist/${{ matrix.artifact }} \
            ./src/index.ts
        working-directory: packages/cli

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: packages/cli/dist/${{ matrix.artifact }}

  release:
    name: Create GitHub Release
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: artifacts/*
```

### Supported Targets

| Target | Binary Name | OS / Architecture |
|---|---|---|
| `bun-darwin-arm64` | `ody-darwin-arm64` | macOS Apple Silicon |
| `bun-darwin-x64` | `ody-darwin-x64` | macOS Intel |
| `bun-linux-x64` | `ody-linux-x64` | Linux x86_64 |
| `bun-linux-arm64` | `ody-linux-arm64` | Linux ARM64 |

Windows targets (`bun-windows-x64`) can be added later if needed.

## Step 6: Install Script (Optional)

Create `install.sh` at the repo root so users can install with a single
command:

```bash
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh
```

Example `install.sh`:

```bash
#!/usr/bin/env sh
set -eu

REPO="8bittitan/ody"
INSTALL_DIR="${ODY_INSTALL_DIR:-$HOME/.local/bin}"

detect_platform() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    linux)  PLATFORM="linux" ;;
    darwin) PLATFORM="darwin" ;;
    *)      echo "Unsupported OS: $OS"; exit 1 ;;
  esac

  case "$ARCH" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)             echo "Unsupported architecture: $ARCH"; exit 1 ;;
  esac

  echo "${PLATFORM}-${ARCH}"
}

main() {
  TARGET=$(detect_platform)
  BINARY="ody-${TARGET}"

  echo "Detected platform: ${TARGET}"

  # Get latest release tag
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4)

  if [ -z "$TAG" ]; then
    echo "Error: could not determine latest release"
    exit 1
  fi

  echo "Latest release: ${TAG}"

  URL="https://github.com/${REPO}/releases/download/${TAG}/${BINARY}"

  echo "Downloading ${URL}..."
  mkdir -p "$INSTALL_DIR"
  curl -fsSL -o "${INSTALL_DIR}/ody" "$URL"
  chmod +x "${INSTALL_DIR}/ody"

  echo ""
  echo "Installed ody to ${INSTALL_DIR}/ody"

  # Check if install dir is in PATH
  case ":$PATH:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      echo ""
      echo "Add ${INSTALL_DIR} to your PATH:"
      echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
      ;;
  esac
}

main
```

## Day-to-Day Workflow

### Making Changes

No changeset step is required during development. Just commit and push as
normal:

```bash
# 1. Make your code changes
# 2. Commit and push
git add .
git commit -m "feat: add new feature"
git push
```

### Releasing

```bash
# 1. Trigger the Prepare Release workflow
gh workflow run prepare-release.yml -f bump=patch -f summary="Fix config loading edge case"

# Or use the GitHub Actions UI:
#   Actions > Prepare Release > Run workflow > pick bump type > Run

# 2. Review the resulting "Release vX.Y.Z" PR
#    - Check the version bump in package.json
#    - Check the CHANGELOG.md entry

# 3. Merge the PR

# 4. The release workflow creates and pushes a git tag (e.g. v0.1.1)

# 5. The binaries workflow builds 4 platform binaries and creates
#    a GitHub Release at https://github.com/8bittitan/ody/releases
```

### How Users Install

```bash
# Install script (downloads correct binary for OS/arch)
curl -fsSL https://raw.githubusercontent.com/8bittitan/ody/main/install.sh | sh

# Or download directly from GitHub Releases
# https://github.com/8bittitan/ody/releases
```

## Files Changed / Created

| File | Status | Purpose |
|---|---|---|
| `packages/cli/package.json` | Modified | Add version, license, metadata |
| `package.json` (root) | Modified | Add `@changesets/cli` dev dependency |
| `.changeset/config.json` | Created | Changesets configuration |
| `.changeset/README.md` | Created | Changesets documentation (auto-generated) |
| `.github/workflows/prepare-release.yml` | Created | Dispatch workflow to prepare a release PR |
| `.github/workflows/release.yml` | Created | Tag creation on release PR merge |
| `.github/workflows/binaries.yml` | Created | Cross-platform binary builds + GitHub Release |
| `install.sh` | Created | User-facing install script (optional) |

## Key Differences from a Standard Changesets Setup

In a typical changesets workflow, developers run `bunx changeset` with each
PR to create changeset files that accumulate over time. This project instead
uses changesets as a **versioning engine only**:

- No changeset files are created during day-to-day development.
- The Prepare Release dispatch workflow creates a temporary changeset and
  immediately consumes it with `changeset version`.
- The `changesets/action` GitHub Action is **not** used. Instead,
  `peter-evans/create-pull-request` opens the release PR directly.
- Version bumps and changelog generation still go through changesets, so
  the tooling can be extended later (e.g., adding npm publishing via
  `changeset publish`).

## Future: Adding npm Publishing

See `planning/release-npm.md` for the plan to add `npm`/`bun` package
publishing alongside GitHub Releases.
